import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "./schema";

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

export const db = dbInstance;

export type DatabaseInstance = typeof db;
