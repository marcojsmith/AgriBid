/**
 * Offset-cursor helpers for pagination.
 *
 * Several queries page an in-memory array (a capped, filtered or merged result
 * set) rather than an index range. Those queries encode the cursor as the plain
 * decimal offset of the next row, so the cursor has to be parsed back into an
 * offset before slicing. `parseOffsetCursor` is the single place that decides
 * what an unusable cursor means.
 */

/** Offset used whenever the cursor is absent or cannot be trusted. */
const FIRST_PAGE_OFFSET = 0;

/**
 * Parses an offset-style pagination cursor into a safe array offset.
 *
 * A missing, empty, non-numeric or negative cursor all mean "start from the
 * beginning": the offset is clamped rather than propagated, because a `NaN`
 * offset would silently turn `Array.prototype.slice` into an empty page with a
 * continuation cursor of `"NaN"` that never advances, and a negative offset
 * would slice from the end of the result set.
 *
 * @param cursor - The cursor supplied by the caller (`null` on the first page).
 * @returns A non-negative integer offset, or 0 for an unusable cursor.
 */
export function parseOffsetCursor(cursor: string | null | undefined): number {
  if (cursor === null || cursor === undefined || cursor.trim() === "") {
    return FIRST_PAGE_OFFSET;
  }

  const parsed = Number.parseInt(cursor, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return FIRST_PAGE_OFFSET;
  }

  return parsed;
}
