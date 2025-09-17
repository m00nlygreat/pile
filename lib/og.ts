import * as cheerio from 'cheerio';

type LinkMeta = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
};

export async function fetchLinkMetadata(url: string): Promise<LinkMeta> {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'pile-bot/0.1' } });
    const html = await response.text();
    const $ = cheerio.load(html);
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const title = ogTitle || $('title').text();
    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content');
    const image = $('meta[property="og:image"]').attr('content');
    return {
      url,
      title: title?.trim(),
      description: description?.trim(),
      image: image?.trim()
    };
  } catch (error) {
    return { url };
  }
}
