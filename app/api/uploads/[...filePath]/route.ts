import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

const uploadsRoot = path.join(process.cwd(), "data", "uploads");
const uploadsRootWithSlash = uploadsRoot.endsWith(path.sep)
  ? uploadsRoot
  : `${uploadsRoot}${path.sep}`;

export async function GET(
  _request: Request,
  { params }: { params: { filePath: string[] } },
): Promise<NextResponse> {
  const segments = Array.isArray(params.filePath) ? params.filePath : [params.filePath];
  const relativePath = segments.join("/");
  if (!relativePath) {
    return new NextResponse("Not Found", { status: 404 });
  }
  const normalizedPath = path.normalize(relativePath).replace(/^\.\/+/, "");
  const absolutePath = path.join(uploadsRoot, normalizedPath);

  if (!absolutePath.startsWith(uploadsRootWithSlash)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  try {
    const file = await fs.readFile(absolutePath);
    const mimeType = detectMimeType(path.extname(normalizedPath));

    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return new NextResponse("Not Found", { status: 404 });
  }
}

function detectMimeType(extension: string): string {
  const ext = extension.toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}
