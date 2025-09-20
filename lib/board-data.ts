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
};

export function getBoardChannelContext(
  boardSlug: string,
  channelSlug: string,
): BoardChannelContext | null {
  const [board] = db
    .select()
    .from(boards)
    .where(eq(boards.slug, boardSlug))
    .limit(1)
    .all();

  if (!board) {
    return null;
  }

  const boardChannels = db
    .select()
    .from(channels)
    .where(eq(channels.boardId, board.id))
    .orderBy(asc(channels.orderIndex), asc(channels.createdAt))
    .all();

  const activeChannel = boardChannels.find((channel) => channel.slug === channelSlug) ?? null;

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
  };
}
