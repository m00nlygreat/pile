import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createId } from './utils';

const ALLOWED_MIME_PREFIXES = ['image/', 'application/pdf', 'application/msword', 'application/vnd', 'text/plain', 'application/zip'];

function getMaxUploadBytes() {
  const mb = Number(process.env.MAX_UPLOAD_MB ?? '20');
  return mb * 1024 * 1024;
}

export async function saveUpload(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const maxBytes = getMaxUploadBytes();
  if (buffer.length > maxBytes) {
    throw new Error(`파일 크기가 제한(${Math.round(maxBytes / (1024 * 1024))}MB)를 초과했습니다.`);
  }

  const mime = file.type || 'application/octet-stream';
  if (!ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) {
    throw new Error('허용되지 않은 파일 형식입니다.');
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const ext = path.extname(file.name) || '';
  const baseDir = path.join(process.cwd(), 'data', 'uploads', `${year}`, `${month}`);
  await mkdir(baseDir, { recursive: true });
  const fileName = `${createId('file')}${ext}`;
  const filePath = path.join(baseDir, fileName);
  await writeFile(filePath, buffer);

  const relative = path.relative(path.join(process.cwd(), 'data'), filePath);

  return {
    relativePath: relative,
    size: buffer.length,
    mime,
    originalName: file.name
  };
}
