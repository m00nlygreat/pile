import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { assertAdmin } from '@/lib/admin';
import { boards, channels, db } from '@/lib/db';
import { emitBoardEvent } from '@/lib/events';
import { nowUnixSeconds, slugify } from '@/lib/utils';

const updateChannelSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  orderIndex: z
    .preprocess((value) => (value === undefined ? value : Number(value)), z.number().int().min(0))
    .optional()
});

async function getBoardAndChannel(boardSlug: string, channelSlug: string) {
  const board = db.select().from(boards).where(eq(boards.slug, boardSlug)).get();
  if (!board) return null;
  const channel = db
    .select()
    .from(channels)
    .where(and(eq(channels.boardId, board.id), eq(channels.slug, channelSlug)))
    .get();
  if (!channel) return null;
  return { board, channel };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { boardId: string; channelId: string } }
) {
  const data = await getBoardAndChannel(params.boardId, params.channelId);
  if (!data) {
    return NextResponse.json({ message: '채널을 찾을 수 없습니다.' }, { status: 404 });
  }
  return NextResponse.json({ channel: data.channel });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { boardId: string; channelId: string } }
) {
  try {
    assertAdmin();
  } catch (error) {
    return NextResponse.json({ message: '관리자 권한이 필요합니다.' }, { status: 401 });
  }

  const data = await getBoardAndChannel(params.boardId, params.channelId);
  if (!data) {
    return NextResponse.json({ message: '채널을 찾을 수 없습니다.' }, { status: 404 });
  }

  const json = await request.json().catch(() => ({}));
  const parsed = updateChannelSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ message: '요청 본문이 올바르지 않습니다.' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.orderIndex !== undefined) updates.orderIndex = parsed.data.orderIndex;
  if (parsed.data.slug !== undefined) {
    const newSlug = slugify(parsed.data.slug);
    if (!newSlug) {
      return NextResponse.json({ message: '유효한 슬러그가 아닙니다.' }, { status: 400 });
    }
    const existing = db
      .select()
      .from(channels)
      .where(and(eq(channels.boardId, data.board.id), eq(channels.slug, newSlug)))
      .get();
    if (existing && existing.id !== data.channel.id) {
      return NextResponse.json({ message: '이미 사용 중인 슬러그입니다.' }, { status: 409 });
    }
    updates.slug = newSlug;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ channel: data.channel });
  }

  updates.updatedAt = nowUnixSeconds();

  db.update(channels)
    .set(updates)
    .where(eq(channels.id, data.channel.id))
    .run();

  const updated = db.select().from(channels).where(eq(channels.id, data.channel.id)).get();

  emitBoardEvent(data.board.id, {
    type: 'board.updated',
    payload: { id: data.board.id }
  });

  return NextResponse.json({ channel: updated });
}
