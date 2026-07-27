import { NextResponse } from "next/server";
import { isAdminRequest, listBoardUsers, removeBoardUser, upsertBoardUser, wasBoardUserRemoved } from "@/lib/db";
import type { UserRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validUser(value: unknown): value is UserRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "nick" in value &&
      "display" in value &&
      typeof value.id === "string" &&
      typeof value.nick === "string" &&
      typeof value.display === "string",
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId: rawBoardId } = await params;
  const boardId = decodeURIComponent(rawBoardId);
  const body = (await request.json()) as unknown;
  if (!validUser(body)) {
    return NextResponse.json({ error: "사용자 정보가 필요합니다." }, { status: 400 });
  }
  if (wasBoardUserRemoved(boardId, body.id)) {
    return NextResponse.json({ resetId: true }, { status: 409 });
  }
  return NextResponse.json(upsertBoardUser(boardId, body));
}

export async function GET(_: Request, { params }: { params: Promise<{ boardId: string }> }) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  const { boardId: rawBoardId } = await params;
  return NextResponse.json({ users: listBoardUsers(decodeURIComponent(rawBoardId)) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ boardId: string }> }) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  const { boardId: rawBoardId } = await params;
  const body = (await request.json().catch(() => null)) as { userId?: string } | null;
  if (!body?.userId) return NextResponse.json({ error: "참가자 정보가 필요합니다." }, { status: 400 });
  removeBoardUser(decodeURIComponent(rawBoardId), body.userId);
  return NextResponse.json({ ok: true });
}
