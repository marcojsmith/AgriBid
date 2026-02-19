// app/src/pages/kyc/hooks/useKYCFileUpload.ts
import { useState } from "react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useFileUpload } from "@/hooks/useFileUpload";

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
  });

  const executeDeleteDocument = async (docId: string) => {
    // Optimistic update
    setExistingDocuments((prev) => prev.filter((id) => id !== docId));

    try {
      await deleteMyKYCDocument({
        storageId: docId as Id<"_storage">,
      });
      toast.success("Document deleted");
      return true;
    } catch (err) {
      // Rollback on failure: only add it back if it's not already there
      setExistingDocuments((prev) => 
        prev.includes(docId) ? prev : [...prev, docId]
      );
      toast.error(
        "Failed to delete document: " +
          (err instanceof Error ? err.message : "Unknown error"),
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
