import BoardShortcutPage from "@/components/BoardShortcutPage";

export const dynamic = "force-dynamic";

export default function BoardPasteShortcutPage({ params }: { params: Promise<{ boardId: string }> }) {
  return <BoardShortcutPage params={params} operation="paste" />;
}
