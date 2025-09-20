import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { and, eq, max } from "drizzle-orm";

import { db } from "@/db/client";
import { anonUsers, boards, channels, items, type Board, type Channel } from "@/db/schema";
import { resolveSessionStart } from "@/lib/session";
import { saveUploadedFile } from "@/lib/uploads";
import { fetchLinkMetadata } from "@/lib/og";
import { getActiveAnonUserId, isAdminRequest } from "@/lib/anon-server";
import { ADMIN_ANON_ID } from "@/lib/admin";
import { ensureAdminAnonUser, markAdminLastSeen } from "@/lib/admin-server";
import {
  ANON_COOKIE_NAME,
  createAnonId,
  generateNickname,
  getAnonCookieExpiry,
} from "@/lib/anon";

type RouteParams = {
  boardId: string;
};

type TextPayload = {
  type: "text";
  text: string;
  channelId?: string;
};

type LinkPayload = {
  type: "link";
  url: string;
  channelId?: string;
};

const maxUploadBytes = Math.max(1, Number.parseInt(process.env.MAX_UPLOAD_MB ?? "20", 10)) * 1024 * 1024;

const DEFAULT_CHANNEL_SLUG = "default";
const DEFAULT_CHANNEL_NAME = "공유";

type DbExecutor = Pick<typeof db, "select" | "insert" | "update">;

type AnonIdentity = {
  anonUserId: string | null;
  cookie: {
    value: string;
    expires: Date;
  } | null;
};

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: RouteParams },
): Promise<NextResponse> {
  const contentType = request.headers.get("content-type") ?? "";
  const viewerIsAdmin = isAdminRequest();
  const anonIdentity = resolveAnonIdentity(viewerIsAdmin);

  if (viewerIsAdmin) {
    ensureAdminAnonUser();
    markAdminLastSeen();
  }
  const authorAnonId = viewerIsAdmin ? ADMIN_ANON_ID : anonIdentity.anonUserId;

  if (contentType.includes("multipart/form-data")) {
    const response = await handleFilePaste(request, params, authorAnonId);
    applyAnonCookie(response, anonIdentity.cookie);
    return response;
  }

  if (contentType.includes("application/json")) {
    const response = await handleJsonPaste(request, params, authorAnonId);
    applyAnonCookie(response, anonIdentity.cookie);
    return response;
  }

  const response = NextResponse.json({ error: "지원하지 않는 요청 형식입니다." }, { status: 400 });
  applyAnonCookie(response, anonIdentity.cookie);
  return response;
}

async function handleJsonPaste(
  request: Request,
  params: RouteParams,
  anonUserId: string | null,
): Promise<NextResponse> {
  let payload: TextPayload | LinkPayload;

  try {
    payload = (await request.json()) as TextPayload | LinkPayload;
  } catch (error) {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "지원하지 않는 아이템 형식입니다." }, { status: 400 });
  }

  if (payload.type === "text") {
    return handleTextPayload(payload, params, anonUserId);
  }

  if (payload.type === "link") {
    return handleLinkPayload(payload, params, anonUserId);
  }

  return NextResponse.json({ error: "지원하지 않는 아이템 형식입니다." }, { status: 400 });
}

async function handleTextPayload(
  payload: TextPayload,
  params: RouteParams,
  anonUserId: string | null,
): Promise<NextResponse> {
  const rawText = typeof payload.text === "string" ? payload.text : "";
  const normalizedText = rawText.replace(/\r\n/g, "\n");
  const textMd = normalizedText.trim();

  if (!textMd) {
    return NextResponse.json({ error: "내용이 비어 있습니다." }, { status: 400 });
  }

  const context = findBoardAndChannel(params.boardId, payload.channelId);
  if (!context) {
    return NextResponse.json({ error: "보드 또는 채널을 찾을 수 없습니다." }, { status: 404 });
  }

  const sessionStart = resolveSessionStart(context.board);
  const itemId = randomUUID();

  db.insert(items)
    .values({
      id: itemId,
      boardId: context.board.id,
      channelId: context.channel.id,
      ...(anonUserId ? { anonUserId } : {}),
      type: "text",
      textMd,
      sessionStart,
    })
    .run();

  return NextResponse.json({ ok: true, itemId }, { status: 201 });
}

