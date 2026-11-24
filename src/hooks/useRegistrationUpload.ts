import { useCallback, useState } from "react";
import { useAuth } from "@clerk/clerk-react";

import { getConvexSiteUrl } from "@/lib/documentRoutes";
import { getErrorMessage } from "@/lib/utils";

import { MAX_REG_DOC_BYTES } from "../../convex/constants";
import type { RegDocKind } from "../../convex/lib/registration";

/** An upload that failed, with the slot it belongs to. */
export interface UploadError {
  kind: RegDocKind;
  message: string;
}

/** What {@link useRegistrationUpload} returns. */
export interface RegistrationUpload {
  /** Uploads a file and attaches it. Resolves true when it was attached. */
  upload: (kind: RegDocKind, file: File) => Promise<boolean>;
  /** The slot being uploaded right now. */
  uploadingKind: RegDocKind | null;
  /** The last failure; cleared when the next upload starts. */
  error: UploadError | null;
}

const ALLOWED_TYPES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

/**
 * Uploads a registration document: POSTs the raw file to the server's
 * `/documents/upload` route with the Clerk token as a bearer. The server
 * checks the file's real type, encrypts it, stores it and attaches it to the
 * buyer's registration; a replacement resets that document to "pending".
 *
 * @returns The `upload` function plus the slot being uploaded and any error
 */
export function useRegistrationUpload(): RegistrationUpload {
  const { getToken } = useAuth();
  const [uploadingKind, setUploadingKind] = useState<RegDocKind | null>(null);
  const [error, setError] = useState<UploadError | null>(null);

  const upload = useCallback(
    async (kind: RegDocKind, file: File): Promise<boolean> => {
      setError(null);
      if (!ALLOWED_TYPES.has(file.type)) {
        setError({ kind, message: "Upload a photo (JPG, PNG) or a PDF." });
        return false;
      }
      if (file.size > MAX_REG_DOC_BYTES) {
        setError({
          kind,
          message: "That file is too large. The limit is 10 MB.",
        });
        return false;
      }

      setUploadingKind(kind);
      try {
        const token = await getToken({ template: "convex" });
        if (!token) throw new Error("Sign in again to upload documents.");
        const query = new URLSearchParams({ kind, fileName: file.name });
        const response = await fetch(
          `${getConvexSiteUrl()}/documents/upload?${query.toString()}`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: file,
          }
        );
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? "Upload failed");
        }
        return true;
      } catch (err) {
        setError({
          kind,
          message: getErrorMessage(
            err,
            "Couldn't upload that file. Check your connection and try again."
          ),
        });
        return false;
      } finally {
        setUploadingKind(null);
      }
    },
    [getToken]
  );

  return { upload, uploadingKind, error };
}
