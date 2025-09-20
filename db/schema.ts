import { desc, sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";

const tables = {} as {
  boards: { id: AnySQLiteColumn };
  channels: { id: AnySQLiteColumn };
};

export const boards = sqliteTable(
  "boards",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    defaultChannelId: text("default_channel_id").references(
      () => tables.channels.id,
      {
        onDelete: "set null",
      },
    ),
    sessionBlockMinutes: integer("session_block_minutes").notNull().default(60),
    sessionAnchor: text("session_anchor").notNull().default("00:00"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    slugUnique: uniqueIndex("boards_slug_unique").on(table.slug),
  }),
);

export const channels = sqliteTable(
  "channels",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id")
      .notNull()
      .references(() => tables.boards.id, {
        onDelete: "cascade",
      }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    boardIdIdx: index("idx_channels_board").on(table.boardId),
    boardSlugUnique: uniqueIndex("channels_board_slug_unique").on(
      table.boardId,
      table.slug,
    ),
  }),
);

export const anonUsers = sqliteTable("anon_users", {
  id: text("id").primaryKey(),
  nickname: text("nickname").notNull(),
  displayName: text("display_name"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const items = sqliteTable(
  "items",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    anonUserId: text("anon_user_id").references(() => anonUsers.id, {
      onDelete: "set null",
    }),
    type: text("type", {
      enum: ["text", "file", "link"],
    })
      .$type<"text" | "file" | "link">()
      .notNull(),
    textMd: text("text_md"),
    filePath: text("file_path"),
    fileMime: text("file_mime"),
    fileSize: integer("file_size"),
    fileOriginalName: text("file_original_name"),
    linkUrl: text("link_url"),
    linkTitle: text("link_title"),
    linkDesc: text("link_desc"),
    linkImage: text("link_image"),
    sessionStart: integer("session_start", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    boardIdx: index("idx_items_board").on(table.boardId),
    channelIdx: index("idx_items_channel").on(table.channelId),
    createdAtIdx: index("idx_items_created").on(desc(table.createdAt)),
    sessionIdx: index("idx_items_session").on(table.sessionStart),
  }),
);

export const boardMembers = sqliteTable(
  "board_members",
  {
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    anonUserId: text("anon_user_id")
      .notNull()
      .references(() => anonUsers.id, { onDelete: "cascade" }),
    joinedAt: integer("joined_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    pk: primaryKey({
      name: "board_members_board_id_anon_user_id_pk",
      columns: [table.boardId, table.anonUserId],
    }),
  }),
);

tables.boards = boards;
tables.channels = channels;

export type Board = typeof boards.$inferSelect;
export type NewBoard = typeof boards.$inferInsert;
export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type AnonUser = typeof anonUsers.$inferSelect;
export type NewAnonUser = typeof anonUsers.$inferInsert;
export type BoardMember = typeof boardMembers.$inferSelect;
export type NewBoardMember = typeof boardMembers.$inferInsert;
