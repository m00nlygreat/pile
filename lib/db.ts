import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { cookies } from "next/headers";
import { DatabaseSync } from "node:sqlite";
import { DEFAULT_CHANNELS, seedChannels } from "@/lib/seed";
import { slugFromChannelName, uniqueSlug } from "@/lib/slug";
import type { BoardPayload, ChannelRecord, FilePayload, ItemRecord, LinkPayload, UserRecord } from "@/lib/types";

const DB_PATH = process.env.PILE_DB_PATH || join(process.cwd(), "data", "pile.sqlite");
let db: DatabaseSync | null = null;

function getDb() {
  if (!db) {
    const dbDir = dirname(DB_PATH);
    try {
      mkdirSync(dbDir, { recursive: true });
      db = new DatabaseSync(DB_PATH);
    } catch (error) {
      console.error("[pile] Failed to open SQLite database", { dbPath: DB_PATH, dbDir });
      throw error;
    }
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
        slug TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'standard',
        position INTEGER NOT NULL,
        PRIMARY KEY (board_id, id)
      );
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        board_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        type TEXT NOT NULL,
        user_id TEXT,
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
      CREATE TABLE IF NOT EXISTS board_users (
        board_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        nick TEXT NOT NULL,
        display TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (board_id, user_id)
      );
    `);
    migrateChannelSlugs(db);
    migrateChannelTypes(db);
    migrateUserProfiles(db);
  }
  return db;
}

function json<T>(value: unknown): T {
  return JSON.parse(String(value)) as T;
}

function tryJson<T>(value: unknown): T | null {
  try {
    return json<T>(value);
  } catch {
    return null;
  }
}

function migrateChannelSlugs(conn: DatabaseSync) {
  const columns = conn.prepare("PRAGMA table_info(channels)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "slug")) {
    conn.exec("ALTER TABLE channels ADD COLUMN slug TEXT NOT NULL DEFAULT ''");
  }
  const rows = conn
    .prepare("SELECT id, board_id as boardId, name, slug, position FROM channels ORDER BY board_id ASC, position ASC")
    .all() as { id: string; boardId: string; name: string; slug: string; position: number }[];
  const usedByBoard = new Map<string, Set<string>>();
  const update = conn.prepare("UPDATE channels SET slug = ? WHERE board_id = ? AND id = ?");
  rows.forEach((row) => {
    const used = usedByBoard.get(row.boardId) ?? new Set<string>();
    usedByBoard.set(row.boardId, used);
    const base = row.id === "default" ? "default" : slugFromChannelName(row.name);
    const current = row.slug?.trim();
    const slug = current && !used.has(current.toLowerCase()) ? current : uniqueSlug(base, used);
    used.add(slug.toLowerCase());
    if (slug !== current) update.run(slug, row.boardId, row.id);
  });
}

function migrateChannelTypes(conn: DatabaseSync) {
  const columns = conn.prepare("PRAGMA table_info(channels)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "type")) {
    conn.exec("ALTER TABLE channels ADD COLUMN type TEXT NOT NULL DEFAULT 'standard'");
  }
}

function migrateUserProfiles(conn: DatabaseSync) {
  const columns = conn.prepare("PRAGMA table_info(items)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "user_id")) {
    conn.exec("ALTER TABLE items ADD COLUMN user_id TEXT");
  }
  const rows = conn.prepare("SELECT id, board_id, user_json, t FROM items WHERE user_id IS NULL OR user_id = ''").all() as {
    id: string;
    board_id: string;
    user_json: string;
    t: number;
  }[];
  const updateItem = conn.prepare("UPDATE items SET user_id = ? WHERE id = ?");
  const upsertUser = conn.prepare(`
    INSERT INTO board_users (board_id, user_id, nick, display, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(board_id, user_id) DO UPDATE SET
      nick = excluded.nick,
      display = excluded.display,
      updated_at = excluded.updated_at
    WHERE excluded.updated_at >= board_users.updated_at
  `);
  rows.forEach((row) => {
    const user = tryJson<UserRecord>(row.user_json);
    if (!user?.id) return;
    const nick = user.nick || user.display || "익명";
    const display = user.display || nick;
    updateItem.run(user.id, row.id);
    upsertUser.run(row.board_id, user.id, nick, display, Number(row.t) || Date.now());
  });
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
  const insertChannel = conn.prepare("INSERT INTO channels (id, board_id, slug, name, type, position) VALUES (?, ?, ?, ?, ?, ?)");
  seedChannels(boardId).forEach((channel) => insertChannel.run(channel.id, channel.boardId, channel.slug, channel.name, channel.type, channel.position));
}

function boardExists(boardId: string) {
  return Boolean(getDb().prepare("SELECT 1 FROM boards WHERE id = ?").get(boardId));
}

export function getBoardPayload(boardId: string): BoardPayload {
  const conn = getDb();
  const boardRow = conn.prepare("SELECT id, display_name as displayName FROM boards WHERE id = ?").get(boardId) as
    | { id: string; displayName: string }
    | undefined;
  if (!boardRow) {
    return { board: { id: boardId, displayName: boardId }, channels: seedChannels(boardId), users: [], items: [], reactions: {} };
  }
  const board = boardRow ? { id: String(boardRow.id), displayName: String(boardRow.displayName) } : undefined;
  const channelRows = conn
    .prepare("SELECT id, board_id as boardId, slug, name, type, position FROM channels WHERE board_id = ? ORDER BY position ASC")
    .all(boardId) as ChannelRecord[];
  const channels: ChannelRecord[] = channelRows.map((row) => ({
    id: String(row.id),
    boardId: String(row.boardId),
    slug: String(row.slug),
    name: String(row.name),
    type: row.type === "submission" ? "submission" : "standard",
    position: Number(row.position),
  }));
  const itemRows = conn
    .prepare("SELECT * FROM items WHERE board_id = ? ORDER BY t DESC")
    .all(boardId) as Record<string, unknown>[];
  const userRows = conn
    .prepare("SELECT user_id as userId, nick, display FROM board_users WHERE board_id = ?")
    .all(boardId) as { userId: string; nick: string; display: string }[];
  const users = new Map(userRows.map((user) => [String(user.userId), user]));
  const boardUsers: UserRecord[] = userRows.map((user) => ({
    id: String(user.userId),
    nick: String(user.nick),
    display: String(user.display),
    admin: false,
  }));
  const items: ItemRecord[] = itemRows.map((row) => {
    const fallbackUser = json<UserRecord>(row.user_json);
    const userId = String(row.user_id || fallbackUser.id);
    const profile = users.get(userId);
    const nick = profile?.nick || fallbackUser.nick;
    const display = profile?.display || fallbackUser.display || nick;
    return {
      id: String(row.id),
      boardId: String(row.board_id),
      channel: String(row.channel),
      type: row.type as ItemRecord["type"],
      user: { ...fallbackUser, id: userId, nick, display },
      session: Number(row.session),
      t: Number(row.t),
      body: row.body == null ? undefined : String(row.body),
      link: row.link_json == null ? undefined : json<LinkPayload>(row.link_json),
      file: row.file_json == null ? undefined : json<FilePayload>(row.file_json),
      pinned: Number(row.pinned) === 1,
    };
  });
  const reactionRows = conn
    .prepare("SELECT item_id as itemId, emoji, user_id as userId FROM reactions WHERE item_id IN (SELECT id FROM items WHERE board_id = ?)")
    .all(boardId) as { itemId: string; emoji: string; userId: string }[];
  const reactions: BoardPayload["reactions"] = {};
  reactionRows.forEach((row) => {
    reactions[row.itemId] ??= {};
    reactions[row.itemId][row.emoji] ??= [];
    reactions[row.itemId][row.emoji].push(row.userId);
  });
  return { board: board ?? { id: boardId, displayName: boardId }, channels, users: boardUsers, items, reactions };
}

export function createChannel(boardId: string, name: string, type: ChannelRecord["type"] = "standard") {
  ensureBoard(boardId);
  const conn = getDb();
  const maxRow = conn.prepare("SELECT COALESCE(MAX(position), -1) as maxPos FROM channels WHERE board_id = ?").get(boardId) as { maxPos: number };
  const existing = conn.prepare("SELECT slug FROM channels WHERE board_id = ?").all(boardId) as { slug: string }[];
  const slug = uniqueSlug(slugFromChannelName(name), existing.map((channel) => channel.slug));
  const channel = { id: uid("ch"), boardId, slug, name, type, position: maxRow.maxPos + 1 };
  conn.prepare("INSERT INTO channels (id, board_id, slug, name, type, position) VALUES (?, ?, ?, ?, ?, ?)").run(
    channel.id,
    channel.boardId,
    channel.slug,
    channel.name,
    channel.type,
    channel.position,
  );
  return channel;
}

export function updateChannel(boardId: string, channelId: string, name: string, slug: string) {
  ensureBoard(boardId);
  const conn = getDb();
  const current = conn
    .prepare("SELECT id, board_id as boardId, slug, name, type, position FROM channels WHERE board_id = ? AND id = ?")
    .get(boardId, channelId) as ChannelRecord | undefined;
  if (!current) return { ok: false as const, reason: "not-found" as const };

  const duplicate = conn
    .prepare("SELECT 1 FROM channels WHERE board_id = ? AND lower(slug) = lower(?) AND id <> ?")
    .get(boardId, slug, channelId);
  if (duplicate) return { ok: false as const, reason: "duplicate-slug" as const };

  conn.prepare("UPDATE channels SET name = ?, slug = ? WHERE board_id = ? AND id = ?").run(name, slug, boardId, channelId);
  return {
    ok: true as const,
    channel: {
      id: String(current.id),
      boardId: String(current.boardId),
      slug,
      name,
      type: current.type === "submission" ? "submission" as const : "standard" as const,
      position: Number(current.position),
    },
  };
}

export function deleteChannel(boardId: string, channelId: string) {
  ensureBoard(boardId);
  const conn = getDb();
  const current = conn.prepare("SELECT 1 FROM channels WHERE board_id = ? AND id = ?").get(boardId, channelId);
  if (!current) return { ok: false as const, reason: "not-found" as const };

  const itemCount = conn.prepare("SELECT COUNT(*) as count FROM items WHERE board_id = ? AND channel = ?").get(boardId, channelId) as { count: number };
  conn.exec("BEGIN IMMEDIATE");
  try {
    conn
      .prepare("DELETE FROM reactions WHERE item_id IN (SELECT id FROM items WHERE board_id = ? AND channel = ?)")
      .run(boardId, channelId);
    conn.prepare("DELETE FROM items WHERE board_id = ? AND channel = ?").run(boardId, channelId);
    conn.prepare("DELETE FROM channels WHERE board_id = ? AND id = ?").run(boardId, channelId);
    conn.exec("COMMIT");
  } catch (error) {
    conn.exec("ROLLBACK");
    throw error;
  }
  return { ok: true as const, deletedItems: Number(itemCount.count) };
}

export function channelSlugExists(boardId: string, channelSlug: string) {
  if (!boardExists(boardId)) {
    return seedChannels(boardId).some((channel) => channel.slug === channelSlug);
  }
  return Boolean(getDb().prepare("SELECT 1 FROM channels WHERE board_id = ? AND slug = ?").get(boardId, channelSlug));
}

export function getChannelBySlug(boardId: string, channelSlug: string) {
  if (!boardExists(boardId)) {
    return seedChannels(boardId).find((channel) => channel.slug === channelSlug);
  }
  const row = getDb()
    .prepare("SELECT id, board_id as boardId, slug, name, type, position FROM channels WHERE board_id = ? AND slug = ?")
    .get(boardId, channelSlug) as ChannelRecord | undefined;
  if (!row) return undefined;
  return {
    id: String(row.id),
    boardId: String(row.boardId),
    slug: String(row.slug),
    name: String(row.name),
    type: row.type === "submission" ? "submission" as const : "standard" as const,
    position: Number(row.position),
  };
}

export function upsertBoardUser(boardId: string, user: UserRecord) {
  ensureBoard(boardId);
  const nick = user.nick || user.display || "익명";
  const display = user.display || nick;
  getDb()
    .prepare(`
      INSERT INTO board_users (board_id, user_id, nick, display, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(board_id, user_id) DO UPDATE SET
        nick = excluded.nick,
        display = excluded.display,
        updated_at = excluded.updated_at
    `)
    .run(boardId, user.id, nick, display, Date.now());
  return { ...user, nick, display, admin: false };
}

export function createItem(boardId: string, input: Omit<ItemRecord, "id" | "boardId" | "pinned"> & { id?: string }) {
  ensureBoard(boardId);
  upsertBoardUser(boardId, input.user);
  const item: ItemRecord = {
    ...input,
    id: input.id ?? uid("it"),
    boardId,
    pinned: false,
  };
  getDb()
    .prepare(
      "INSERT INTO items (id, board_id, channel, type, user_id, user_json, session, t, body, link_json, file_json, pinned) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)",
    )
    .run(
      item.id,
      item.boardId,
      item.channel,
      item.type,
      item.user.id,
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
  const row = conn.prepare("SELECT user_id, user_json FROM items WHERE id = ?").get(itemId) as { user_id?: string; user_json: string } | undefined;
  if (!row) return { ok: true, deleted: false };
  const owner = row.user_id || json<UserRecord>(row.user_json).id;
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
  if (!boardExists(boardId)) {
    return DEFAULT_CHANNELS.some((channel) => channel.id === channelId);
  }
  return Boolean(getDb().prepare("SELECT 1 FROM channels WHERE board_id = ? AND id = ?").get(boardId, channelId));
}
