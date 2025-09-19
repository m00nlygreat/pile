import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { boards, channels } from "@/db/schema";

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
      name: boards.name,
      slug: boards.slug,
      defaultChannelId: boards.defaultChannelId,
    })
    .from(boards)
    .where(eq(boards.slug, boardSlug))
    .limit(1)
    .all()[0];

  if (!boardRecord) {
    notFound();
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

  if (resolvedChannelSlug) {
    redirect(`/${boardRecord.slug}/${resolvedChannelSlug}`);
  }

  const boardDisplayName = boardRecord.name ?? boardRecord.slug;

  return (
    <div className="channel-view">
      <div className="channel-scroll">
        <div className="channel-empty-state">
          <h2>첫 채널을 만들어보세요</h2>
          <p>
            {boardDisplayName} 보드에는 아직 채널이 없습니다. 관리자 모드에서
            채널을 추가해 자료를 정리할 주제를 만들어보세요.
          </p>
          <p>
            채널이 생성되면 이 화면은 자동으로 첫 번째 채널로 이동합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
