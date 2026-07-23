import { NextResponse } from "next/server";
import { deleteItem, isAdminRequest, moveItemToChannel, setPinned } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  const { itemId } = await params;
  const body = (await request.json()) as { pinned?: boolean; destinationChannelId?: string };
  if (body.destinationChannelId) {
    const result = moveItemToChannel(decodeURIComponent(itemId), body.destinationChannelId.trim());
    if (!result.ok) {
      const message = result.reason === "same-channel"
        ? "현재 채널로는 이동할 수 없습니다."
        : result.reason === "channel-not-found"
          ? "대상 채널을 찾을 수 없습니다."
          : "게시물을 찾을 수 없습니다.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json(result);
  }
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
