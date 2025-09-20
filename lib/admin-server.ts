import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { anonUsers } from "@/db/schema";
import { ADMIN_ANON_ID, getAdminDisplayName } from "@/lib/admin";

export function ensureAdminAnonUser() {
  const adminName = getAdminDisplayName();
  const now = new Date();

  db
    .insert(anonUsers)
    .values({
      id: ADMIN_ANON_ID,
      nickname: adminName,
      displayName: adminName,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: anonUsers.id,
      set: {
        nickname: adminName,
        displayName: adminName,
        lastSeenAt: now,
      },
    })
    .run();
}

export function markAdminLastSeen() {
  const now = new Date();

  db
    .update(anonUsers)
    .set({ lastSeenAt: now })
    .where(eq(anonUsers.id, ADMIN_ANON_ID))
    .run();
}
