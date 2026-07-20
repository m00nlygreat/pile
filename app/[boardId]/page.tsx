import { redirect } from "next/navigation";
import { PileBoard } from "@/components/PileBoard";
import { getBoardPayload } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const decodedBoardId = decodeURIComponent(boardId);
  const payload = getBoardPayload(decodedBoardId);
  const defaultChannel = payload.channels.find((channel) => channel.id === "default");
  if (!defaultChannel && payload.channels[0]) {
    redirect(`/${encodeURIComponent(decodedBoardId)}/${encodeURIComponent(payload.channels[0].slug)}`);
  }
  return <PileBoard boardId={decodedBoardId} initialChannelSlug={defaultChannel?.slug} initialData={payload} />;
}
