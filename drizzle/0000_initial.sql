CREATE TABLE IF NOT EXISTS boards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  default_channel_id TEXT,
  session_block_minutes INTEGER NOT NULL DEFAULT 60,
  session_anchor TEXT NOT NULL DEFAULT '00:00',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS boards_slug_unique ON boards(slug);

CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS channels_board_slug_unique ON channels(board_id, slug);

CREATE TABLE IF NOT EXISTS anon_users (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  display_name TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_seen_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  board_id TEXT NOT NULL,
  anon_user_id TEXT,
  type TEXT NOT NULL,
  text_md TEXT,
  file_path TEXT,
  file_mime TEXT,
  file_size INTEGER,
  file_original_name TEXT,
  link_url TEXT,
  link_title TEXT,
  link_desc TEXT,
  link_image TEXT,
  session_start INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS board_members (
  board_id TEXT NOT NULL,
  anon_user_id TEXT NOT NULL,
  joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (board_id, anon_user_id)
);

CREATE INDEX IF NOT EXISTS idx_items_board ON items(board_id);
CREATE INDEX IF NOT EXISTS idx_items_channel ON items(channel_id);
CREATE INDEX IF NOT EXISTS idx_items_created ON items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_session ON items(session_start);
