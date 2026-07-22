import { NextResponse } from "next/server";
import { getItemFile } from "@/lib/db";
import { readStoredFile } from "@/lib/file-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function contentDisposition(name: string, download: boolean) {
  const fallback = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "download";
  const encoded = encodeURIComponent(name).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${download ? "attachment" : "inline"}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function GET(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId: rawItemId } = await params;
  const itemId = decodeURIComponent(rawItemId);
  const file = getItemFile(itemId);
  if (!file?.url) return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });

  try {
    const bytes = await readStoredFile(itemId);
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": /^[\w.+-]+\/[\w.+-]+$/.test(file.mime) ? file.mime : "application/octet-stream",
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": contentDisposition(file.name, download),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
    }
    throw error;
  }
}
