import { NextResponse } from "next/server";
import { getBoardPayload, isAdminRequest, isItemVisible, toggleReaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const body = (await request.json()) as { emoji?: string; userId?: string; boardId?: string };
  if (!body.emoji || !body.userId) {
    return NextResponse.json({ error: "emoji와 userId가 필요합니다." }, { status: 400 });
  }
  const admin = await isAdminRequest();
  const decodedItemId = decodeURIComponent(itemId);
  if (!isItemVisible(decodedItemId, admin)) {
    return NextResponse.json({ error: "게시물을 찾을 수 없습니다." }, { status: 404 });
  }
  toggleReaction(decodedItemId, body.emoji, body.userId);
  if (body.boardId) return NextResponse.json({ reactions: getBoardPayload(body.boardId, admin).reactions });
  return NextResponse.json({ ok: true });
}
