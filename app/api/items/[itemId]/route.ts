import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { unlink } from 'node:fs/promises';
import path from 'node:path';

import { assertAdmin } from '@/lib/admin';
import { boards, db, items } from '@/lib/db';
import { emitBoardEvent } from '@/lib/events';

export async function DELETE(
  _request: Request,
  { params }: { params: { itemId: string } }
) {
  try {
    assertAdmin();
  } catch (error) {
    return NextResponse.json({ message: '관리자 권한이 필요합니다.' }, { status: 401 });
  }

  const item = db.select().from(items).where(eq(items.id, params.itemId)).get();
  if (!item) {
    return NextResponse.json({ message: '아이템을 찾을 수 없습니다.' }, { status: 404 });
  }

  const board = db.select().from(boards).where(eq(boards.id, item.boardId)).get();

  db.delete(items).where(eq(items.id, params.itemId)).run();

  if (item.filePath) {
    const filePath = path.join(process.cwd(), 'data', item.filePath);
    await unlink(filePath).catch(() => undefined);
  }

  if (board) {
    emitBoardEvent(board.id, { type: 'item.deleted', payload: { id: item.id } });
  }

  return NextResponse.json({ ok: true });
}
