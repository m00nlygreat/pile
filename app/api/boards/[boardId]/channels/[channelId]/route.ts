import { NextResponse } from "next/server";
import { deleteChannel, isAdminRequest, setChannelArchived, setChannelType, updateChannel } from "@/lib/db";
import { isValidChannelSlug } from "@/lib/slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ boardId: string; channelId: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  const { boardId: rawBoardId, channelId: rawChannelId } = await params;
  const body = (await request.json()) as { name?: string; slug?: string; archived?: boolean; type?: "standard" | "submission" };
  const boardId = decodeURIComponent(rawBoardId);
  const channelId = decodeURIComponent(rawChannelId);
  if (typeof body.archived === "boolean") {
    const result = setChannelArchived(boardId, channelId, body.archived);
    if (!result.ok) return NextResponse.json({ error: "채널을 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ ok: true, archived: body.archived, archivedAt: result.archivedAt });
  }
  const name = body.name?.trim();
  const slug = body.slug?.trim();
  if (!name) return NextResponse.json({ error: "채널 이름이 필요합니다." }, { status: 400 });
  if (!slug || !isValidChannelSlug(slug)) {
    return NextResponse.json({ error: "slug는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다." }, { status: 400 });
  }

  const result = updateChannel(boardId, channelId, name, slug);
  if (!result.ok) {
    if (result.reason === "duplicate-slug") {
      return NextResponse.json({ error: "이미 사용 중인 slug입니다." }, { status: 409 });
    }
    return NextResponse.json({ error: "채널을 찾을 수 없습니다." }, { status: 404 });
  }
  const type = body.type === "submission" ? "submission" : body.type === "standard" ? "standard" : result.channel.type;
  if (type !== result.channel.type) {
    const typeResult = setChannelType(boardId, channelId, type);
    if (!typeResult.ok) return NextResponse.json({ error: "채널을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ...result.channel, type });
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
