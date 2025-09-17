import { NextResponse } from 'next/server';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { lookup } from 'mime-types';

export async function GET(
  _request: Request,
  { params }: { params: { path: string[] } }
) {
  if (!params.path || params.path.length === 0) {
    return NextResponse.json({ message: '파일 경로가 필요합니다.' }, { status: 400 });
  }

  const dataDir = path.join(process.cwd(), 'data');
  const filePath = path.join(dataDir, ...params.path);
  const normalized = path.normalize(filePath);

  if (!normalized.startsWith(dataDir)) {
    return NextResponse.json({ message: '잘못된 경로입니다.' }, { status: 400 });
  }

  try {
    const fileStat = await stat(normalized);
    if (!fileStat.isFile()) {
      return NextResponse.json({ message: '파일이 존재하지 않습니다.' }, { status: 404 });
    }
    const buffer = await readFile(normalized);
    const mime = lookup(normalized) || 'application/octet-stream';
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer;
    const blob = new Blob([arrayBuffer]);
    return new Response(blob, {
      headers: {
        'Content-Type': mime,
        'Content-Length': String(buffer.length)
      }
    });
  } catch (error) {
    return NextResponse.json({ message: '파일이 존재하지 않습니다.' }, { status: 404 });
  }
}
