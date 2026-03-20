import { useState } from "react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

import { useFileUpload } from "@/hooks/useFileUpload";

/**
 * Manage KYC document uploads and deletions for a component.
 *
 * Provides state and handlers for selecting, uploading, and removing KYC files.
 * Files are constrained to PNG, JPEG, or PDF, up to 10 MB each, and a maximum of 5 files.
 * Deletions are performed optimistically: the document is removed from local state immediately,
 * then the server is called. `executeDeleteDocument` returns `true` on successful server deletion
 * and `false` if the deletion failed (in which case the local state is rolled back).
 *
 * @returns An object containing:
 * - `isUploading` — whether an upload is in progress
 * - `files` — the current list of selected/uploading files
 * - `setFiles` — setter to replace the `files` array
 * - `existingDocuments` — array of existing KYC document IDs
 * - `setExistingDocuments` — setter to replace the `existingDocuments` array
 * - `handleFileChange` — input change handler for selecting files
 * - `executeDeleteDocument` — async function (docId: string) => `true` if deletion succeeded, `false` otherwise
 * - `uploadFiles` — function to start uploading queued files
 * - `cleanupUploads` — function to clear upload state and queued files
 */
export function useKYCFileUpload() {
  const [existingDocuments, setExistingDocuments] = useState<string[]>([]);
  const deleteMyKYCDocument = useMutation(api.users.deleteMyKYCDocument);

  const {
    isUploading,
    files,
    setFiles,
    handleFileChange,
    uploadFiles,
    cleanupUploads,
  } = useFileUpload({
    maxSize: 10 * 1024 * 1024,
    allowedTypes: ["image/png", "image/jpeg", "application/pdf"],
    maxFiles: 5,
    cleanupHandler: async (storageIds) => {
      const results = await Promise.allSettled(
        storageIds.map(async (id) => {
          try {
            await deleteMyKYCDocument({ storageId: id as Id<"_storage"> });
            return { id, success: true };
          } catch (error) {
            return { id, success: false, error };
          }
        })
      );

      results.forEach((result) => {
        if (result.status === "fulfilled" && !result.value.success) {
          console.error(
            `Failed to delete KYC storage ${result.value.id}:`,
            result.value.error
          );
        } else if (result.status === "rejected") {
          // This should rarely happen as we catch inside map, but for completeness:
          console.error("Failed to delete KYC storage:", result.reason);
        }
      });
    },
  });

  const executeDeleteDocument = async (docId: string) => {
    setExistingDocuments((prev) => prev.filter((id) => id !== docId));

    try {
      await deleteMyKYCDocument({
        storageId: docId as Id<"_storage">,
      });
      toast.success("Document deleted");
      return true;
    } catch (err) {
      setExistingDocuments((prev) =>
        prev.includes(docId) ? prev : [...prev, docId]
      );
      toast.error(
        "Failed to delete document: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
      return false;
    }
  };

  return {
    isUploading,
    files,
    setFiles,
    existingDocuments,
    setExistingDocuments,
    handleFileChange,
    executeDeleteDocument,
    uploadFiles,
    cleanupUploads,
  };
}
