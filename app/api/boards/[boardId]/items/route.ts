import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { boards, channels, items, type Board, type Channel } from "@/db/schema";
import { resolveSessionStart } from "@/lib/session";
import { saveUploadedFile } from "@/lib/uploads";
import { fetchLinkMetadata } from "@/lib/og";
import { getActiveAnonUserId } from "@/lib/anon-server";

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

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: RouteParams },
): Promise<NextResponse> {
  const contentType = request.headers.get("content-type") ?? "";
  const anonUserId = getActiveAnonUserId();

  if (contentType.includes("multipart/form-data")) {
    return handleFilePaste(request, params, anonUserId);
  }

  if (contentType.includes("application/json")) {
    return handleJsonPaste(request, params, anonUserId);
  }

  return NextResponse.json({ error: "지원하지 않는 요청 형식입니다." }, { status: 400 });
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
  const board = findBoardBySlug(boardSlug);
  if (!board) {
    return null;
  }

  const targetChannelId =
    typeof requestedChannelId === "string" && requestedChannelId.length > 0
      ? requestedChannelId
      : board.defaultChannelId ?? null;

  if (!targetChannelId) {
    return null;
  }

  const [channel] = db
    .select()
    .from(channels)
    .where(and(eq(channels.boardId, board.id), eq(channels.id, targetChannelId)))
    .limit(1)
    .all();

  if (!channel) {
    return null;
  }

  return { board, channel };
}

function findBoardBySlug(slug: string): Board | null {
  const [board] = db
    .select()
    .from(boards)
    .where(eq(boards.slug, slug))
    .limit(1)
    .all();

  return board ?? null;
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
