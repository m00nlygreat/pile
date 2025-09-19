import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import Database from "better-sqlite3";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { createBoardWithDefaultChannel } from "./commands";
import * as schema from "./schema";
import { boards, channels } from "./schema";

const dataDirectory = path.resolve(process.cwd(), "data");

fs.mkdirSync(dataDirectory, { recursive: true });

const databasePath = path.join(dataDirectory, "pile.db");

const sqlite = new Database(databasePath);

const dbInstance = drizzle(sqlite, { schema });

const migrationsFolder = path.join(process.cwd(), "drizzle");
const migrationState = globalThis as {
  __pileDbMigrated?: boolean;
};

if (!migrationState.__pileDbMigrated) {
  migrate(dbInstance, { migrationsFolder });
  migrationState.__pileDbMigrated = true;
}

ensureDefaultBoard(dbInstance);

export const db = dbInstance;

export type DatabaseInstance = typeof db;

function ensureDefaultBoard(db: DatabaseInstance) {
  const existingBoard = db
    .select()
    .from(boards)
    .where(eq(boards.slug, "default"))
    .limit(1)
    .all()[0];

  if (!existingBoard) {
    createBoardWithDefaultChannel(db, {
      name: "기본 보드",
      slug: "default",
      description: "처음 사용할 수 있는 기본 보드",
    });
    return;
  }

  const existingDefaultChannel = db
    .select()
    .from(channels)
    .where(
      and(eq(channels.boardId, existingBoard.id), eq(channels.slug, "default")),
    )
    .limit(1)
    .all()[0];

  if (!existingDefaultChannel) {
    const defaultChannelId = randomUUID();

    db.transaction((tx) => {
      tx.insert(channels)
        .values({
          id: defaultChannelId,
          boardId: existingBoard.id,
          name: "공유",
          slug: "default",
          orderIndex: 0,
        })
        .run();

      tx.update(boards)
        .set({ defaultChannelId })
        .where(eq(boards.id, existingBoard.id))
        .run();
    });

    return;
  }

  if (!existingBoard.defaultChannelId) {
    db
      .update(boards)
      .set({ defaultChannelId: existingDefaultChannel.id })
      .where(eq(boards.id, existingBoard.id))
      .run();
  }
}
