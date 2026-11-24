import type { Registration } from "@/lib/registrationCopy";

/** A stored registration document, as `getMyRegistration` returns it. */
export type RegistrationDocument = Registration["documents"][number];

/** What a page needs to preview a stored document. */
export interface DocumentPreview {
  /** An image source for a thumbnail; undefined for a PDF or when none is available. */
  src?: string;
  /** Whether the document is a PDF (show a file icon instead of a thumbnail). */
  isPdf: boolean;
}

/**
 * The single place pages read a stored document's file: returns an image
 * source and whether it is a PDF. Today the source is the signed storage URL;
 * when documents move behind an authenticated route only this hook changes.
 *
 * @param doc - The stored document, or undefined for an empty slot
 * @returns The preview source and PDF flag
 */
export function useDocumentPreview(
  doc: RegistrationDocument | undefined
): DocumentPreview {
  if (!doc) return { isPdf: false };
  const isPdf = doc.fileName.toLowerCase().endsWith(".pdf");
  return { src: isPdf || !doc.url ? undefined : doc.url, isPdf };
}
