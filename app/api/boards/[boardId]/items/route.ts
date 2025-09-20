import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { boards, channels, items } from "@/db/schema";
import { resolveSessionStart } from "@/lib/session";

type RouteParams = {
  boardId: string;
};

type TextPayload = {
  type: "text";
  text: string;
  channelId?: string;
};

type CreateItemPayload = TextPayload;

export async function POST(
  request: Request,
  { params }: { params: RouteParams },
): Promise<NextResponse> {
  let payload: CreateItemPayload;

  try {
    payload = (await request.json()) as CreateItemPayload;
  } catch (error) {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (!payload || payload.type !== "text") {
    return NextResponse.json({ error: "지원하지 않는 아이템 형식입니다." }, { status: 400 });
  }

  const rawText = typeof payload.text === "string" ? payload.text : "";
  const normalizedText = rawText.replace(/\r\n/g, "\n");
  const textMd = normalizedText.trim();

  if (!textMd) {
    return NextResponse.json({ error: "내용이 비어 있습니다." }, { status: 400 });
  }

  const board = db
    .select()
    .from(boards)
    .where(eq(boards.slug, params.boardId))
    .limit(1)
    .all()[0];

  if (!board) {
    return NextResponse.json({ error: "보드를 찾을 수 없습니다." }, { status: 404 });
  }

  let channelId = typeof payload.channelId === "string" && payload.channelId.length > 0
    ? payload.channelId
    : board.defaultChannelId ?? null;

  if (!channelId) {
    return NextResponse.json({ error: "채널 정보를 확인할 수 없습니다." }, { status: 400 });
  }

  const channel = db
    .select()
    .from(channels)
    .where(and(eq(channels.boardId, board.id), eq(channels.id, channelId)))
    .limit(1)
    .all()[0];

  if (!channel) {
    return NextResponse.json({ error: "채널을 찾을 수 없습니다." }, { status: 404 });
  }

  const sessionStart = resolveSessionStart(board);

  db.insert(items)
    .values({
      id: randomUUID(),
      boardId: board.id,
      channelId: channel.id,
      type: "text",
      textMd,
      sessionStart,
    })
    .run();

  return NextResponse.json({ ok: true }, { status: 201 });
}
