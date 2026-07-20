const CHOSEONG = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const JUNGSEONG = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
const JONGSEONG = ["", "k", "k", "ks", "n", "nj", "nh", "t", "l", "lk", "lm", "lb", "ls", "lt", "lp", "lh", "m", "p", "ps", "t", "t", "ng", "t", "t", "k", "t", "p", "t"];

function romanizeHangul(char: string) {
  const code = char.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return char;
  const offset = code - 0xac00;
  const choseong = Math.floor(offset / 588);
  const jungseong = Math.floor((offset % 588) / 28);
  const jongseong = offset % 28;
  return `${CHOSEONG[choseong]}${JUNGSEONG[jungseong]}${JONGSEONG[jongseong]}`;
}

export function slugFromChannelName(name: string) {
  const romanized = Array.from(name.trim()).map(romanizeHangul).join("");
  const slug = romanized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return slug || "channel";
}

export function uniqueSlug(baseSlug: string, usedSlugs: Iterable<string>) {
  const used = new Set(Array.from(usedSlugs, (slug) => slug.toLowerCase()));
  let slug = baseSlug;
  let index = 2;
  while (used.has(slug.toLowerCase())) {
    slug = `${baseSlug}-${index}`;
    index += 1;
  }
  return slug;
}

export function isValidChannelSlug(slug: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}
