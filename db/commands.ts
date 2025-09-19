import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import type { DatabaseInstance } from "./client";
import { boards, channels } from "./schema";

export type CreateBoardOptions = {
  name: string;
  slug: string;
  description?: string | null;
  sessionBlockMinutes?: number;
  sessionAnchor?: string;
};

export type CreateBoardResult = {
  boardId: string;
  defaultChannelId: string;
};

export function createBoardWithDefaultChannel(
  db: DatabaseInstance,
  options: CreateBoardOptions,
): CreateBoardResult {
  const boardId = randomUUID();
  const defaultChannelId = randomUUID();

  const boardValues: typeof boards.$inferInsert = {
    id: boardId,
    name: options.name,
    slug: options.slug,
    description: options.description ?? null,
  };

  if (typeof options.sessionBlockMinutes === "number") {
    boardValues.sessionBlockMinutes = options.sessionBlockMinutes;
  }

  if (typeof options.sessionAnchor === "string") {
    boardValues.sessionAnchor = options.sessionAnchor;
  }

  db.transaction((tx) => {
    tx.insert(boards)
      .values(boardValues)
      .run();

    tx.insert(channels)
      .values({
        id: defaultChannelId,
        boardId,
        name: "공유",
        slug: "default",
        orderIndex: 0,
      })
      .run();

    tx.update(boards)
      .set({
        defaultChannelId,
      })
      .where(eq(boards.id, boardId))
      .run();
  });

  return { boardId, defaultChannelId };
}
