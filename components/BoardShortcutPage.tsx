import { notFound } from "next/navigation";
import { PileBoard } from "@/components/PileBoard";
import { getBoardPayload, isAdminRequest } from "@/lib/db";

type BoardShortcutPageProps = {
  params: Promise<{ boardId: string; channelId?: string }>;
  operation: "paste";
};

export default async function BoardShortcutPage({ params, operation }: BoardShortcutPageProps) {
  const { boardId: rawBoardId, channelId: rawChannelId } = await params;
  const boardId = decodeURIComponent(rawBoardId);
  const channelSlug = rawChannelId ? decodeURIComponent(rawChannelId) : undefined;
  const includeHidden = await isAdminRequest();
  const initialData = getBoardPayload(boardId, includeHidden);
  const channel = channelSlug
    ? initialData.channels.find((item) => item.slug === channelSlug)
    : initialData.channels.find((item) => item.id === "default") ?? initialData.channels[0];

  if (!channel) notFound();

  return (
    <PileBoard
      boardId={boardId}
      initialChannelSlug={channel.slug}
      initialData={initialData}
      initialShortcut={operation}
    />
  );
}
