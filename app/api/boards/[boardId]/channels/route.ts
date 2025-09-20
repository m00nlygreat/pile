import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { and, eq, max } from "drizzle-orm";

import { db } from "@/db/client";
import { boards, channels } from "@/db/schema";
import { normalizeSlug } from "@/lib/slug";
import { isAdminRequest } from "@/lib/anon-server";

export const runtime = "nodejs";

const MIN_CHANNEL_NAME_LENGTH = 1;
const MAX_CHANNEL_NAME_LENGTH = 60;

export async function POST(
  request: Request,
  { params }: { params: { boardId: string } },
): Promise<NextResponse> {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const boardSlug = params.boardId;
  const [board] = db
    .select()
    .from(boards)
    .where(eq(boards.slug, boardSlug))
    .limit(1)
    .all();

  if (!board) {
    return NextResponse.json({ error: "보드를 찾을 수 없습니다." }, { status: 404 });
  }

  let payload: { name?: unknown; slug?: unknown };
  try {
    payload = (await request.json()) as { name?: unknown; slug?: unknown };
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (name.length < MIN_CHANNEL_NAME_LENGTH) {
    return NextResponse.json({ error: "채널 이름을 입력해주세요." }, { status: 400 });
  }
  if (name.length > MAX_CHANNEL_NAME_LENGTH) {
    return NextResponse.json({ error: "채널 이름이 너무 깁니다." }, { status: 400 });
  }

  const inputSlug = typeof payload.slug === "string" ? normalizeSlug(payload.slug) : "";
  const generatedSlug = normalizeSlug(name);
  let slug = inputSlug || generatedSlug || randomUUID().slice(0, 8);

  const existing = db
    .select({ id: channels.id })
    .from(channels)
    .where(and(eq(channels.boardId, board.id), eq(channels.slug, slug)))
    .limit(1)
    .all();

  if (existing.length > 0) {
    slug = `${slug}-${randomUUID().slice(0, 4)}`;
  }

  const [{ maxOrder }] = db
    .select({ maxOrder: max(channels.orderIndex).as("maxOrder") })
    .from(channels)
    .where(eq(channels.boardId, board.id))
    .all();

  const orderIndex = typeof maxOrder === "number" ? maxOrder + 1 : 0;

  const channelId = randomUUID();

  db.insert(channels)
    .values({
      id: channelId,
      boardId: board.id,
      name,
      slug,
      orderIndex,
    })
    .run();

  return NextResponse.json({
    ok: true,
    channel: {
      id: channelId,
      boardId: board.id,
      name,
      slug,
      orderIndex,
    },
  });
}
