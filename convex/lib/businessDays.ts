/** South Africa Standard Time is UTC+2 all year (no daylight saving). */
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Adds business days to a timestamp, counting in SAST (UTC+2, no DST).
 * Saturdays and Sundays are skipped and the time of day is kept, so Tue 11:00
 * plus 2 is Thu 11:00 and Fri 11:00 plus 2 is Tue 11:00.
 *
 * A start on a weekend is treated as if it were Monday morning's queue: each
 * step moves one calendar day and only counts when it lands on a weekday, so
 * Sat 11:00 plus 2 is Tue 11:00 (Mon is day 1, Tue is day 2).
 *
 * Public holidays are NOT handled (no holiday calendar); a deadline can fall on
 * one.
 *
 * @param fromMs - Start, epoch milliseconds
 * @param days - Business days to add (whole number, 0 or more)
 * @returns The deadline, epoch milliseconds
 */
export function addBusinessDays(fromMs: number, days: number): number {
  let local = fromMs + SAST_OFFSET_MS;
  let remaining = Math.max(0, Math.floor(days));
  while (remaining > 0) {
    local += DAY_MS;
    const weekday = new Date(local).getUTCDay();
    if (weekday !== 0 && weekday !== 6) remaining--;
  }
  return local - SAST_OFFSET_MS;
}
