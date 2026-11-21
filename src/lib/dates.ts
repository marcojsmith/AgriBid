const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * Formats a timestamp as an absolute South African time: `Sat 22 Nov, 10:00 SAST`.
 *
 * South Africa (Africa/Johannesburg) is UTC+2 all year with no daylight
 * saving, so the conversion is a fixed offset. That keeps the output
 * identical on every platform and ICU build. No seconds are shown.
 *
 * @param timestamp - Milliseconds since the Unix epoch
 * @returns The formatted string, or an empty string for a non-finite input
 */
export function formatSastDate(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return "";
  const d = new Date(timestamp + SAST_OFFSET_MS);
  const weekday = WEEKDAYS[d.getUTCDay()] ?? "";
  const month = MONTHS[d.getUTCMonth()] ?? "";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${weekday} ${String(d.getUTCDate())} ${month}, ${hh}:${mm} SAST`;
}

/**
 * Formats a timestamp as a South African calendar date with no time: `21 Nov 2026`.
 *
 * Uses the same fixed UTC+2 offset as {@link formatSastDate}.
 *
 * @param timestamp - Milliseconds since the Unix epoch
 * @returns The formatted string, or an empty string for a non-finite input
 */
export function formatSastDay(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return "";
  const d = new Date(timestamp + SAST_OFFSET_MS);
  const month = MONTHS[d.getUTCMonth()] ?? "";
  return `${String(d.getUTCDate())} ${month} ${String(d.getUTCFullYear())}`;
}
