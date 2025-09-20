import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { items } from "@/db/schema";
import { getActiveAnonUserId, isAdminRequest } from "@/lib/anon-server";

export const runtime = "nodejs";

const uploadsRoot = path.join(process.cwd(), "data", "uploads");

export async function DELETE(
  _request: Request,
  { params }: { params: { itemId: string } },
): Promise<NextResponse> {
  const itemId = params.itemId;
  if (!itemId) {
    return NextResponse.json({ error: "삭제할 아이템을 찾을 수 없습니다." }, { status: 400 });
  }

  const [item] = db
    .select()
    .from(items)
    .where(eq(items.id, itemId))
    .limit(1)
    .all();

  if (!item) {
    return NextResponse.json({ error: "이미 삭제된 아이템입니다." }, { status: 404 });
  }

  const anonUserId = getActiveAnonUserId();
  const isAdmin = isAdminRequest();

  const isOwner = anonUserId && item.anonUserId && anonUserId === item.anonUserId;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }

  if (item.type === "file" && item.filePath) {
    const absolutePath = path.resolve(uploadsRoot, item.filePath);
    const safePrefix = `${uploadsRoot}${path.sep}`;
    if (absolutePath.startsWith(safePrefix)) {
      try {
        await fs.unlink(absolutePath);
      } catch {
        // ignore missing files
      }
    }
  }

  db.delete(items)
    .where(eq(items.id, itemId))
    .run();

  return NextResponse.json({ ok: true });
}
