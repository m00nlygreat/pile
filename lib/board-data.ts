import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import {
  anonUsers,
  boards,
  channels,
  type Board,
  type Channel,
  type Item,
  items,
  type AnonUser,
} from "@/db/schema";

type ChannelItemRecord = {
  item: Item;
  author: AnonUser | null;
};

export type BoardChannelContext = {
  board: Board;
  channels: Channel[];
  activeChannel: Channel | null;
  items: ChannelItemRecord[];
  boardExists: boolean;
};

export function getBoardChannelContext(
  boardSlug: string,
  channelSlug?: string | null,
): BoardChannelContext {
  const [board] = db
    .select()
    .from(boards)
    .where(eq(boards.slug, boardSlug))
    .limit(1)
    .all();

  if (!board) {
    return {
      board: createPlaceholderBoard(boardSlug),
      channels: [],
      activeChannel: null,
      items: [],
      boardExists: false,
    };
  }

  const boardChannels = db
    .select()
    .from(channels)
    .where(eq(channels.boardId, board.id))
    .orderBy(asc(channels.orderIndex), asc(channels.createdAt))
    .all();

  let activeChannel: Channel | null = null;

  if (channelSlug) {
    activeChannel = boardChannels.find((channel) => channel.slug === channelSlug) ?? null;
  } else if (board.defaultChannelId) {
    activeChannel =
      boardChannels.find((channel) => channel.id === board.defaultChannelId) ?? boardChannels.at(0) ?? null;
  } else {
    activeChannel = boardChannels.at(0) ?? null;
  }

  const channelItems = activeChannel
    ? db
        .select({ item: items, author: anonUsers })
        .from(items)
        .leftJoin(anonUsers, eq(items.anonUserId, anonUsers.id))
        .where(and(eq(items.boardId, board.id), eq(items.channelId, activeChannel.id)))
        .orderBy(desc(items.sessionStart), desc(items.createdAt))
        .all()
    : [];

  return {
    board,
    channels: boardChannels,
    activeChannel,
    items: channelItems,
    boardExists: true,
  };
}

function createPlaceholderBoard(slug: string): Board {
  const fallbackName = slug.trim().length > 0 ? slug : "새 보드";

  return {
    id: `virtual-${slug}`,
    name: fallbackName,
    slug,
    description: null,
    defaultChannelId: null,
    sessionBlockMinutes: 60,
    sessionAnchor: "00:00",
    createdAt: new Date(),
    updatedAt: new Date(),
  } satisfies Board;
}
