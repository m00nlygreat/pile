import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { unlinkSync } from "node:fs";
import { dirname, join } from "node:path";

const DB_PATH = process.env.PILE_DB_PATH || join(process.cwd(), "data", "pile.sqlite");
const FILE_DIR = process.env.PILE_FILE_DIR || join(dirname(DB_PATH), "uploads");
const SAFE_ID = /^[a-zA-Z0-9_-]+$/;

function pathFor(itemId: string) {
  if (!SAFE_ID.test(itemId)) throw new Error("Invalid file id");
  return join(FILE_DIR, itemId);
}

export async function saveStoredFile(itemId: string, bytes: Uint8Array) {
  await mkdir(FILE_DIR, { recursive: true });
  const destination = pathFor(itemId);
  const temporary = `${destination}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, bytes, { flag: "wx" });
  try {
    await rename(temporary, destination);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

export function readStoredFile(itemId: string) {
  return readFile(pathFor(itemId));
}

export async function deleteStoredFile(itemId: string) {
  await unlink(pathFor(itemId)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}

export function deleteStoredFileSync(itemId: string) {
  try {
    unlinkSync(pathFor(itemId));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
