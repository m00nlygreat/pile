import { NextResponse } from "next/server";
import { getChannelForShortcut, getItemSource, getLatestItemId, isAdminRequest } from "@/lib/db";
import { storedFileResponse } from "@/lib/stored-file-response";

function notFound() {
  return NextResponse.json({ error: "게시물을 찾을 수 없습니다." }, { status: 404 });
}

export async function itemResponse(request: Request, itemId: string, includeHidden?: boolean) {
  const item = getItemSource(itemId, includeHidden ?? await isAdminRequest());
  if (!item) return notFound();

  if (item.type === "text") {
    return new NextResponse(item.body ?? "", {
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  }
  if (item.type === "link") {
    if (!item.link?.url) return notFound();
    try {
      const target = new URL(item.link.url);
      if (!/^https?:$/.test(target.protocol)) return notFound();
      return new NextResponse(null, { status: 302, headers: { Location: item.link.url } });
    } catch {
      return notFound();
    }
  }
  if (item.type === "file") return storedFileResponse(request, itemId, item.file);
  return notFound();
}

export async function latestChannelItemResponse(request: Request, boardId: string, channelSlug?: string) {
  const includeHidden = await isAdminRequest();
  const channel = getChannelForShortcut(boardId, channelSlug, includeHidden);
  if (!channel) return notFound();

  const itemId = getLatestItemId(boardId, channel.id, includeHidden);
  if (!itemId) return notFound();

  return itemResponse(request, itemId, includeHidden);
}
