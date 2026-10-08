import { latestChannelItemResponse } from "@/lib/item-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ boardId: string; channelId: string }> }) {
  const { boardId: rawBoardId, channelId: rawChannelId } = await params;
  return latestChannelItemResponse(request, decodeURIComponent(rawBoardId), decodeURIComponent(rawChannelId));
}
