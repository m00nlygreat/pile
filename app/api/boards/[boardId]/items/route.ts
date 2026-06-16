import { NextResponse } from "next/server";
import { createItem, defaultChannelExists } from "@/lib/db";
import type { FilePayload, ItemRecord, LinkPayload, UserRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

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
  const body = (await request.json()) as {
    channel?: string;
    type?: ItemRecord["type"];
    user?: UserRecord;
    body?: string;
    link?: LinkPayload;
    file?: FilePayload;
  };
  const channel = body.channel || "default";
  if (!defaultChannelExists(boardId, channel)) {
    return NextResponse.json({ error: "존재하지 않는 채널입니다." }, { status: 400 });
  }
  if (!body.type || !["text", "link", "file"].includes(body.type)) {
    return NextResponse.json({ error: "지원하지 않는 아이템 타입입니다." }, { status: 400 });
  }
  if (!validUser(body.user)) {
    return NextResponse.json({ error: "작성자 정보가 필요합니다." }, { status: 400 });
  }
  if (body.type === "text" && !body.body?.trim()) {
    return NextResponse.json({ error: "본문이 필요합니다." }, { status: 400 });
  }
  if (body.type === "link" && !body.link?.url) {
    return NextResponse.json({ error: "URL이 필요합니다." }, { status: 400 });
  }
  if (body.type === "file" && (!body.file?.name || body.file.size > MAX_FILE_BYTES)) {
    return NextResponse.json({ error: "파일이 없거나 20MB를 초과했습니다." }, { status: 400 });
  }
  const item = createItem(boardId, {
    channel,
    type: body.type,
    user: body.user,
    session: Date.now(),
    t: Date.now(),
    body: body.type === "text" ? body.body : undefined,
    link: body.type === "link" ? body.link : undefined,
    file: body.type === "file" ? body.file : undefined,
  });
  return NextResponse.json(item);
}
