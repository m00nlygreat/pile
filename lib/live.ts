import type { getActiveLiveChannel } from "@/lib/db";

type ActiveLiveChannel = NonNullable<ReturnType<typeof getActiveLiveChannel>>;

const DEFAULT_PUBLIC_ORIGIN = "https://p.m00n.pro";

export function publicOrigin() {
  try {
    return new URL(process.env.PILE_PUBLIC_ORIGIN || DEFAULT_PUBLIC_ORIGIN).origin;
  } catch {
    return DEFAULT_PUBLIC_ORIGIN;
  }
}

export function liveChannelUrl(live: ActiveLiveChannel) {
  const boardPath = `/${encodeURIComponent(live.boardId)}`;
  const channelPath = live.channelSlug === "default" ? boardPath : `${boardPath}/${encodeURIComponent(live.channelSlug)}`;
  return new URL(channelPath, publicOrigin()).toString();
}

function isAllowedOrigin(origin: string) {
  return origin === "https://m00n.pro" || /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(origin);
}

export function liveCorsHeaders(origin: string | null) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    Vary: "Origin",
  });
  if (origin && isAllowedOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "600");
  }
  return headers;
}
