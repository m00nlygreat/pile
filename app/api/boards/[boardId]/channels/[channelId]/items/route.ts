import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { db } from "@/db/client";
import { boards, channels, items } from "@/db/schema";
import { calculateSessionStart } from "@/lib/session";

const MAX_TEXT_LENGTH = 4000;

type RouteContext = {
  params: {
    boardId: string;
    channelId: string;
  };
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const boardSlug = decodeURIComponent(params.boardId);
  const channelSlug = decodeURIComponent(params.channelId);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json(
      { error: "잘못된 요청 본문입니다." },
      { status: 400 },
    );
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      { error: "요청 본문이 비어 있습니다." },
      { status: 400 },
    );
  }

  const rawText = typeof (payload as { text?: unknown }).text === "string"
    ? (payload as { text: string }).text
    : "";
  const normalizedText = rawText.replace(/\r\n/g, "\n");
  const trimmedText = normalizedText.trim();

  if (trimmedText.length === 0) {
    return NextResponse.json(
      { error: "텍스트 내용을 입력해 주세요." },
      { status: 400 },
    );
  }

  if (trimmedText.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      {
        error: `텍스트는 최대 ${MAX_TEXT_LENGTH.toLocaleString("ko-KR")}자까지 업로드할 수 있습니다.`,
      },
      { status: 400 },
    );
  }

  const boardRecord = db
    .select({
      id: boards.id,
      slug: boards.slug,
      sessionBlockMinutes: boards.sessionBlockMinutes,
      sessionAnchor: boards.sessionAnchor,
    })
    .from(boards)
    .where(eq(boards.slug, boardSlug))
    .limit(1)
    .all()[0];

  if (!boardRecord) {
    return NextResponse.json(
      { error: "보드를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const channelRecord = db
    .select({
      id: channels.id,
      slug: channels.slug,
    })
    .from(channels)
    .where(and(eq(channels.boardId, boardRecord.id), eq(channels.slug, channelSlug)))
    .limit(1)
    .all()[0];

  if (!channelRecord) {
    return NextResponse.json(
      { error: "채널을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const sessionStart = calculateSessionStart({
    sessionAnchor: boardRecord.sessionAnchor,
    sessionBlockMinutes: boardRecord.sessionBlockMinutes,
  });

  const itemId = randomUUID();

  db.insert(items)
    .values({
      id: itemId,
      boardId: boardRecord.id,
      channelId: channelRecord.id,
      type: "text",
      textMd: trimmedText,
      sessionStart,
    })
    .run();

  revalidatePath(`/${boardRecord.slug}/${channelRecord.slug}`);

  return NextResponse.json(
    {
      item: {
        id: itemId,
        type: "text" as const,
        textMd: trimmedText,
        sessionStart: sessionStart ? sessionStart.toISOString() : null,
      },
    },
    { status: 201 },
  );
}
