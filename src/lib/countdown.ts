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
 * Formats remaining milliseconds compactly. Under one hour it shows minutes
 * and seconds (`42m 10s`); from one hour it shows the two largest units
 * (`23h 38m`, `5d 23h`), because seconds are noise on a long countdown.
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
  if (days > 0) return `${String(days)}d ${String(hours)}h`;
  if (hours > 0) return `${String(hours)}h ${String(minutes)}m`;
  return `${String(minutes)}m ${String(seconds)}s`;
}
