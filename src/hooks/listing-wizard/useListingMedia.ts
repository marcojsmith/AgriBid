import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/utils";
import { useListingWizard } from "@/components/listing-wizard/context/useListingWizard";
import type { ListingFormData } from "@/components/listing-wizard/types";

interface UploadResponse {
  storageId: string;
}

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
      if (typeof url === "string" && url.startsWith("blob:")) {
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
    const blobUrl = URL.createObjectURL(file);
    setPreviews((prev: Record<string, string>) => {
      const currentPreview = prev[slotId];
      if (currentPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(currentPreview);
      }
      return {
        ...prev,
        [slotId]: blobUrl,
      };
    });

    try {
      const uploadUrl = await generateUploadUrl();

      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) throw new Error("Upload failed");

      const { storageId } = (await result.json()) as UploadResponse;

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
      setPreviews((prev: Record<string, string>) => {
        return Object.fromEntries(
          Object.entries(prev).filter(([key]) => key !== slotId)
        );
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
        const { storageId } = (await result.json()) as UploadResponse;

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
    if (
      targetId === "additional" &&
      (index === undefined ||
        index < 0 ||
        index >= formData.images.additional.length)
    ) {
      return;
    }

    let previewKey = targetId;

    if (targetId === "additional" && index !== undefined) {
      previewKey = Reflect.get(formData.images.additional, index);
    }

    const previewUrl = previewKey ? previews[previewKey] : undefined;
    if (previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
      setPreviews((prev: Record<string, string>) => {
        return Object.fromEntries(
          Object.entries(prev).filter(([key]) => key !== previewKey)
        );
      });
    }

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
