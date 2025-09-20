import { NextResponse } from "next/server";

import { getAdminCookieClearAttributes } from "@/lib/admin";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(getAdminCookieClearAttributes());
  response.headers.set("Cache-Control", "no-store");
  return response;
}
