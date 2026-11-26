import { getActiveLiveChannel } from "@/lib/db";
import { liveChannelUrl, liveCorsHeaders } from "@/lib/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const live = getActiveLiveChannel();
  const headers = liveCorsHeaders(request.headers.get("origin"));
  const body = live
    ? { live: true, title: live.title, url: liveChannelUrl(live) }
    : { live: false };
  return Response.json(body, { status: 200, headers });
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: liveCorsHeaders(request.headers.get("origin")) });
}
