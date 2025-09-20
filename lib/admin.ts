import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE_NAME = "is_admin";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const ADMIN_COOKIE_VERSION = 1;
const DEFAULT_ADMIN_NAME = "관리자";
const DEFAULT_ADMIN_PASSWORD = "P@ssw0rd";

export function getAdminDisplayName(): string {
  const fromEnv = process.env.ADMIN_NAME?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_ADMIN_NAME;
}

export function getAdminPassword(): string {
  const fromEnv = process.env.ADMIN_PASSWORD;
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_ADMIN_PASSWORD;
}

function getAdminCookieSecret(): string {
  const fromEnv = process.env.ADMIN_COOKIE_SECRET;
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }
  return getAdminPassword();
}

function signAdminPayload(payload: string): string {
  return createHmac("sha256", getAdminCookieSecret()).update(payload).digest("base64url");
}

function constantTimeEqual(expected: string, actual: string): boolean {
  try {
    const expectedBuffer = Buffer.from(expected, "base64url");
    const actualBuffer = Buffer.from(actual, "base64url");

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
}

export function createAdminCookieValue(): string {
  const session = {
    v: ADMIN_COOKIE_VERSION,
    iat: Date.now(),
  } satisfies { v: number; iat: number };

  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  const signature = signAdminPayload(payload);
  return `${payload}.${signature}`;
}

export function verifyAdminCookie(cookieValue: string | null | undefined): boolean {
  if (!cookieValue) {
    return false;
  }

  const segments = cookieValue.split(".");
  if (segments.length !== 2) {
    return false;
  }

  const [payload, signature] = segments;
  const expectedSignature = signAdminPayload(payload);

  if (!constantTimeEqual(expectedSignature, signature)) {
    return false;
  }

  try {
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as { v?: number };
    return parsed.v === ADMIN_COOKIE_VERSION;
  } catch {
    return false;
  }
}

export function getAdminCookieAttributes(value: string) {
  return {
    name: ADMIN_COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  };
}

export function getAdminCookieClearAttributes() {
  return {
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}
