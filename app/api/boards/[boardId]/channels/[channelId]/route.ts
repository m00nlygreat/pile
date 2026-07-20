import { NextResponse } from "next/server";
import { deleteChannel, isAdminRequest, updateChannel } from "@/lib/db";
import { isValidChannelSlug } from "@/lib/slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ boardId: string; channelId: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  const { boardId: rawBoardId, channelId: rawChannelId } = await params;
  const body = (await request.json()) as { name?: string; slug?: string };
  const name = body.name?.trim();
  const slug = body.slug?.trim();
  if (!name) return NextResponse.json({ error: "채널 이름이 필요합니다." }, { status: 400 });
  if (!slug || !isValidChannelSlug(slug)) {
    return NextResponse.json({ error: "slug는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다." }, { status: 400 });
  }

  const result = updateChannel(decodeURIComponent(rawBoardId), decodeURIComponent(rawChannelId), name, slug);
  if (!result.ok) {
    if (result.reason === "duplicate-slug") {
      return NextResponse.json({ error: "이미 사용 중인 slug입니다." }, { status: 409 });
    }
    return NextResponse.json({ error: "채널을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json(result.channel);
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  const { boardId: rawBoardId, channelId: rawChannelId } = await params;
  const result = deleteChannel(decodeURIComponent(rawBoardId), decodeURIComponent(rawChannelId));
  if (!result.ok) {
    return NextResponse.json({ error: "채널을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, deletedItems: result.deletedItems });
}
