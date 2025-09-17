import { addMinutes } from 'date-fns';

import type { Board } from './schema';

export function calculateSessionStart(board: Board, at = new Date()) {
  const [anchorHours, anchorMinutes] = board.sessionAnchor
    .split(':')
    .map((part) => parseInt(part, 10));

  if (Number.isNaN(anchorHours) || Number.isNaN(anchorMinutes)) {
    return new Date(at);
  }

  const anchor = new Date(at);
  anchor.setHours(anchorHours, anchorMinutes, 0, 0);

  if (anchor > at) {
    anchor.setDate(anchor.getDate() - 1);
  }

  const blockMinutes = board.sessionBlockMinutes || 60;
  const diffMs = at.getTime() - anchor.getTime();
  const blockMs = blockMinutes * 60 * 1000;
  const blocks = Math.floor(diffMs / blockMs);
  const sessionStart = addMinutes(anchor, blocks * blockMinutes);
  return sessionStart;
}
