import { NextResponse } from "next/server";

import { getAdminCookieClearAttributes } from "@/lib/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const referer = request.headers.get("referer");
  let redirectUrl: URL;

  try {
    redirectUrl = referer ? new URL(referer) : new URL("/", request.url);
  } catch (error) {
    redirectUrl = new URL("/", request.url);
  }

  const response = NextResponse.redirect(redirectUrl, { status: 303 });
  response.cookies.set(getAdminCookieClearAttributes());
  response.headers.set("Cache-Control", "no-store");
  return response;
}
