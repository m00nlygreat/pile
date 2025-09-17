import { nanoid } from 'nanoid';

export function createId(prefix?: string) {
  return prefix ? `${prefix}_${nanoid(12)}` : nanoid(12);
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export function nowUnixSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function isPresent(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
