import { NextResponse } from "next/server";
import { getActiveLiveChannel } from "@/lib/db";
import { liveChannelUrl, publicOrigin } from "@/lib/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const live = getActiveLiveChannel();
  const destination = live ? liveChannelUrl(live) : new URL("/", publicOrigin()).toString();
  const response = NextResponse.redirect(destination, 307);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
