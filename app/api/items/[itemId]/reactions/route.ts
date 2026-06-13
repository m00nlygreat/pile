import { NextResponse } from "next/server";
import { getBoardPayload, toggleReaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const body = (await request.json()) as { emoji?: string; userId?: string; boardId?: string };
  if (!body.emoji || !body.userId) {
    return NextResponse.json({ error: "emoji와 userId가 필요합니다." }, { status: 400 });
  }
  toggleReaction(decodeURIComponent(itemId), body.emoji, body.userId);
  if (body.boardId) return NextResponse.json({ reactions: getBoardPayload(body.boardId).reactions });
  return NextResponse.json({ ok: true });
}
