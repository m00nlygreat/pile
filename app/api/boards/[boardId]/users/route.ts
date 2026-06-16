import { NextResponse } from "next/server";
import { upsertBoardUser } from "@/lib/db";
import type { UserRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validUser(value: unknown): value is UserRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "nick" in value &&
      "display" in value &&
      typeof value.id === "string" &&
      typeof value.nick === "string" &&
      typeof value.display === "string",
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId: rawBoardId } = await params;
  const boardId = decodeURIComponent(rawBoardId);
  const body = (await request.json()) as unknown;
  if (!validUser(body)) {
    return NextResponse.json({ error: "사용자 정보가 필요합니다." }, { status: 400 });
  }
  return NextResponse.json(upsertBoardUser(boardId, body));
}
