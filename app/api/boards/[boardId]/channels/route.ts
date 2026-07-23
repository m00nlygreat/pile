import { NextResponse } from "next/server";
import { createChannel, isAdminRequest, reorderChannels } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ boardId: string }> }) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  const { boardId } = await params;
  const body = (await request.json()) as { name?: string };
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "채널 이름이 필요합니다." }, { status: 400 });
  return NextResponse.json(createChannel(decodeURIComponent(boardId), name, "standard"));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ boardId: string }> }) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  const { boardId } = await params;
  const body = (await request.json()) as { channelIds?: unknown };
  if (!Array.isArray(body.channelIds) || body.channelIds.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "올바른 채널 순서가 필요합니다." }, { status: 400 });
  }
  const result = reorderChannels(decodeURIComponent(boardId), body.channelIds as string[]);
  if (!result.ok) {
    return NextResponse.json({ error: "채널 목록이 변경되었습니다. 다시 시도해 주세요." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
