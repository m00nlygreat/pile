import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  redirect(`/${encodeURIComponent(decodeURIComponent(boardId))}/default`);
}