async function handleLinkPayload(
  payload: LinkPayload,
  params: RouteParams,
  anonUserId: string | null,
): Promise<NextResponse> {
  const sanitizedUrl = sanitizeUrl(payload.url);
  if (!sanitizedUrl) {
    return NextResponse.json({ error: "유효한 링크가 아닙니다." }, { status: 400 });
  }

  const context = findBoardAndChannel(params.boardId, payload.channelId);
  if (!context) {
    return NextResponse.json({ error: "보드 또는 채널을 찾을 수 없습니다." }, { status: 404 });
  }

  const metadata = await fetchLinkMetadata(sanitizedUrl);
  const sessionStart = resolveSessionStart(context.board);
  const itemId = randomUUID();

  db.insert(items)
    .values({
      id: itemId,
      boardId: context.board.id,
      channelId: context.channel.id,
      ...(anonUserId ? { anonUserId } : {}),
      type: "link",
      linkUrl: sanitizedUrl,
      linkTitle: metadata.title,
      linkDesc: metadata.description,
      linkImage: metadata.image,
      sessionStart,
    })
    .run();

  return NextResponse.json(
    {
      ok: true,
      itemId,
      linkUrl: sanitizedUrl,
      linkTitle: metadata.title,
      linkDesc: metadata.description,
      linkImage: metadata.image,
    },
    { status: 201 },
  );
}

async function handleFilePaste(
  request: Request,
  params: RouteParams,
  anonUserId: string | null,
): Promise<NextResponse> {
  const formData = await request.formData();
  const typeField = formData.get("type");

  if (typeof typeField !== "string" || typeField !== "file") {
    return NextResponse.json({ error: "지원하지 않는 아이템 형식입니다." }, { status: 400 });
  }

  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File)) {
    return NextResponse.json({ error: "이미지를 찾을 수 없습니다." }, { status: 400 });
  }

  if (fileEntry.size === 0) {
    return NextResponse.json({ error: "비어 있는 파일은 업로드할 수 없습니다." }, { status: 400 });
  }

  const fileType = (fileEntry.type || "").toLowerCase();

  if (!fileType.startsWith("image/")) {
    return NextResponse.json({ error: "이미지 파일만 붙여넣기 업로드가 가능합니다." }, { status: 400 });
  }

  if (fileEntry.size > maxUploadBytes) {
    return NextResponse.json(
      { error: `이미지는 최대 ${(maxUploadBytes / (1024 * 1024)).toFixed(0)}MB까지 업로드할 수 있습니다.` },
      { status: 413 },
    );
  }

  const channelIdField = formData.get("channelId");
  const context = findBoardAndChannel(
    params.boardId,
    typeof channelIdField === "string" ? channelIdField : undefined,
  );

  if (!context) {
    return NextResponse.json({ error: "보드 또는 채널을 찾을 수 없습니다." }, { status: 404 });
  }

  const saved = await saveUploadedFile(fileEntry);
  const sessionStart = resolveSessionStart(context.board);
  const itemId = randomUUID();

  db.insert(items)
    .values({
      id: itemId,
      boardId: context.board.id,
      channelId: context.channel.id,
      ...(anonUserId ? { anonUserId } : {}),
      type: "file",
      filePath: saved.relativePath,
      fileMime: saved.mimeType,
      fileSize: saved.size,
      fileOriginalName: saved.originalName,
      sessionStart,
    })
    .run();

  return NextResponse.json(
    { ok: true, itemId, filePath: saved.relativePath, fileOriginalName: saved.originalName },
    { status: 201 },
  );
}

function findBoardAndChannel(
  boardSlug: string,
  requestedChannelId?: string,
): { board: Board; channel: Channel } | null {
  if (requestedChannelId && requestedChannelId.trim().length > 0) {
    const board = findBoardBySlug(boardSlug);
    if (!board) {
      return null;
    }

    const channel = findChannelById(board.id, requestedChannelId);
    if (!channel) {
      return null;
    }

    return { board, channel };
  }

  return ensureBoardWithDefaultChannel(boardSlug);
}

