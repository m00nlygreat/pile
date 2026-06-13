import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { cookies } from "next/headers";
import { DatabaseSync } from "node:sqlite";
import { DEFAULT_CHANNELS, seedChannels, seedItems, seedReactions } from "@/lib/seed";
import type { BoardPayload, ChannelRecord, FilePayload, ItemRecord, LinkPayload, UserRecord } from "@/lib/types";

const DB_PATH = join(process.cwd(), "data", "pile.sqlite");
let db: DatabaseSync | null = null;

function getDb() {
  if (!db) {
    mkdirSync(join(process.cwd(), "data"), { recursive: true });
    db = new DatabaseSync(DB_PATH);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS boards (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS channels (
        id TEXT NOT NULL,
        board_id TEXT NOT NULL,
        name TEXT NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (board_id, id)
      );
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        board_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        type TEXT NOT NULL,
        user_json TEXT NOT NULL,
        session INTEGER NOT NULL,
        t INTEGER NOT NULL,
        body TEXT,
        link_json TEXT,
        file_json TEXT,
        pinned INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS reactions (
        item_id TEXT NOT NULL,
        emoji TEXT NOT NULL,
        user_id TEXT NOT NULL,
        PRIMARY KEY (item_id, emoji, user_id)
      );
    `);
  }
  return db;
}

function json<T>(value: unknown): T {
  return JSON.parse(String(value)) as T;
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function isAdminRequest() {
  const jar = await cookies();
  return jar.get("pile_admin")?.value === "1";
}

export async function setAdminSession(enabled: boolean) {
  const jar = await cookies();
  jar.set("pile_admin", enabled ? "1" : "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: enabled ? 60 * 60 * 8 : 0,
  });
}

export function ensureBoard(boardId: string) {
  const conn = getDb();
  const exists = conn.prepare("SELECT id FROM boards WHERE id = ?").get(boardId);
  if (exists) return;
  conn.prepare("INSERT INTO boards (id, display_name, created_at) VALUES (?, ?, ?)").run(boardId, boardId, Date.now());
  const insertChannel = conn.prepare("INSERT INTO channels (id, board_id, name, position) VALUES (?, ?, ?, ?)");
  seedChannels(boardId).forEach((channel) => insertChannel.run(channel.id, channel.boardId, channel.name, channel.position));
  if (boardId === "frontend-101") {
    const insertItem = conn.prepare(`
      INSERT INTO items (id, board_id, channel, type, user_json, session, t, body, link_json, file_json, pinned)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    seedItems(boardId).forEach((item) => {
      insertItem.run(
        item.id,
        item.boardId,
        item.channel,
        item.type,
        JSON.stringify(item.user),
        item.session,
        item.t,
        item.body ?? null,
        item.link ? JSON.stringify(item.link) : null,
        item.file ? JSON.stringify(item.file) : null,
        item.pinned ? 1 : 0,
      );
    });
    const insertReaction = conn.prepare("INSERT OR IGNORE INTO reactions (item_id, emoji, user_id) VALUES (?, ?, ?)");
    Object.entries(seedReactions).forEach(([itemId, byEmoji]) => {
      Object.entries(byEmoji).forEach(([emoji, users]) => users.forEach((userId) => insertReaction.run(itemId, emoji, userId)));
    });
  }
}

export function getBoardPayload(boardId: string): BoardPayload {
  ensureBoard(boardId);
  const conn = getDb();
  const boardRow = conn.prepare("SELECT id, display_name as displayName FROM boards WHERE id = ?").get(boardId) as
    | { id: string; displayName: string }
    | undefined;
  const board = boardRow ? { id: String(boardRow.id), displayName: String(boardRow.displayName) } : undefined;
  const channelRows = conn
    .prepare("SELECT id, board_id as boardId, name, position FROM channels WHERE board_id = ? ORDER BY position ASC")
    .all(boardId) as ChannelRecord[];
  const channels: ChannelRecord[] = channelRows.map((row) => ({
    id: String(row.id),
    boardId: String(row.boardId),
    name: String(row.name),
    position: Number(row.position),
  }));
  const itemRows = conn
    .prepare("SELECT * FROM items WHERE board_id = ? ORDER BY t DESC")
    .all(boardId) as Record<string, unknown>[];
  const items: ItemRecord[] = itemRows.map((row) => ({
    id: String(row.id),
    boardId: String(row.board_id),
    channel: String(row.channel),
    type: row.type as ItemRecord["type"],
    user: json<UserRecord>(row.user_json),
    session: Number(row.session),
    t: Number(row.t),
    body: row.body == null ? undefined : String(row.body),
    link: row.link_json == null ? undefined : json<LinkPayload>(row.link_json),
    file: row.file_json == null ? undefined : json<FilePayload>(row.file_json),
    pinned: Number(row.pinned) === 1,
  }));
  const reactionRows = conn
    .prepare("SELECT item_id as itemId, emoji, user_id as userId FROM reactions WHERE item_id IN (SELECT id FROM items WHERE board_id = ?)")
    .all(boardId) as { itemId: string; emoji: string; userId: string }[];
  const reactions: BoardPayload["reactions"] = {};
  reactionRows.forEach((row) => {
    reactions[row.itemId] ??= {};
    reactions[row.itemId][row.emoji] ??= [];
    reactions[row.itemId][row.emoji].push(row.userId);
  });
  return { board: board ?? { id: boardId, displayName: boardId }, channels, items, reactions };
}

export function createChannel(boardId: string, name: string) {
  ensureBoard(boardId);
  const conn = getDb();
  const maxRow = conn.prepare("SELECT COALESCE(MAX(position), -1) as maxPos FROM channels WHERE board_id = ?").get(boardId) as { maxPos: number };
  const channel = { id: uid("ch"), boardId, name, position: maxRow.maxPos + 1 };
  conn.prepare("INSERT INTO channels (id, board_id, name, position) VALUES (?, ?, ?, ?)").run(
    channel.id,
    channel.boardId,
    channel.name,
    channel.position,
  );
  return channel;
}

export function createItem(boardId: string, input: Omit<ItemRecord, "id" | "boardId" | "pinned"> & { id?: string }) {
  ensureBoard(boardId);
  const item: ItemRecord = {
    ...input,
    id: input.id ?? uid("it"),
    boardId,
    pinned: false,
  };
  getDb()
    .prepare(
      "INSERT INTO items (id, board_id, channel, type, user_json, session, t, body, link_json, file_json, pinned) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)",
    )
    .run(
      item.id,
      item.boardId,
      item.channel,
      item.type,
      JSON.stringify(item.user),
      item.session,
      item.t,
      item.body ?? null,
      item.link ? JSON.stringify(item.link) : null,
      item.file ? JSON.stringify(item.file) : null,
    );
  return item;
}

export function setPinned(itemId: string, pinned: boolean) {
  getDb().prepare("UPDATE items SET pinned = ? WHERE id = ?").run(pinned ? 1 : 0, itemId);
}

export function deleteItem(itemId: string, userId: string, admin: boolean) {
  const conn = getDb();
  const row = conn.prepare("SELECT user_json FROM items WHERE id = ?").get(itemId) as { user_json: string } | undefined;
  if (!row) return { ok: true, deleted: false };
  const owner = json<UserRecord>(row.user_json).id;
  if (!admin && owner !== userId) return { ok: false, deleted: false };
  conn.prepare("DELETE FROM reactions WHERE item_id = ?").run(itemId);
  conn.prepare("DELETE FROM items WHERE id = ?").run(itemId);
  return { ok: true, deleted: true };
}

const POLL_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

export function toggleReaction(itemId: string, emoji: string, userId: string) {
  const conn = getDb();
  const current = conn.prepare("SELECT 1 FROM reactions WHERE item_id = ? AND emoji = ? AND user_id = ?").get(itemId, emoji, userId);
  if (current) {
    conn.prepare("DELETE FROM reactions WHERE item_id = ? AND emoji = ? AND user_id = ?").run(itemId, emoji, userId);
  } else {
    if (POLL_EMOJIS.includes(emoji)) {
      const placeholders = POLL_EMOJIS.map(() => "?").join(",");
      conn.prepare(`DELETE FROM reactions WHERE item_id = ? AND user_id = ? AND emoji IN (${placeholders})`).run(itemId, userId, ...POLL_EMOJIS);
    }
    conn.prepare("INSERT OR IGNORE INTO reactions (item_id, emoji, user_id) VALUES (?, ?, ?)").run(itemId, emoji, userId);
  }
}

export function defaultChannelExists(boardId: string, channelId: string) {
  ensureBoard(boardId);
  return (
    DEFAULT_CHANNELS.some((channel) => channel.id === channelId) ||
    Boolean(getDb().prepare("SELECT 1 FROM channels WHERE board_id = ? AND id = ?").get(boardId, channelId))
  );
}
