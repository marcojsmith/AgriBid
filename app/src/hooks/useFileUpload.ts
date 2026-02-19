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
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const {
    maxSize = 10 * 1024 * 1024, // Default 10MB
    allowedTypes = ["image/png", "image/jpeg", "application/pdf"],
    maxFiles = 10,
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

  const uploadFiles = async (filesToUpload: File[] = files) => {
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
        if (storageIds.length > 0) {
          await Promise.allSettled(
            storageIds.map((id) =>
              deleteUpload({ storageId: id as Id<"_storage"> }),
            ),
          );
        }
        return null;
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
    if (storageIds.length > 0) {
      await Promise.allSettled(
        storageIds.map((id) =>
          deleteUpload({ storageId: id as Id<"_storage"> }),
        ),
      );
    }
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
