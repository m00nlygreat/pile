import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import Database from "better-sqlite3";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { createBoardWithDefaultChannel } from "./commands";
import * as schema from "./schema";
import { boards, channels, items } from "./schema";

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
    const { boardId, defaultChannelId } = createBoardWithDefaultChannel(db, {
      name: "기본 보드",
      slug: "default",
      description: "처음 사용할 수 있는 기본 보드",
    });
    seedBoardPreviewItems(db, boardId, defaultChannelId);
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

  let resolvedDefaultChannelId = existingBoard.defaultChannelId ?? null;

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

    resolvedDefaultChannelId = defaultChannelId;
  } else {
    if (!existingBoard.defaultChannelId) {
      db
        .update(boards)
        .set({ defaultChannelId: existingDefaultChannel.id })
        .where(eq(boards.id, existingBoard.id))
        .run();
    }

    resolvedDefaultChannelId = existingDefaultChannel.id;
  }

  if (resolvedDefaultChannelId) {
    seedBoardPreviewItems(db, existingBoard.id, resolvedDefaultChannelId);
  }
}

function seedBoardPreviewItems(
  db: DatabaseInstance,
  boardId: string,
  defaultChannelId: string,
) {
  const existingItem = db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.boardId, boardId))
    .limit(1)
    .all()[0];

  if (existingItem) {
    return;
  }

  const previewItems: typeof items.$inferInsert[] = [
    {
      id: randomUUID(),
      boardId,
      channelId: defaultChannelId,
      type: "text",
      textMd: "pile 데모 보드에 오신 것을 환영합니다! 이 텍스트 아이템은 임시로 채워둔 안내 메시지입니다.",
    },
    {
      id: randomUUID(),
      boardId,
      channelId: defaultChannelId,
      type: "text",
      textMd: "자료를 붙여넣으면 이렇게 바로 목록으로 나타납니다. 링크나 파일도 같은 자리에서 관리할 수 있어요.",
    },
    {
      id: randomUUID(),
      boardId,
      channelId: defaultChannelId,
      type: "text",
      textMd: "채널을 추가하면 이 보드에서 바로 확인할 수 있습니다. 임시 아이템은 언제든 실제 자료로 교체하세요!",
    },
  ];

  db.insert(items)
    .values(previewItems)
    .run();
}
