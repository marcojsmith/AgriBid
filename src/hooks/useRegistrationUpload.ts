import { useCallback, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

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
 * Uploads a registration document: asks for a one-time URL, POSTs the file to
 * it, then attaches the stored file to the buyer's registration. Attaching a
 * replacement resets that document to "pending" on the server.
 *
 * @returns The `upload` function plus the slot being uploaded and any error
 */
export function useRegistrationUpload(): RegistrationUpload {
  const generateUrl = useMutation(api.registration.generateDocumentUploadUrl);
  const attach = useMutation(api.registration.attachMyDocument);
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
        const url = await generateUrl({});
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!response.ok) throw new Error("Upload failed");
        const { storageId } = (await response.json()) as {
          storageId: Id<"_storage">;
        };
        await attach({ kind, storageId, fileName: file.name });
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
    [generateUrl, attach]
  );

  return { upload, uploadingKind, error };
}
