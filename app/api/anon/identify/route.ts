import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { anonUsers } from "@/db/schema";
import { ANON_COOKIE_NAME, createAnonId, generateNickname, getAnonCookieExpiry } from "@/lib/anon";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const existingCookie = request.cookies.get(ANON_COOKIE_NAME)?.value ?? null;
  const now = new Date();
  let anonId = existingCookie;

  if (anonId) {
    const [existing] = db
      .select()
      .from(anonUsers)
      .where(eq(anonUsers.id, anonId))
      .limit(1)
      .all();

    if (existing) {
      db
        .update(anonUsers)
        .set({ lastSeenAt: now })
        .where(eq(anonUsers.id, anonId))
        .run();

      const response = NextResponse.json({
        id: existing.id,
        nickname: existing.nickname,
        displayName: existing.displayName,
      });

      const expires = getAnonCookieExpiry();
      response.cookies.set({
        name: ANON_COOKIE_NAME,
        value: anonId,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: ONE_YEAR_SECONDS,
        expires,
      });

      response.headers.set("Cache-Control", "no-store");
      return response;
    }
  }

  if (!anonId) {
    anonId = createAnonId();
  }

  const nickname = generateNickname();
  const expires = getAnonCookieExpiry();

  db
    .insert(anonUsers)
    .values({
      id: anonId,
      nickname,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: anonUsers.id,
      set: {
        lastSeenAt: now,
      },
    })
    .run();

  const [anonUser] = db
    .select()
    .from(anonUsers)
    .where(eq(anonUsers.id, anonId))
    .limit(1)
    .all();

  const response = NextResponse.json({
    id: anonUser?.id ?? anonId,
    nickname: anonUser?.nickname ?? nickname,
      displayName: anonUser?.displayName ?? null,
    });

  response.cookies.set({
    name: ANON_COOKIE_NAME,
    value: anonId,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    expires,
  });

  response.headers.set("Cache-Control", "no-store");

  return response;
}
