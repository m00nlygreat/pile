import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { boards, channels } from "@/db/schema";

type BoardPageProps = {
  params: {
    boardId: string;
  };
};

type ChannelSlugRow = {
  slug: string;
} | null;

type BoardSummary = {
  slug: string;
  name: string;
  description: string | null;
};

type ChannelResolutionResult =
  | { type: "redirect"; slug: string }
  | { type: "empty" }
  | { type: "invalid"; reason: "blank-slug"; source: "default" | "first" };

export function resolveBoardChannelTarget({
  defaultChannel,
  fallbackChannel,
}: {
  defaultChannel: ChannelSlugRow;
  fallbackChannel: ChannelSlugRow;
}): ChannelResolutionResult {
  if (defaultChannel) {
    const trimmedDefaultSlug = defaultChannel.slug.trim();

    if (trimmedDefaultSlug.length === 0) {
      return { type: "invalid", reason: "blank-slug", source: "default" };
    }

    return { type: "redirect", slug: trimmedDefaultSlug };
  }

  if (!fallbackChannel) {
    return { type: "empty" };
  }

  const trimmedFallbackSlug = fallbackChannel.slug.trim();

  if (trimmedFallbackSlug.length === 0) {
    return { type: "invalid", reason: "blank-slug", source: "first" };
  }

  return { type: "redirect", slug: trimmedFallbackSlug };
}

export const dynamic = "force-dynamic";

export default async function BoardPage({ params }: BoardPageProps) {
  const boardSlug = decodeURIComponent(params.boardId);

  const boardRecord = db
    .select({
      id: boards.id,
      slug: boards.slug,
      name: boards.name,
      description: boards.description,
      defaultChannelId: boards.defaultChannelId,
    })
    .from(boards)
    .where(eq(boards.slug, boardSlug))
    .limit(1)
    .all()[0];

  if (!boardRecord) {
    notFound();
  }

  const boardSummary: BoardSummary = {
    slug: boardRecord.slug,
    name: boardRecord.name,
    description: boardRecord.description ?? null,
  };

  if (boardRecord.defaultChannelId) {
    const channel =
      db
        .select({ slug: channels.slug })
        .from(channels)
        .where(eq(channels.id, boardRecord.defaultChannelId))
        .limit(1)
        .all()[0] ?? null;

    const resolution = resolveBoardChannelTarget({
      defaultChannel: channel,
      fallbackChannel: null,
    });

    if (resolution.type === "redirect") {
      redirect(`/${boardRecord.slug}/${resolution.slug}`);
    }

    if (resolution.type === "invalid") {
      notFound();
    }
  }

  const fallbackChannel =
    db
      .select({ slug: channels.slug })
      .from(channels)
      .where(eq(channels.boardId, boardRecord.id))
      .orderBy(asc(channels.orderIndex), asc(channels.createdAt))
      .limit(1)
      .all()[0] ?? null;

  const resolution = resolveBoardChannelTarget({
    defaultChannel: null,
    fallbackChannel,
  });

  if (resolution.type === "redirect") {
    redirect(`/${boardRecord.slug}/${resolution.slug}`);
  }

  if (resolution.type === "invalid") {
    notFound();
  }

  return <BoardEmptyState board={boardSummary} />;
}

function BoardEmptyState({ board }: { board: BoardSummary }) {
  return (
    <div className="board-empty">
      <header className="board-header">
        <div className="board-title-row">
          <span className="board-slug">/{board.slug}</span>
          <h1>{board.name}</h1>
        </div>
        {board.description ? (
          <p className="board-description">{board.description}</p>
        ) : (
          <p className="board-description board-description--muted">
            설명이 아직 등록되지 않았습니다.
          </p>
        )}
      </header>
      <div className="channel-empty-state" role="status">
        <h2>채널이 아직 없습니다</h2>
        <p>
          관리자가 새 채널을 만들면 이 보드에서 메시지를 주고받을 수 있습니다.
        </p>
      </div>
    </div>
  );
}
