import { NextResponse } from "next/server";
import { deleteItem, isAdminRequest, setPinned } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  const { itemId } = await params;
  const body = (await request.json()) as { pinned?: boolean };
  setPinned(decodeURIComponent(itemId), Boolean(body.pinned));
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId") || "";
  const result = deleteItem(decodeURIComponent(itemId), userId, await isAdminRequest());
  if (!result.ok) return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  return NextResponse.json(result);
}
