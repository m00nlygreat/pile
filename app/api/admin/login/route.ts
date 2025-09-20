import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  createAdminCookieValue,
  getAdminCookieAttributes,
  getAdminDisplayName,
  getAdminPassword,
} from "@/lib/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let password: string | null = null;

  try {
    const data = (await request.json()) as { password?: unknown };
    password = typeof data.password === "string" ? data.password : null;
  } catch {
    // no-op, we'll treat as missing password
  }

  if (!password) {
    return NextResponse.json({ error: "비밀번호를 입력해주세요." }, { status: 400 });
  }

  const expectedPassword = getAdminPassword();
  if (password !== expectedPassword) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const cookieValue = createAdminCookieValue();
  const response = NextResponse.json({ ok: true, adminName: getAdminDisplayName() });
  response.cookies.set(getAdminCookieAttributes(cookieValue));
  response.headers.set("Cache-Control", "no-store");

  return response;
}
