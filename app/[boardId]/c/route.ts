import { latestChannelItemResponse } from "@/lib/item-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId: rawBoardId } = await params;
  return latestChannelItemResponse(request, decodeURIComponent(rawBoardId));
}
