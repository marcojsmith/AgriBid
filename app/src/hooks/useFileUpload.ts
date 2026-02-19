// app/src/hooks/useFileUpload.ts
import { useState } from "react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

interface UseFileUploadOptions {
  maxSize?: number; // In bytes
  allowedTypes?: string[];
  maxFiles?: number;
  /**
   * Optional custom cleanup handler for storage IDs.
   * If not provided, falls back to the internal deleteUpload mutation (admin only).
   */
  cleanupHandler?: (storageIds: string[]) => Promise<void>;
}

/**
 * Manage file selection, validation, uploading to presigned URLs, and cleanup for client-side file uploads.
 *
 * @param options - Optional configuration: `maxSize` in bytes (default 10MB), `allowedTypes` array of MIME types (default ["image/png","image/jpeg","application/pdf"]), and `maxFiles` maximum number of files (default 10).
 * @returns An object with:
 *  - `isUploading`: boolean indicating an ongoing upload operation
 *  - `files`: currently selected `File[]`
 *  - `setFiles`: state setter for the `files` array
 *  - `handleFileChange`: input change handler to validate and append selected files
 *  - `removeFile`: remove a file by index from the `files` array
 *  - `uploadFiles`: async function that uploads provided files (defaults to current `files`) and returns an array of `storageId` strings on full success, or `null` on failure/partial failure
 *  - `cleanupUploads`: async function to delete uploads given an array of `storageId` strings
 */
export function useFileUpload(options: UseFileUploadOptions = {}) {
  const {
    maxSize = 10 * 1024 * 1024, // Default 10MB
    allowedTypes = ["image/png", "image/jpeg", "application/pdf"],
    maxFiles = 10,
    cleanupHandler,
  } = options;

  const [isUploading, setIsUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  
  const generateUploadUrl = useMutation(api.auctions.generateUploadUrl);
  const deleteUpload = useMutation(api.auctions.deleteUpload);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    if (files.length + selectedFiles.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const validFiles: File[] = [];

    for (const file of selectedFiles) {
      if (file.size > maxSize) {
        toast.error(`${file.name} exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`);
        continue;
      }
      if (!allowedTypes.includes(file.type)) {
        toast.error(
          `${file.name} is not a supported format`,
        );
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles]);
    }

    // Reset input so the same file can be selected again if needed
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  /**
   * Internal helper to handle cleanup using either the injected handler or the default mutation.
   */
  const performCleanup = async (storageIds: string[]) => {
    if (storageIds.length === 0) return;
    
    if (cleanupHandler) {
      try {
        await cleanupHandler(storageIds);
      } catch (err) {
        console.error("Injected cleanupHandler failed:", err);
      }
    } else {
      const results = await Promise.allSettled(
        storageIds.map((id) =>
          deleteUpload({ storageId: id as Id<"_storage"> }),
        ),
      );
      
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          const reason = result.reason;
          const isAuthError =
            reason instanceof Error &&
            (reason.message.toLowerCase().includes("unauthorized") ||
              reason.message.toLowerCase().includes("not authorized"));

          if (isAuthError) {
            console.warn(
              `Authorization failure while deleting orphaned upload ${storageIds[index]}. ` +
                `This usually happens when a non-admin caller omits a 'cleanupHandler'. ` +
                `Please provide a custom cleanupHandler for this context.`,
            );
          } else {
            console.error(
              `Failed to delete orphaned upload ${storageIds[index]}:`,
              reason,
            );
          }
        }
      });
    }
  };

  const uploadFiles = async (filesToUpload: File[] = files, autoClear = false) => {
    if (filesToUpload.length === 0) return [];
    
    setIsUploading(true);
    let storageIds: string[] = [];
    try {
      const uploadResults = await Promise.allSettled(
        filesToUpload.map(async (file) => {
          const postUrl = await generateUploadUrl();
          const result = await fetch(postUrl, {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file,
          });

          if (!result.ok) {
            throw new Error(`Failed to upload ${file.name}`);
          }

          const { storageId } = await result.json();
          return storageId as string;
        }),
      );

      const failures = uploadResults.filter(
        (r): r is PromiseRejectedResult => r.status === "rejected",
      );
      storageIds = uploadResults
        .filter(
          (r): r is PromiseFulfilledResult<string> => r.status === "fulfilled",
        )
        .map((r) => r.value);

      if (failures.length > 0) {
        console.error("Upload partial failure:", failures);
        toast.error(
          `Failed to upload ${failures.length} file(s). Please try again.`,
        );

        // Cleanup successes since we are halting
        await performCleanup(storageIds);
        return null;
      }

      if (autoClear) {
        setFiles([]);
      }

      return storageIds;
    } catch (generalError) {
      console.error("Upload Process Error:", generalError);
      toast.error("An unexpected error occurred during upload");
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const cleanupUploads = async (storageIds: string[]) => {
    await performCleanup(storageIds);
  };

  return {
    isUploading,
    files,
    setFiles,
    handleFileChange,
    removeFile,
    uploadFiles,
    cleanupUploads,
  };
}