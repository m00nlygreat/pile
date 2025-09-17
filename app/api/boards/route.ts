import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { assertAdmin } from '@/lib/admin';
import { boards, channels, db } from '@/lib/db';
import { emitBoardEvent } from '@/lib/events';
import { createId, nowUnixSeconds, slugify } from '@/lib/utils';

const createBoardSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().max(500).optional(),
  sessionBlockMinutes: z
    .preprocess((value) => (value === undefined ? value : Number(value)), z.number().int().min(15).max(240))
    .optional(),
  sessionAnchor: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
});

export async function GET() {
  const allBoards = db.select().from(boards).orderBy(boards.createdAt).all();
  return NextResponse.json({ boards: allBoards });
}

export async function POST(request: NextRequest) {
  try {
    assertAdmin();
  } catch (error) {
    return NextResponse.json({ message: '관리자 권한이 필요합니다.' }, { status: 401 });
  }

  const json = await request.json().catch(() => ({}));
  const parsed = createBoardSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ message: '요청 본문이 올바르지 않습니다.' }, { status: 400 });
  }

  const payload = parsed.data;
  const slug = slugify(payload.slug ?? payload.name);

  if (!slug) {
    return NextResponse.json({ message: '유효한 슬러그를 생성할 수 없습니다.' }, { status: 400 });
  }

  const existing = db.select().from(boards).where(eq(boards.slug, slug)).get();
  if (existing) {
    return NextResponse.json({ message: '이미 사용 중인 슬러그입니다.' }, { status: 409 });
  }

  const now = nowUnixSeconds();
  const boardId = createId('board');
  const result = db.transaction((tx) => {
    tx.insert(boards)
      .values({
        id: boardId,
        name: payload.name,
        slug,
        description: payload.description ?? null,
        sessionBlockMinutes: payload.sessionBlockMinutes ?? 60,
        sessionAnchor: payload.sessionAnchor ?? '00:00',
        createdAt: now,
        updatedAt: now
      })
      .run();

    const channelId = createId('chan');
    tx.insert(channels)
      .values({
        id: channelId,
        boardId,
        name: '공유',
        slug: 'default',
        orderIndex: 0,
        createdAt: now,
        updatedAt: now
      })
      .run();

    tx.update(boards)
      .set({ defaultChannelId: channelId, updatedAt: now })
      .where(eq(boards.id, boardId))
      .run();

    return { channelId };
  });

  emitBoardEvent(boardId, {
    type: 'board.updated',
    payload: { id: boardId }
  });

  const createdBoard = db.select().from(boards).where(eq(boards.id, boardId)).get();
  const defaultChannel = db.select().from(channels).where(eq(channels.id, result.channelId)).get();

  return NextResponse.json({
    board: createdBoard,
    defaultChannel
  });
}
