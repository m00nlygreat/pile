export const RECENT_BOARDS_KEY = "pile:recent-boards";

const MAX_RECENT_BOARDS = 12;

export function readRecentBoards() {
  if (typeof window === "undefined") return [];
  try {
    const saved = JSON.parse(window.localStorage.getItem(RECENT_BOARDS_KEY) ?? "[]") as unknown;
    if (!Array.isArray(saved)) return [];
    return [...new Set(saved.filter((boardId): boardId is string => typeof boardId === "string" && Boolean(boardId.trim())).map((boardId) => boardId.trim()))].slice(0, MAX_RECENT_BOARDS);
  } catch {
    return [];
  }
}

export function rememberBoard(boardId: string) {
  if (typeof window === "undefined") return;
  const normalized = boardId.trim();
  if (!normalized) return;
  try {
    const next = [normalized, ...readRecentBoards().filter((saved) => saved !== normalized)].slice(0, MAX_RECENT_BOARDS);
    window.localStorage.setItem(RECENT_BOARDS_KEY, JSON.stringify(next));
  } catch {
    // Browsing still works when storage is blocked or unavailable.
  }
}
