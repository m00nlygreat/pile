import { NextResponse } from "next/server";
import { getBoardPayload } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  return NextResponse.json(getBoardPayload(decodeURIComponent(boardId)));
}
