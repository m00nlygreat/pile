import { getBoardPayload } from "@/lib/db";
import { PileBoard } from "@/components/PileBoard";

export const dynamic = "force-dynamic";

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const decodedBoardId = decodeURIComponent(boardId);
  return <PileBoard boardId={decodedBoardId} initialData={getBoardPayload(decodedBoardId)} />;
}
