import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const uploadsRoot = path.join(process.cwd(), "data", "uploads");

export type SaveUploadedFileResult = {
  relativePath: string;
  mimeType: string;
  size: number;
  originalName: string;
};

export async function saveUploadedFile(file: File): Promise<SaveUploadedFileResult> {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");

  const extension = resolveExtension(file);
  const originalName = deriveOriginalFilename(file, extension);

  const relativeDirectory = path.join(year, month);
  const fileName = `${randomUUID()}${extension}`;
  const relativePath = path.join(relativeDirectory, fileName).replace(/\\/g, "/");
  const absoluteDirectory = path.join(uploadsRoot, relativeDirectory);
  const absolutePath = path.join(uploadsRoot, relativePath);

  await fs.mkdir(absoluteDirectory, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absolutePath, buffer);

  return {
    relativePath,
    mimeType: file.type || "application/octet-stream",
    size: buffer.length,
    originalName,
  };
}

function resolveExtension(file: File): string {
  const fromName = sanitizeFilename(file.name);
  if (fromName) {
    const ext = path.extname(fromName);
    if (ext) {
      return ext.toLowerCase();
    }
  }

  const mime = (file.type || "").toLowerCase();
  if (mime === "image/png") {
    return ".png";
  }
  if (mime === "image/jpeg" || mime === "image/jpg") {
    return ".jpg";
  }
  if (mime === "image/gif") {
    return ".gif";
  }
  if (mime === "image/webp") {
    return ".webp";
  }

  return ".bin";
}

function sanitizeFilename(name: string | undefined): string {
  if (!name) {
    return "";
  }

  return name.replace(/[^a-zA-Z0-9.\-_]+/g, "").slice(0, 120);
}

function deriveOriginalFilename(file: File, extension: string): string {
  const rawName = typeof file.name === "string" ? file.name.trim() : "";
  if (rawName.length > 0) {
    return rawName.slice(0, 120);
  }

  return `clipboard${extension}`;
}
