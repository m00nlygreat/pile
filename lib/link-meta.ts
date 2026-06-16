import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { isIP } from "node:net";
import { basename, extname, join } from "node:path";
import { lookup } from "node:dns/promises";
import type { LinkPayload } from "@/lib/types";

const IMAGE_DIR = join(process.cwd(), "data", "link-images");
const MAX_HTML_BYTES = 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function cleanText(value: string | null | undefined) {
  return decodeEntities(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function meta(html: string, key: string) {
  const re = new RegExp(`<meta\\s+[^>]*(?:property|name)=["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag?.match(/\scontent=["']([^"']*)["']/i)?.[1] ?? null;
}

function title(html: string) {
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null;
}

function safeHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "::1"].includes(host)) return false;
  if (host.endsWith(".local")) return false;
  const ip = isIP(host);
  if (!ip) return true;
  if (ip === 4) return !/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host);
  return !/^(::1|fc|fd|fe80)/i.test(host);
}

async function assertFetchable(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported URL protocol");
  if (!safeHost(url.hostname)) throw new Error("Blocked local URL");
  try {
    const result = await lookup(url.hostname);
    if (!safeHost(result.address)) throw new Error("Blocked private URL");
  } catch {
    throw new Error("URL host lookup failed");
  }
}

async function fetchText(url: URL) {
  await assertFetchable(url);
  const res = await fetch(url, {
    headers: {
      "accept": "text/html,application/xhtml+xml",
      "user-agent": "Pile link preview bot/1.0",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url.hostname}`);
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_HTML_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  return Buffer.concat(chunks, Math.min(total, MAX_HTML_BYTES)).toString("utf8");
}

function imageExt(contentType: string, source: URL) {
  const byType = contentType.includes("png") ? ".png" : contentType.includes("webp") ? ".webp" : contentType.includes("gif") ? ".gif" : contentType.includes("svg") ? ".svg" : ".jpg";
  const byPath = extname(source.pathname).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"].includes(byPath) ? byPath : byType;
}

async function cacheImage(imageUrl: URL, pageUrl: URL) {
  await assertFetchable(imageUrl);
  const res = await fetch(imageUrl, {
    headers: {
      "accept": "image/*",
      "referer": pageUrl.toString(),
      "user-agent": "Pile link preview bot/1.0",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(7000),
  });
  const type = res.headers.get("content-type") ?? "";
  const length = Number(res.headers.get("content-length") ?? 0);
  if (!res.ok || !type.startsWith("image/") || length > MAX_IMAGE_BYTES) return undefined;
  const data = Buffer.from(await res.arrayBuffer());
  if (data.byteLength > MAX_IMAGE_BYTES) return undefined;
  mkdirSync(IMAGE_DIR, { recursive: true });
  const hash = createHash("sha256").update(imageUrl.toString()).digest("hex").slice(0, 24);
  const filename = `${hash}${imageExt(type, imageUrl)}`;
  const path = join(IMAGE_DIR, filename);
  if (!existsSync(path)) writeFileSync(path, data);
  return `/api/link-images/${filename}`;
}

export function linkImagePath(filename: string) {
  const safe = basename(filename);
  if (!/^[a-f0-9]{24}\.(jpg|jpeg|png|webp|gif|svg)$/i.test(safe)) return null;
  return join(IMAGE_DIR, safe);
}

export async function enrichLink(link: LinkPayload): Promise<LinkPayload> {
  const pageUrl = new URL(link.url);
  const html = await fetchText(pageUrl);
  const imageRaw = cleanText(meta(html, "og:image") || meta(html, "twitter:image"));
  const imageUrl = imageRaw ? new URL(imageRaw, pageUrl) : null;
  const image = imageUrl ? await cacheImage(imageUrl, pageUrl).catch(() => undefined) : undefined;
  return {
    ...link,
    title: cleanText(meta(html, "og:title") || meta(html, "twitter:title") || title(html)) || link.title || pageUrl.href,
    site: cleanText(meta(html, "og:site_name")) || link.site,
    desc: cleanText(meta(html, "og:description") || meta(html, "description") || meta(html, "twitter:description")) || undefined,
    image,
  };
}
