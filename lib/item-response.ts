import { NextResponse } from "next/server";
import { getItemSource } from "@/lib/db";
import { storedFileResponse } from "@/lib/stored-file-response";

function notFound() {
  return NextResponse.json({ error: "게시물을 찾을 수 없습니다." }, { status: 404 });
}

export async function itemResponse(request: Request, itemId: string) {
  const item = getItemSource(itemId);
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
