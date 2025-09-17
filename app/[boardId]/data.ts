import { desc, eq } from 'drizzle-orm';

import { anonUsers, boards, channels, db, items } from '@/lib/db';
import type { ItemWithRelations } from '@/components/item-card';

export async function fetchBoardData(slug: string) {
  const board = db.select().from(boards).where(eq(boards.slug, slug)).get();
  if (!board) return null;

  const channelList = db
    .select()
    .from(channels)
    .where(eq(channels.boardId, board.id))
    .orderBy(channels.orderIndex)
    .all();

  const itemRows = db
    .select({
      item: items,
      channel: channels,
      anon: anonUsers
    })
    .from(items)
    .where(eq(items.boardId, board.id))
    .leftJoin(channels, eq(items.channelId, channels.id))
    .leftJoin(anonUsers, eq(items.anonUserId, anonUsers.id))
    .orderBy(desc(items.createdAt))
    .limit(200)
    .all();

  const mapped: ItemWithRelations[] = itemRows
    .map((row) => {
      if (!row.item || !row.channel) return null;
      return {
        id: row.item.id,
        type: row.item.type as ItemWithRelations['type'],
        textMd: row.item.textMd,
        filePath: row.item.filePath,
        fileMime: row.item.fileMime,
        fileSize: row.item.fileSize ?? undefined,
        fileOriginalName: row.item.fileOriginalName,
        linkUrl: row.item.linkUrl,
        linkTitle: row.item.linkTitle,
        linkDesc: row.item.linkDesc,
        linkImage: row.item.linkImage,
        createdAt: Number(row.item.createdAt),
        sessionStart: row.item.sessionStart ?? undefined,
        channel: {
          id: row.channel.id,
          name: row.channel.name,
          slug: row.channel.slug
        },
        anonUser: row.anon
          ? {
              id: row.anon.id,
              nickname: row.anon.nickname,
              displayName: row.anon.displayName
            }
          : null
      } satisfies ItemWithRelations;
    })
    .filter(Boolean) as ItemWithRelations[];

  return { board, channels: channelList, items: mapped };
}
