import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { anonUsers } from "@/db/schema";
import { ANON_COOKIE_NAME } from "@/lib/anon";

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

export function isAdminRequest(): boolean {
  const value = cookies().get("is_admin")?.value ?? null;
  return value === "true";
}
