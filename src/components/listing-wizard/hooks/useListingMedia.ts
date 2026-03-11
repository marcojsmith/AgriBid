import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/utils";

import { useListingWizard } from "../context/useListingWizard";
import type { ListingFormData } from "../types";

/**
 * Custom hook for managing media uploads and previews in the listing wizard.
 *
 * @returns Object with media upload and removal handlers
 */
export function useListingMedia() {
  const { formData, setFormData, previews, setPreviews } = useListingWizard();
  const generateUploadUrl = useMutation(api.auctions.generateUploadUrl);

  /**
   * Cleans up local preview URLs to prevent memory leaks.
   */
  const cleanupPreviews = useCallback(() => {
    Object.values(previews).forEach((url) => {
      if (url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
    });
  }, [previews]);

  /**
   * Handles single image upload for specific slots (front, engine, cabin, rear).
   *
   * @param slotId - The slot identifier
   * @param file - The file to upload
   */
  const handleUpload = async (
    slotId: "front" | "engine" | "cabin" | "rear",
    file: File
  ) => {
    // 1. Create local preview
    const blobUrl = URL.createObjectURL(file);
    setPreviews((prev: Record<string, string>) => {
      if (prev[slotId]?.startsWith("blob:")) {
        URL.revokeObjectURL(prev[slotId]);
      }
      return {
        ...prev,
        [slotId]: blobUrl,
      };
    });

    try {
      // 2. Get upload URL from Convex
      const uploadUrl = await generateUploadUrl();

      // 3. POST binary data to Convex storage
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) throw new Error("Upload failed");

      const { storageId } = await result.json();

      // 4. Update form state with storageId
      setFormData((prev: ListingFormData) => ({
        ...prev,
        images: {
          ...prev.images,
          [slotId]: storageId,
        },
      }));
    } catch (error) {
      console.error("Upload failed", error);
      toast.error(getErrorMessage(error, "Image upload failed"));
      // Cleanup preview on failure
      setPreviews((prev: Record<string, string>) => {
        const next = { ...prev };
        delete next[slotId];
        return next;
      });
      URL.revokeObjectURL(blobUrl);
    }
  };

  /**
   * Handles multiple image uploads for the 'additional' slot.
   *
   * @param files - The files to upload
   */
  const handleAdditionalUpload = async (files: File[]) => {
    const currentCount = formData.images.additional.length;
    const remainingSlots = 6 - currentCount;

    if (remainingSlots <= 0) {
      toast.error("Maximum of 6 additional images allowed");
      return;
    }

    const filesToUpload = files.slice(0, remainingSlots);

    for (const file of filesToUpload) {
      const blobUrl = URL.createObjectURL(file);

      try {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!result.ok) throw new Error("Upload failed");
        const { storageId } = await result.json();

        setPreviews((prev: Record<string, string>) => ({
          ...prev,
          [storageId]: blobUrl,
        }));
        setFormData((prev: ListingFormData) => ({
          ...prev,
          images: {
            ...prev.images,
            additional: [...prev.images.additional, storageId],
          },
        }));
      } catch (error) {
        console.error("Additional upload failed", error);
        toast.error("Failed to upload one or more images");
        URL.revokeObjectURL(blobUrl);
      }
    }
  };

  /**
   * Removes an image from a specific slot.
   *
   * @param targetId - The slot ID or storage ID to remove
   * @param index - The zero-based index of the image in the additional images array (only used when targetId is "additional")
   */
  const handleRemove = (targetId: string, index?: number) => {
    if (targetId === "additional" && index === undefined) {
      return;
    }

    let previewKey = targetId;

    if (targetId === "additional" && index !== undefined) {
      previewKey = formData.images.additional[index];
    }

    // Revoke preview
    if (previews[previewKey]) {
      URL.revokeObjectURL(previews[previewKey]);
      setPreviews((prev: Record<string, string>) => {
        const next = { ...prev };
        delete next[previewKey];
        return next;
      });
    }

    // Update form state
    setFormData((prev: ListingFormData) => {
      if (targetId === "additional" && index !== undefined) {
        return {
          ...prev,
          images: {
            ...prev.images,
            additional: prev.images.additional.filter(
              (_: string, i: number) => i !== index
            ),
          },
        };
      } else {
        return {
          ...prev,
          images: {
            ...prev.images,
            [targetId]: undefined,
          },
        };
      }
    });
  };

  return {
    handleUpload,
    handleAdditionalUpload,
    handleRemove,
    cleanupPreviews,
  };
}
