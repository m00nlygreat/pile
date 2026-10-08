import BoardShortcutPage from "@/components/BoardShortcutPage";

export const dynamic = "force-dynamic";

export default function ChannelCopyShortcutPage({ params }: { params: Promise<{ boardId: string; channelId: string }> }) {
  return <BoardShortcutPage params={params} operation="copy" />;
}
