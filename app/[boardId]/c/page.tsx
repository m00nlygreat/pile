import BoardShortcutPage from "@/components/BoardShortcutPage";

export const dynamic = "force-dynamic";

export default function BoardCopyShortcutPage({ params }: { params: Promise<{ boardId: string }> }) {
  return <BoardShortcutPage params={params} operation="copy" />;
}
