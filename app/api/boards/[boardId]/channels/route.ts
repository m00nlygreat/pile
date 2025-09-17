import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { assertAdmin } from '@/lib/admin';
import { boards, channels, db } from '@/lib/db';
import { emitBoardEvent } from '@/lib/events';
import { createId, nowUnixSeconds, slugify } from '@/lib/utils';

const createChannelSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/)
    .optional()
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { boardId: string } }
) {
  const board = db.select().from(boards).where(eq(boards.slug, params.boardId)).get();
  if (!board) {
    return NextResponse.json({ message: '보드를 찾을 수 없습니다.' }, { status: 404 });
  }
  const list = db
    .select()
    .from(channels)
    .where(eq(channels.boardId, board.id))
    .orderBy(channels.orderIndex)
    .all();
  return NextResponse.json({ channels: list });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { boardId: string } }
) {
  try {
    assertAdmin();
  } catch (error) {
    return NextResponse.json({ message: '관리자 권한이 필요합니다.' }, { status: 401 });
  }

  const board = db.select().from(boards).where(eq(boards.slug, params.boardId)).get();
  if (!board) {
    return NextResponse.json({ message: '보드를 찾을 수 없습니다.' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createChannelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: '요청 본문이 올바르지 않습니다.' }, { status: 400 });
  }

  const slug = slugify(parsed.data.slug ?? parsed.data.name);
  if (!slug) {
    return NextResponse.json({ message: '유효한 슬러그가 아닙니다.' }, { status: 400 });
  }

  const existing = db
    .select()
    .from(channels)
    .where(and(eq(channels.boardId, board.id), eq(channels.slug, slug)))
    .get();
  if (existing) {
    return NextResponse.json({ message: '이미 사용 중인 슬러그입니다.' }, { status: 409 });
  }

  const now = nowUnixSeconds();
  const maxOrder =
    db
      .select({ value: sql<number>`ifnull(max(${channels.orderIndex}), 0)` })
      .from(channels)
      .where(eq(channels.boardId, board.id))
      .get()?.value ?? 0;
  const channelId = createId('chan');
  db.insert(channels)
    .values({
      id: channelId,
      boardId: board.id,
      name: parsed.data.name,
      slug,
      orderIndex: maxOrder + 1,
      createdAt: now,
      updatedAt: now
    })
    .run();

  const channel = db.select().from(channels).where(eq(channels.id, channelId)).get();

  emitBoardEvent(board.id, {
    type: 'channel.created',
    payload: channel
  });

  return NextResponse.json({ channel });
}
