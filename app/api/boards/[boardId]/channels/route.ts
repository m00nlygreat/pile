import { NextResponse } from "next/server";
import { createChannel, isAdminRequest } from "@/lib/db";

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
  return NextResponse.json(createChannel(decodeURIComponent(boardId), name));
}
