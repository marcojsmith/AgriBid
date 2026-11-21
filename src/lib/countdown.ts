const HOUR_MS = 60 * 60 * 1000;
const TWO_MIN_MS = 2 * 60 * 1000;

/** Visual tone of a countdown. */
export type CountdownTone = "neutral" | "warn" | "urgent";

/**
 * Chooses the countdown tone: neutral, amber under 1 hour, red under 2 minutes.
 *
 * @param remainingMs - Milliseconds left (must be above 0 to be coloured)
 * @returns The tone
 */
export function countdownTone(remainingMs: number): CountdownTone {
  if (remainingMs <= 0) return "neutral";
  if (remainingMs < TWO_MIN_MS) return "urgent";
  if (remainingMs < HOUR_MS) return "warn";
  return "neutral";
}

/**
 * Formats remaining milliseconds as `2d 3h 4m 5s` (leading zero units dropped).
 *
 * @param remainingMs - Milliseconds left (above 0)
 * @returns The compact duration text
 */
export function formatRemaining(remainingMs: number): string {
  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${String(days)}d`);
  if (hours > 0 || days > 0) parts.push(`${String(hours)}h`);
  parts.push(`${String(minutes)}m`, `${String(seconds)}s`);
  return parts.join(" ");
}
