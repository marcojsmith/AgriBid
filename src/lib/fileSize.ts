/**
 * Formats a byte count as KB or MB with one decimal ("1.2 MB", "200.0 KB").
 *
 * @param bytes - The size in bytes
 * @returns The display string
 */
export function formatFileSize(bytes: number): string {
  const kb = (bytes / 1024).toFixed(1);
  // Switch to MB once the KB figure would round up to "1024.0".
  if (Number(kb) < 1024) return `${kb} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
