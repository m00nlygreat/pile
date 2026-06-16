import { notFound } from "next/navigation";
import { PileBoard } from "@/components/PileBoard";
import { channelSlugExists, getBoardPayload } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ChannelPage({ params }: { params: Promise<{ boardId: string; channelId: string }> }) {
  const { boardId, channelId } = await params;
  const decodedBoardId = decodeURIComponent(boardId);
  const decodedChannelId = decodeURIComponent(channelId);

  if (!channelSlugExists(decodedBoardId, decodedChannelId)) {
    notFound();
  }

  return <PileBoard boardId={decodedBoardId} initialChannelSlug={decodedChannelId} initialData={getBoardPayload(decodedBoardId)} />;
}
