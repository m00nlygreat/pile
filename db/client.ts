import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

const databasePath = path.resolve(process.cwd(), "data", "pile.db");

const sqlite = new Database(databasePath);

export const db = drizzle(sqlite, { schema });

export type DatabaseInstance = typeof db;
