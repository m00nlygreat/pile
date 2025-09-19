import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { boards, channels } from "@/db/schema";

import { BoardWorkspaceNotFound } from "./board-workspace-not-found";

type BoardPageProps = {
  params: {
    boardId: string;
  };
};

export const dynamic = "force-dynamic";

export default async function BoardPage({ params }: BoardPageProps) {
  const boardSlug = decodeURIComponent(params.boardId);

  const boardRecord = db
    .select({
      id: boards.id,
      slug: boards.slug,
      defaultChannelId: boards.defaultChannelId,
    })
    .from(boards)
    .where(eq(boards.slug, boardSlug))
    .limit(1)
    .all()[0];

  if (!boardRecord) {
    return <BoardWorkspaceNotFound boardSlug={boardSlug} />;
  }

  let resolvedChannelSlug: string | null = null;

  if (boardRecord.defaultChannelId) {
    const channel = db
      .select({ slug: channels.slug })
      .from(channels)
      .where(eq(channels.id, boardRecord.defaultChannelId))
      .limit(1)
      .all()[0];

    resolvedChannelSlug = channel?.slug ?? null;
  }

  if (!resolvedChannelSlug) {
    const fallbackChannel = db
      .select({ slug: channels.slug })
      .from(channels)
      .where(eq(channels.boardId, boardRecord.id))
      .orderBy(asc(channels.orderIndex), asc(channels.createdAt))
      .limit(1)
      .all()[0];

    resolvedChannelSlug = fallbackChannel?.slug ?? null;
  }

  if (!resolvedChannelSlug) {
    return (
      <BoardWorkspaceNotFound
        boardSlug={boardRecord.slug}
        heading="채널을 불러올 수 없어요"
        description="이 보드에는 아직 사용할 수 있는 채널이 없습니다. 관리자가 새 채널을 만들어 주세요."
      />
    );
  }

  redirect(`/${boardRecord.slug}/${resolvedChannelSlug}`);
}
