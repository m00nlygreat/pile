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

  return null;
}
