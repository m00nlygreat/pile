import { NextResponse } from "next/server";
import { readStoredFile } from "@/lib/file-storage";
import type { FilePayload } from "@/lib/types";

function notFound() {
  return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
}

export function contentDisposition(name: string, download: boolean) {
  const fallback = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "download";
  const encoded = encodeURIComponent(name).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${download ? "attachment" : "inline"}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export function safeMime(mime: string) {
  return /^[\w.+-]+\/[\w.+-]+$/.test(mime) ? mime : "application/octet-stream";
}

export async function storedFileResponse(request: Request, itemId: string, file: FilePayload | null | undefined) {
  if (!file?.url) return notFound();

  try {
    const bytes = await readStoredFile(itemId);
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": safeMime(file.mime),
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": contentDisposition(file.name, download),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return notFound();
    throw error;
  }
}
