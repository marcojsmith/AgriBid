import { useState, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";
import { useListingWizard } from "../context/ListingWizardContext";

export const useListingMedia = () => {
  const { formData, setFormData, previews, setPreviews } = useListingWizard();
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const generateUploadUrl = useMutation(api.auctions.generateUploadUrl);

  const imagesRef = useRef(formData.images);
  const previewsRef = useRef(previews);

  useEffect(() => {
    imagesRef.current = formData.images;
  }, [formData.images]);

  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  // Unmount cleanup for all blob URLs
  useEffect(() => {
    return () => {
      const images = imagesRef.current;
      const currentPreviews = previewsRef.current;

      // Revoke from images state (if they are blobs)
      if (images && typeof images === 'object' && !Array.isArray(images)) {
        const { additional, ...slots } = images;
        const allUrls = [...Object.values(slots), ...(additional || [])];
        allUrls.forEach(url => {
          if (typeof url === "string" && url.startsWith("blob:")) {
            URL.revokeObjectURL(url);
          }
        });
      }

      // Revoke from previews state
      Object.values(currentPreviews).forEach(url => {
        if (url && typeof url === "string" && url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, slotId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create local preview immediately
    const blobUrl = URL.createObjectURL(file);
    if (slotId !== "additional") {
      setPreviews(prev => ({ ...prev, [slotId]: blobUrl }));
    }

    try {
      setUploadingSlot(slotId);
      const postUrl = await generateUploadUrl();
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) {
        throw new Error(`Upload failed: ${result.statusText}`);
      }

      const { storageId } = await result.json();

      setFormData(prev => {
        const currentImages = prev.images || { additional: [] };
        if (slotId === "additional") {
          return {
            ...prev,
            images: {
              ...currentImages,
              additional: [...(currentImages.additional || []), storageId]
            }
          };
        }
        return {
          ...prev,
          images: {
            ...currentImages,
            [slotId]: storageId
          }
        };
      });

      // For additional photos, we track previews by storageId after upload
      if (slotId === "additional") {
        setPreviews(prev => ({ ...prev, [storageId]: blobUrl }));
      }

      toast.success(`${slotId.toUpperCase()} photo uploaded`);
    } catch (error) {
      console.error(error);
      URL.revokeObjectURL(blobUrl);
      if (slotId !== "additional") {
        setPreviews(prev => {
          const next = { ...prev };
          delete next[slotId];
          return next;
        });
      }
      toast.error("Upload failed");
    } finally {
      setUploadingSlot(null);
    }
  };

  const removeImage = (slotId: string, index?: number) => {
    setFormData(prev => {
      const newImages = { ...prev.images };
      if (slotId === "additional" && typeof index === "number") {
        if (!Array.isArray(newImages.additional)) return prev;
        const storageId = newImages.additional[index];
        newImages.additional = newImages.additional.filter((_, i) => i !== index);
        
        // Cleanup preview
        if (storageId) {
          setPreviews(prevP => {
            const next = { ...prevP };
            if (next[storageId]) {
              URL.revokeObjectURL(next[storageId]);
              delete next[storageId];
            }
            return next;
          });
        }
      } else {
        const key = slotId as keyof Omit<typeof formData.images, "additional">;
        delete newImages[key];

        // Cleanup preview
        setPreviews(prevP => {
          const next = { ...prevP };
          if (next[slotId]) {
            URL.revokeObjectURL(next[slotId]);
            delete next[slotId];
          }
          return next;
        });
      }
      return { ...prev, images: newImages };
    });
  };

  return {
    uploadingSlot,
    handleImageUpload,
    removeImage,
  };
};
