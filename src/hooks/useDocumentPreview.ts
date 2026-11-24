import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";

import {
  fetchProtectedDocument,
  type DocumentTarget,
} from "@/lib/documentRoutes";
import type { Registration } from "@/lib/registrationCopy";

/** A stored registration document, as `getMyRegistration` returns it. */
export type RegistrationDocument = Registration["documents"][number];

/** What a page needs to preview a stored document. */
export interface DocumentPreview {
  /** An object URL to show as an image; undefined for a PDF, while loading, or on error. */
  src?: string;
  /** An object URL that opens the file in a new tab (images and PDFs). */
  href?: string;
  /** Whether the document is a PDF (show a file icon instead of a thumbnail). */
  isPdf: boolean;
  /** Whether the file is being fetched. */
  loading: boolean;
  /** A message when the file couldn't be loaded. */
  error?: string;
}

/** The result for nothing to show. */
const EMPTY: DocumentPreview = { isPdf: false, loading: false };

/** The result while a file is being fetched. */
const LOADING: DocumentPreview = { isPdf: false, loading: true };

/**
 * Fetches a protected document with the bearer token and exposes it as an
 * object URL. The URL is revoked when the target changes or the component
 * unmounts, so nothing keeps the file alive.
 *
 * @param target - The document to read, or undefined for none
 * @param versionKey - Changes when the file behind the same target changes
 * @returns The preview state
 */
export function useProtectedDocument(
  target: DocumentTarget | undefined,
  versionKey?: string
): DocumentPreview {
  const { getToken } = useAuth();
  const [settled, setSettled] = useState<{
    key: string;
    preview: DocumentPreview;
  } | null>(null);
  const targetKey = target ? JSON.stringify(target) : undefined;
  // `versionKey` re-fetches when a replacement lands under the same target.
  const key =
    targetKey === undefined ? undefined : `${targetKey}|${versionKey ?? ""}`;

  useEffect(() => {
    if (targetKey === undefined || key === undefined) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;

    (async () => {
      try {
        const token = await getToken({ template: "convex" });
        if (!token) throw new Error("Sign in again to view documents.");
        const blob = await fetchProtectedDocument(
          JSON.parse(targetKey) as DocumentTarget,
          token,
          controller.signal
        );
        if (controller.signal.aborted) return;
        const isPdf = blob.type === "application/pdf";
        const isImage = blob.type.startsWith("image/");
        objectUrl = URL.createObjectURL(blob);
        setSettled({
          key,
          preview: {
            // A PDF opens from its own object URL; only images are thumbnails.
            src: isImage ? objectUrl : undefined,
            href: objectUrl,
            isPdf,
            loading: false,
          },
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        setSettled({
          key,
          preview: {
            isPdf: false,
            loading: false,
            error:
              err instanceof Error
                ? err.message
                : "Couldn't load that document.",
          },
        });
      }
    })().catch(() => undefined);

    return () => {
      controller.abort();
      if (objectUrl !== undefined) URL.revokeObjectURL(objectUrl);
    };
  }, [targetKey, key, getToken]);

  if (key === undefined) return EMPTY;
  return settled?.key === key ? settled.preview : LOADING;
}

/**
 * The single place pages read a stored registration document's file: fetches
 * it through the auth-checked `/documents/file` route and returns an image
 * source and whether it is a PDF.
 *
 * @param doc - The stored document, or undefined for an empty slot
 * @returns The preview source, PDF flag, loading flag and any error
 */
export function useDocumentPreview(
  doc: RegistrationDocument | undefined
): DocumentPreview {
  const preview = useProtectedDocument(
    doc ? { kind: "registration", id: doc.id } : undefined,
    doc ? `${String(doc.fileSize)}:${doc.fileName}:${doc.status}` : undefined
  );
  if (!doc) return EMPTY;
  // A PDF is known from its stored type before the file arrives.
  const isPdf = preview.isPdf || doc.contentType === "application/pdf";
  return { ...preview, isPdf, src: isPdf ? undefined : preview.src };
}
