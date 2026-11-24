/**
 * Formats a byte count as KB or MB with one decimal ("1.2 MB", "200.0 KB").
 *
 * @param bytes - The size in bytes
 * @returns The display string
 */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}
