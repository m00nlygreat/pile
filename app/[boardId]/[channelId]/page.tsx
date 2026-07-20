import { notFound, redirect } from "next/navigation";
import { PileBoard } from "@/components/PileBoard";
import { getBoardPayload, getChannelBySlug } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ChannelPage({ params }: { params: Promise<{ boardId: string; channelId: string }> }) {
  const { boardId, channelId } = await params;
  const decodedBoardId = decodeURIComponent(boardId);
  const decodedChannelId = decodeURIComponent(channelId);

  const channel = getChannelBySlug(decodedBoardId, decodedChannelId);
  if (!channel) {
    notFound();
  }

  if (channel.id === "default") {
    redirect(`/${encodeURIComponent(decodedBoardId)}`);
  }

  return <PileBoard boardId={decodedBoardId} initialChannelSlug={decodedChannelId} initialData={getBoardPayload(decodedBoardId)} />;
}
