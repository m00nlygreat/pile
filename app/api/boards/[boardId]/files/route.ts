import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createItem, defaultChannelExists } from "@/lib/db";
import { deleteStoredFile, saveStoredFile } from "@/lib/file-storage";
import type { UserRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

function parseUser(value: FormDataEntryValue | null): UserRecord | null {
  if (typeof value !== "string") return null;
  try {
    const user = JSON.parse(value) as Partial<UserRecord>;
    if (typeof user.id !== "string" || typeof user.nick !== "string" || typeof user.display !== "string") return null;
    return { id: user.id, nick: user.nick, display: user.display, admin: Boolean(user.admin) };
  } catch {
    return null;
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId: rawBoardId } = await params;
  const boardId = decodeURIComponent(rawBoardId);
  const form = await request.formData();
  const file = form.get("file");
  const channel = String(form.get("channel") || "default");
  const user = parseUser(form.get("user"));

  if (!defaultChannelExists(boardId, channel)) {
    return NextResponse.json({ error: "존재하지 않는 채널입니다." }, { status: 400 });
  }
  if (!user) {
    return NextResponse.json({ error: "작성자 정보가 필요합니다." }, { status: 400 });
  }
  if (!(file instanceof File) || !file.name || file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "파일이 없거나 20MB를 초과했습니다." }, { status: 400 });
  }

  const itemId = `it_${randomUUID().replaceAll("-", "")}`;
  const mime = /^[\w.+-]+\/[\w.+-]+$/.test(file.type) ? file.type : "application/octet-stream";
  await saveStoredFile(itemId, new Uint8Array(await file.arrayBuffer()));
  try {
    const item = createItem(boardId, {
      id: itemId,
      channel,
      type: "file",
      user,
      session: Date.now(),
      t: Date.now(),
      file: {
        name: file.name,
        mime,
        size: file.size,
        preview: mime.startsWith("image/") ? "upload" : null,
        url: `/api/files/${encodeURIComponent(itemId)}`,
      },
    });
    return NextResponse.json(item);
  } catch (error) {
    await deleteStoredFile(itemId);
    throw error;
  }
}
