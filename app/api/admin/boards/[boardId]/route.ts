import { NextResponse } from "next/server";
import { deleteBoard, isAdminRequest } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_: Request, { params }: { params: Promise<{ boardId: string }> }) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { boardId: rawBoardId } = await params;
  const boardId = decodeURIComponent(rawBoardId).trim();
  if (!boardId) {
    return NextResponse.json({ error: "Board id is required" }, { status: 400 });
  }

  return NextResponse.json(deleteBoard(boardId));
}