function ensureBoardWithDefaultChannel(boardSlug: string): { board: Board; channel: Channel } | null {
  return db.transaction((tx) => {
    let [board] = tx
      .select()
      .from(boards)
      .where(eq(boards.slug, boardSlug))
      .limit(1)
      .all();

    if (!board) {
      const boardId = randomUUID();
      tx
        .insert(boards)
        .values({
          id: boardId,
          name: boardSlug,
          slug: boardSlug,
        })
        .run();

      [board] = tx
        .select()
        .from(boards)
        .where(eq(boards.id, boardId))
        .limit(1)
        .all();
    }

    if (!board) {
      return null;
    }

    const ensured = ensureDefaultChannel(tx, board);
    return ensured;
  });
}

function ensureDefaultChannel(
  tx: DbExecutor,
  board: Board,
): { board: Board; channel: Channel } {
  let channel: Channel | null = null;

  if (board.defaultChannelId) {
    channel = findChannelById(board.id, board.defaultChannelId, tx);
  }

  if (!channel) {
    channel = findChannelBySlug(board.id, DEFAULT_CHANNEL_SLUG, tx);
  }

  if (!channel) {
    const [{ maxOrder }] = tx
      .select({ maxOrder: max(channels.orderIndex).as("maxOrder") })
      .from(channels)
      .where(eq(channels.boardId, board.id))
      .all();

    const orderIndex = typeof maxOrder === "number" ? maxOrder + 1 : 0;
    const channelId = randomUUID();

    tx
      .insert(channels)
      .values({
        id: channelId,
        boardId: board.id,
        name: DEFAULT_CHANNEL_NAME,
        slug: DEFAULT_CHANNEL_SLUG,
        orderIndex,
      })
      .run();

    [channel] = tx
      .select()
      .from(channels)
      .where(and(eq(channels.boardId, board.id), eq(channels.id, channelId)))
      .limit(1)
      .all();

    if (!channel) {
      throw new Error("Failed to create default channel for board");
    }

    if (!board.defaultChannelId) {
      tx
        .update(boards)
        .set({ defaultChannelId: channel.id })
        .where(eq(boards.id, board.id))
        .run();

      board = {
        ...board,
        defaultChannelId: channel.id,
      };
    }
  }

  if (!board.defaultChannelId) {
    tx
      .update(boards)
      .set({ defaultChannelId: channel.id })
      .where(eq(boards.id, board.id))
      .run();

    board = {
      ...board,
      defaultChannelId: channel.id,
    };
  }

  return { board, channel };
}

function findBoardBySlug(slug: string, client: DbExecutor = db): Board | null {
  const [board] = client
    .select()
    .from(boards)
    .where(eq(boards.slug, slug))
    .limit(1)
    .all();

  return board ?? null;
}

function findChannelById(
  boardId: string,
  channelId: string,
  client: DbExecutor = db,
): Channel | null {
  const [channel] = client
    .select()
    .from(channels)
    .where(and(eq(channels.boardId, boardId), eq(channels.id, channelId)))
    .limit(1)
    .all();

  return channel ?? null;
}

function findChannelBySlug(
  boardId: string,
  slug: string,
  client: DbExecutor = db,
): Channel | null {
  const [channel] = client
    .select()
    .from(channels)
    .where(and(eq(channels.boardId, boardId), eq(channels.slug, slug)))
    .limit(1)
    .all();

  return channel ?? null;
}

function resolveAnonIdentity(isAdmin: boolean): AnonIdentity {
  if (isAdmin) {
    return { anonUserId: ADMIN_ANON_ID, cookie: null };
  }

  const existingId = getActiveAnonUserId();
  if (existingId) {
    return { anonUserId: existingId, cookie: null };
  }

  const anonId = createAnonId();
  const nickname = generateNickname();
  const now = new Date();

  db
    .insert(anonUsers)
    .values({
      id: anonId,
      nickname,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: anonUsers.id,
      set: {
        lastSeenAt: now,
      },
    })
    .run();

  return {
    anonUserId: anonId,
    cookie: {
      value: anonId,
      expires: getAnonCookieExpiry(),
    },
  };
}

function applyAnonCookie(response: NextResponse, cookie: AnonIdentity["cookie"]) {
  if (!cookie) {
    return;
  }

  response.cookies.set({
    name: ANON_COOKIE_NAME,
    value: cookie.value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    expires: cookie.expires,
  });
}

function sanitizeUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch (error) {
    return null;
  }
}
