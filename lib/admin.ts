import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const ADMIN_COOKIE = 'is_admin';

function getSecret() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error('ADMIN_PASSWORD is not configured');
  }
  return password;
}

function expectedSignature() {
  const name = process.env.ADMIN_NAME ?? '관리자';
  const hmac = createHmac('sha256', getSecret());
  hmac.update(name);
  return hmac.digest('hex');
}

export function isAdmin() {
  const store = cookies();
  const cookie = store.get(ADMIN_COOKIE)?.value;
  if (!cookie) return false;
  try {
    const actual = Buffer.from(cookie, 'hex');
    const expected = Buffer.from(expectedSignature(), 'hex');
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch (error) {
    return false;
  }
}

export function assertAdmin() {
  if (!isAdmin()) {
    const err = new Error('Unauthorized');
    (err as Error & { status?: number }).status = 401;
    throw err;
  }
}

export function setAdminCookie() {
  const store = cookies();
  store.set(ADMIN_COOKIE, expectedSignature(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8
  });
}

export function clearAdminCookie() {
  const store = cookies();
  store.delete(ADMIN_COOKIE);
}

export function adminName() {
  return process.env.ADMIN_NAME ?? '관리자';
}
