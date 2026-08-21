import { notFound, redirect } from "next/navigation";
import { PileBoard } from "@/components/PileBoard";
import { getBoardPayload, getChannelBySlug, isAdminRequest } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ChannelPage({ params }: { params: Promise<{ boardId: string; channelId: string }> }) {
  const { boardId, channelId } = await params;
  const decodedBoardId = decodeURIComponent(boardId);
  const decodedChannelId = decodeURIComponent(channelId);
  const includeHidden = await isAdminRequest();

  const channel = getChannelBySlug(decodedBoardId, decodedChannelId, includeHidden);
  if (!channel) {
    notFound();
  }

  if (channel.id === "default") {
    redirect(`/${encodeURIComponent(decodedBoardId)}`);
  }

  return <PileBoard boardId={decodedBoardId} initialChannelSlug={decodedChannelId} initialData={getBoardPayload(decodedBoardId, includeHidden)} />;
}
