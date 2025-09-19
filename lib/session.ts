const DAY_IN_MS = 86_400_000;
const DEFAULT_BLOCK_MINUTES = 60;

export type CalculateSessionStartOptions = {
  sessionAnchor?: string | null;
  sessionBlockMinutes?: number | null;
  now?: Date;
};

function parseAnchor(anchor: string | null | undefined): { hours: number; minutes: number } | null {
  if (!anchor) {
    return null;
  }

  const trimmed = anchor.trim();
  const match = /^([0-1]\d|2[0-3]):([0-5]\d)$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const hours = Number.parseInt(match[1] ?? "", 10);
  const minutes = Number.parseInt(match[2] ?? "", 10);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return { hours, minutes };
}

export function calculateSessionStart({
  sessionAnchor,
  sessionBlockMinutes,
  now,
}: CalculateSessionStartOptions): Date | null {
  const anchor = parseAnchor(sessionAnchor ?? null);
  if (!anchor) {
    return null;
  }

  const blockMinutesRaw =
    typeof sessionBlockMinutes === "number" ? sessionBlockMinutes : DEFAULT_BLOCK_MINUTES;
  const blockMinutes = Number.isFinite(blockMinutesRaw) && blockMinutesRaw > 0
    ? blockMinutesRaw
    : DEFAULT_BLOCK_MINUTES;

  const referenceNow = now ? new Date(now) : new Date();
  if (Number.isNaN(referenceNow.getTime())) {
    return null;
  }

  const anchorDate = new Date(referenceNow);
  anchorDate.setMilliseconds(0);
  anchorDate.setSeconds(0);
  anchorDate.setHours(anchor.hours, anchor.minutes, 0, 0);

  const blockMs = blockMinutes * 60 * 1000;

  let referenceTime = anchorDate.getTime();
  if (referenceNow.getTime() < anchorDate.getTime()) {
    referenceTime -= DAY_IN_MS;
  }

  const diffMs = referenceNow.getTime() - referenceTime;
  let blocksSinceAnchor = Math.floor(diffMs / blockMs);
  if (!Number.isFinite(blocksSinceAnchor)) {
    blocksSinceAnchor = 0;
  }

  let sessionStartTime = referenceTime + blocksSinceAnchor * blockMs;
  if (sessionStartTime > referenceNow.getTime()) {
    sessionStartTime -= blockMs;
  }

  return new Date(sessionStartTime);
}
