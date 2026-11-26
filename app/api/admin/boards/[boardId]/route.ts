import { NextResponse } from "next/server";
import { deleteBoard, isAdminRequest, updateBoardDisplayName } from "@/lib/db";
import { isReservedBoardId } from "@/lib/slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ boardId: string }> }) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { boardId: rawBoardId } = await params;
  const boardId = decodeURIComponent(rawBoardId).trim();
  if (!boardId) {
    return NextResponse.json({ error: "Board id is required" }, { status: 400 });
  }
  const body = await request.json().catch(() => null) as { displayName?: unknown } | null;
  if (!body || typeof body.displayName !== "string") {
    return NextResponse.json({ error: "Display name is required" }, { status: 400 });
  }
  if (isReservedBoardId(boardId)) {
    return NextResponse.json({ error: "This board ID is reserved" }, { status: 409 });
  }

  return NextResponse.json(updateBoardDisplayName(boardId, body.displayName));
}

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
