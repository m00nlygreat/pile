import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { anonUsers } from "@/db/schema";
import { getActiveAnonUserId } from "@/lib/anon-server";

export const runtime = "nodejs";

const NAME_MAX_LENGTH = 30;

export async function GET(): Promise<NextResponse> {
  const anonId = getActiveAnonUserId();
  if (!anonId) {
    return NextResponse.json({ ok: false, error: "익명 사용자 정보를 찾을 수 없습니다." }, { status: 401 });
  }

  const [record] = db
    .select({ displayName: anonUsers.displayName, nickname: anonUsers.nickname })
    .from(anonUsers)
    .where(eq(anonUsers.id, anonId))
    .limit(1)
    .all();

  if (!record) {
    return NextResponse.json({ ok: false, error: "익명 사용자 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    anonId,
    nickname: record.nickname,
    displayName: record.displayName ?? null,
  });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const anonId = getActiveAnonUserId();
  if (!anonId) {
    return NextResponse.json({ error: "익명 사용자 정보를 찾을 수 없습니다." }, { status: 401 });
  }

  let payload: { displayName?: unknown };
  try {
    payload = (await request.json()) as { displayName?: unknown };
  } catch (error) {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const raw = payload?.displayName;
  let displayName: string | null;

  if (raw === null || (typeof raw === "string" && raw.trim().length === 0)) {
    displayName = null;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.length > NAME_MAX_LENGTH) {
      return NextResponse.json({ error: `이름은 최대 ${NAME_MAX_LENGTH}자까지 가능합니다.` }, { status: 400 });
    }
    displayName = trimmed;
  } else if (typeof raw === "undefined") {
    displayName = null;
  } else {
    return NextResponse.json({ error: "이름 형식이 올바르지 않습니다." }, { status: 400 });
  }

  db
    .update(anonUsers)
    .set({ displayName, lastSeenAt: new Date() })
    .where(eq(anonUsers.id, anonId))
    .run();

  const [record] = db
    .select({ displayName: anonUsers.displayName, nickname: anonUsers.nickname })
    .from(anonUsers)
    .where(eq(anonUsers.id, anonId))
    .limit(1)
    .all();

  return NextResponse.json({
    ok: true,
    displayName: record?.displayName ?? null,
    nickname: record?.nickname ?? null,
    anonId,
  });
}
