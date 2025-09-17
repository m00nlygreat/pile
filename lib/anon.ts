import { cookies } from 'next/headers';
import { randomInt } from 'node:crypto';
import { eq } from 'drizzle-orm';

import { anonUsers, db } from './db';
import { generateNickname } from './nickname';
import { createId, nowUnixSeconds } from './utils';

export const ANON_COOKIE = 'anon_id';

export async function getOrCreateAnonUser() {
  const store = cookies();
  const existing = store.get(ANON_COOKIE)?.value;

  if (existing) {
    const user = db
      .select()
      .from(anonUsers)
      .where(eq(anonUsers.id, existing))
      .get();

    if (user) {
      db.update(anonUsers)
        .set({ lastSeenAt: nowUnixSeconds() })
        .where(eq(anonUsers.id, existing))
        .run();
      return user;
    }
  }

  const id = createId('anon');
  const nickname = generateNickname(randomInt(0, 10_000));
  db.insert(anonUsers)
    .values({ id, nickname, createdAt: nowUnixSeconds(), lastSeenAt: nowUnixSeconds() })
    .run();

  store.set(ANON_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365
  });

  return db.select().from(anonUsers).where(eq(anonUsers.id, id)).get();
}
