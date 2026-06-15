import { NextResponse } from "next/server";
import { setAdminSession } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as { enabled?: boolean; password?: string };
  const enabled = Boolean(body.enabled);

  if (enabled) {
    const expectedPassword = process.env.ADMIN_PASSWORD ?? "password";
    if (body.password !== expectedPassword) {
      await setAdminSession(false);
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }
  }

  await setAdminSession(enabled);
  return NextResponse.json({ admin: enabled });
}
