/**
 * Content-type detection for uploaded personal documents. Looks only at the
 * file's leading bytes: the client's Content-Type header is never trusted.
 */

/** MIME types a document upload may resolve to (no SVG: it can carry script). */
export type DocumentContentType =
  "image/jpeg" | "image/png" | "image/webp" | "image/heic" | "application/pdf";

/**
 * Tests whether `bytes` holds `expected` starting at `offset`.
 *
 * @param bytes - File bytes
 * @param offset - Where to start comparing
 * @param expected - Byte values (or an ASCII string) to match
 * @returns True when every expected byte matches
 */
function startsWith(
  bytes: Uint8Array,
  offset: number,
  expected: readonly number[] | string
): boolean {
  const wanted =
    typeof expected === "string"
      ? Array.from(expected, (char) => char.charCodeAt(0))
      : expected;
  if (bytes.length < offset + wanted.length) return false;
  return wanted.every((byte, i) => bytes[offset + i] === byte);
}

/** `ftyp` brands that identify HEIC/HEIF images. */
const HEIF_BRANDS: readonly string[] = ["heic", "heix", "mif1", "heif"];

/**
 * Detects an allowed document type from its magic bytes.
 *
 * Allowed: JPEG (FF D8 FF), PNG (89 50 4E 47), WebP (`RIFF....WEBP`),
 * HEIC/HEIF (`ftyp` heic/heix/mif1/heif at offset 4) and PDF (`%PDF`).
 *
 * @param bytes - The file's bytes (only the first 12 are read)
 * @returns The MIME type to store, or null when the file is not an allowed type
 */
export function sniffDocumentType(
  bytes: Uint8Array
): DocumentContentType | null {
  if (startsWith(bytes, 0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, 0, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (startsWith(bytes, 0, "RIFF") && startsWith(bytes, 8, "WEBP")) {
    return "image/webp";
  }
  if (startsWith(bytes, 4, "ftyp")) {
    const brand = String.fromCharCode(...bytes.subarray(8, 12));
    if (HEIF_BRANDS.includes(brand)) return "image/heic";
  }
  if (startsWith(bytes, 0, "%PDF")) return "application/pdf";
  return null;
}
