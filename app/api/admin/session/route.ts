import { NextResponse } from "next/server";
import { setAdminSession } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as { enabled?: boolean };
  await setAdminSession(Boolean(body.enabled));
  return NextResponse.json({ admin: Boolean(body.enabled) });
}
