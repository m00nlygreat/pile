const defaultUserAgent =
  "pile-bot/0.1 (+https://github.com/)";

export type LinkMetadata = {
  title: string | null;
  description: string | null;
  image: string | null;
};

const fetchTimeoutMs = 7000;
const maxResponseBytes = 200_000;

export async function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": defaultUserAgent,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Unexpected status: ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) {
      throw new Error(`Unsupported content-type: ${contentType}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Missing response body");
    }

    const chunks: Buffer[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        const chunkBuffer = Buffer.from(value);
        chunks.push(chunkBuffer);
        received += chunkBuffer.length;
        if (received >= maxResponseBytes) {
          break;
        }
      }
    }

    const buffer = Buffer.concat(chunks);
    const html = buffer.toString("utf8");

    return extractMetadata(html, url);
  } catch (error) {
    return { title: null, description: null, image: null };
  } finally {
    clearTimeout(timeout);
  }
}

function extractMetadata(html: string, baseUrl: string): LinkMetadata {
  const title = decodeHtml(extractOgContent(html, "og:title") ?? extractTitle(html));
  const description = decodeHtml(
    extractOgContent(html, "og:description") ?? extractMetaByName(html, "description") ?? null,
  );
  const imageRaw = extractOgContent(html, "og:image");
  const image = imageRaw ? absolutifyUrl(imageRaw, baseUrl) : null;

  return {
    title: sanitizeText(title),
    description: sanitizeText(description),
    image,
  };
}

function extractOgContent(html: string, property: string): string | null {
  const pattern = new RegExp(
    `<meta[^>]+property=["']${escapeRegExp(property)}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  const match = html.match(pattern);
  return match ? match[1] : null;
}

function extractMetaByName(html: string, name: string): string | null {
  const pattern = new RegExp(
    `<meta[^>]+name=["']${escapeRegExp(name)}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  const match = html.match(pattern);
  return match ? match[1] : null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? match[1] : null;
}

function absolutifyUrl(url: string, baseUrl: string): string | null {
  try {
    const absolute = new URL(url, baseUrl);
    if (absolute.protocol === "http:" || absolute.protocol === "https:") {
      return absolute.toString();
    }
  } catch (error) {
    return null;
  }
  return null;
}

function sanitizeText(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, 600);
}

function decodeHtml(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
