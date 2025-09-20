import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { anonUsers } from "@/db/schema";
import { ANON_COOKIE_NAME } from "@/lib/anon";
import { ADMIN_COOKIE_NAME, verifyAdminCookie } from "@/lib/admin";

export function getActiveAnonUserId(): string | null {
  const cookieValue = cookies().get(ANON_COOKIE_NAME)?.value ?? null;
  if (!cookieValue) {
    return null;
  }

  const [existing] = db
    .select({ id: anonUsers.id })
    .from(anonUsers)
    .where(eq(anonUsers.id, cookieValue))
    .limit(1)
    .all();

  if (!existing) {
    return null;
  }

  db
    .update(anonUsers)
    .set({ lastSeenAt: new Date() })
    .where(eq(anonUsers.id, existing.id))
    .run();

  return existing.id;
}

export type ActiveAnonProfile = {
  id: string;
  nickname: string;
  displayName: string | null;
};

export function getActiveAnonProfile(): ActiveAnonProfile | null {
  const anonId = getActiveAnonUserId();
  if (!anonId) {
    return null;
  }

  const [record] = db
    .select({ nickname: anonUsers.nickname, displayName: anonUsers.displayName })
    .from(anonUsers)
    .where(eq(anonUsers.id, anonId))
    .limit(1)
    .all();

  if (!record) {
    return null;
  }

  return {
    id: anonId,
    nickname: record.nickname,
    displayName: record.displayName ?? null,
  };
}

export function isAdminRequest(): boolean {
  const value = cookies().get(ADMIN_COOKIE_NAME)?.value ?? null;
  return verifyAdminCookie(value);
}
