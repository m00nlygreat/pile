import { relations } from 'drizzle-orm';
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const boards = sqliteTable(
  'boards',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    defaultChannelId: text('default_channel_id'),
    sessionBlockMinutes: integer('session_block_minutes').notNull().default(60),
    sessionAnchor: text('session_anchor').notNull().default('00:00'),
    createdAt: integer('created_at')
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at')
      .notNull()
      .default(sql`(unixepoch())`)
  },
  (board) => ({
    slugIndex: uniqueIndex('boards_slug_unique').on(board.slug)
  })
);

export const channels = sqliteTable(
  'channels',
  {
    id: text('id').primaryKey(),
    boardId: text('board_id').notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    orderIndex: integer('order_index').notNull().default(0),
    createdAt: integer('created_at')
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at')
      .notNull()
      .default(sql`(unixepoch())`)
  },
  (channel) => ({
    channelSlugIndex: uniqueIndex('channels_board_slug_unique').on(
      channel.boardId,
      channel.slug
    )
  })
);

export const anonUsers = sqliteTable('anon_users', {
  id: text('id').primaryKey(),
  nickname: text('nickname').notNull(),
  displayName: text('display_name'),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(unixepoch())`),
  lastSeenAt: integer('last_seen_at')
    .notNull()
    .default(sql`(unixepoch())`)
});

export const items = sqliteTable('items', {
  id: text('id').primaryKey(),
  channelId: text('channel_id').notNull(),
  boardId: text('board_id').notNull(),
  anonUserId: text('anon_user_id'),
  type: text('type').notNull(),
  textMd: text('text_md'),
  filePath: text('file_path'),
  fileMime: text('file_mime'),
  fileSize: integer('file_size'),
  fileOriginalName: text('file_original_name'),
  linkUrl: text('link_url'),
  linkTitle: text('link_title'),
  linkDesc: text('link_desc'),
  linkImage: text('link_image'),
  sessionStart: integer('session_start'),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at')
    .notNull()
    .default(sql`(unixepoch())`)
});

export const boardMembers = sqliteTable(
  'board_members',
  {
    boardId: text('board_id').notNull(),
    anonUserId: text('anon_user_id').notNull(),
    joinedAt: integer('joined_at')
      .notNull()
      .default(sql`(unixepoch())`)
  },
  (table) => ({
    pk: primaryKey({ columns: [table.boardId, table.anonUserId] })
  })
);

export const boardRelations = relations(boards, ({ many }) => ({
  channels: many(channels),
  items: many(items)
}));

export const channelRelations = relations(channels, ({ one, many }) => ({
  board: one(boards, {
    fields: [channels.boardId],
    references: [boards.id]
  }),
  items: many(items)
}));

export const itemRelations = relations(items, ({ one }) => ({
  channel: one(channels, {
    fields: [items.channelId],
    references: [channels.id]
  }),
  board: one(boards, {
    fields: [items.boardId],
    references: [boards.id]
  }),
  anonUser: one(anonUsers, {
    fields: [items.anonUserId],
    references: [anonUsers.id]
  })
}));

export type Board = typeof boards.$inferSelect;
export type Channel = typeof channels.$inferSelect;
export type Item = typeof items.$inferSelect;
export type AnonUser = typeof anonUsers.$inferSelect;
