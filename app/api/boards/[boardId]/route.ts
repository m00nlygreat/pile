import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { assertAdmin } from '@/lib/admin';
import { boards, db } from '@/lib/db';
import { emitBoardEvent } from '@/lib/events';
import { nowUnixSeconds, slugify } from '@/lib/utils';

const updateBoardSchema = z.object({
  name: z.string().min(1).max(120).optional(),
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

export async function GET(
  _request: NextRequest,
  { params }: { params: { boardId: string } }
) {
  const board = db.select().from(boards).where(eq(boards.slug, params.boardId)).get();
  if (!board) {
    return NextResponse.json({ message: '보드를 찾을 수 없습니다.' }, { status: 404 });
  }
  return NextResponse.json({ board });
}

export async function PATCH(
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

  const json = await request.json().catch(() => ({}));
  const parsed = updateBoardSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ message: '요청 본문이 올바르지 않습니다.' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.sessionBlockMinutes !== undefined)
    updates.sessionBlockMinutes = parsed.data.sessionBlockMinutes;
  if (parsed.data.sessionAnchor !== undefined) updates.sessionAnchor = parsed.data.sessionAnchor;
  if (parsed.data.slug !== undefined) {
    const newSlug = slugify(parsed.data.slug);
    if (!newSlug) {
      return NextResponse.json({ message: '유효한 슬러그가 아닙니다.' }, { status: 400 });
    }
    const existing = db
      .select()
      .from(boards)
      .where(eq(boards.slug, newSlug))
      .get();
    if (existing && existing.id !== board.id) {
      return NextResponse.json({ message: '이미 사용 중인 슬러그입니다.' }, { status: 409 });
    }
    updates.slug = newSlug;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ board });
  }

  updates.updatedAt = nowUnixSeconds();

  db.update(boards)
    .set(updates)
    .where(eq(boards.id, board.id))
    .run();

  const updated = db.select().from(boards).where(eq(boards.id, board.id)).get();

  emitBoardEvent(board.id, {
    type: 'board.updated',
    payload: { id: board.id }
  });

  return NextResponse.json({ board: updated });
}
