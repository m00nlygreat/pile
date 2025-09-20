import { type Board } from "@/db/schema";

export function resolveSessionStart(board: Board, now: Date = new Date()): Date | null {
  const blockMinutes = Number(board.sessionBlockMinutes ?? 0);
  if (!Number.isFinite(blockMinutes) || blockMinutes <= 0) {
    return null;
  }

  const anchor = typeof board.sessionAnchor === "string" ? board.sessionAnchor : "00:00";
  const [anchorHour, anchorMinute] = anchor.split(":").map((part) => Number.parseInt(part, 10));

  const safeAnchorHour = Number.isFinite(anchorHour) && anchorHour >= 0 && anchorHour <= 23 ? anchorHour : 0;
  const safeAnchorMinute = Number.isFinite(anchorMinute) && anchorMinute >= 0 && anchorMinute <= 59 ? anchorMinute : 0;

  const anchorDate = new Date(now);
  anchorDate.setHours(safeAnchorHour, safeAnchorMinute, 0, 0);

  const dayMilliseconds = 24 * 60 * 60 * 1000;
  let anchorReference = anchorDate;

  if (now.getTime() < anchorDate.getTime()) {
    anchorReference = new Date(anchorDate.getTime() - dayMilliseconds);
  }

  const blockMilliseconds = blockMinutes * 60 * 1000;
  const elapsed = now.getTime() - anchorReference.getTime();
  const blocksPassed = Math.floor(elapsed / blockMilliseconds);

  return new Date(anchorReference.getTime() + blocksPassed * blockMilliseconds);
}
