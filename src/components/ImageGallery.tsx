// app/src/components/ImageGallery.tsx
import { useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ImageGalleryProps {
  images: string[];
  title: string;
}

/**
 * Placeholder shown when an image is missing or failed to load.
 *
 * @returns The placeholder markup matching the gallery's empty state.
 */
function ImagePlaceholder() {
  return (
    <div className="flex flex-col items-center">
      <span className="text-6xl mb-4">🚜</span>
      <span className="text-muted-foreground font-medium italic text-center px-4">
        Image Pending (Seller Inspection in Progress)
      </span>
    </div>
  );
}

/**
 * Component for an image gallery with a lightbox.
 *
 * Images that fail to load are replaced with the same placeholder used for
 * missing images, so a broken CDN link never renders as a broken-image icon.
 *
 * @param props - Component props.
 * @param props.images - An array of image URLs.
 * @param props.title - The title of the equipment for alt text.
 * @returns The rendered image gallery.
 */
export const ImageGallery = ({ images, title }: ImageGalleryProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  // Track which URLs failed to load so a broken CDN link never renders as a
  // broken-image icon; recovery is automatic when the URL list changes
  const [failedUrls, setFailedUrls] = useState<ReadonlySet<string>>(new Set());

  /**
   * Mark an image URL as failed so the placeholder renders in its place.
   *
   * @param url - The image URL that failed to load
   */
  const markImageFailed = (url: string) => {
    setFailedUrls((prev) => new Set(prev).add(url));
  };

  if (images.length === 0) {
    return (
      <div className="aspect-[16/10] bg-muted rounded-lg flex items-center justify-center border overflow-hidden">
        <ImagePlaceholder />
      </div>
    );
  }

  const activeImage = images.at(activeIndex) ?? images[0];
  const nextImage = () => setActiveIndex((prev) => (prev + 1) % images.length);
  const prevImage = () =>
    setActiveIndex((prev) => (prev - 1 + images.length) % images.length);

  return (
    <div className="space-y-4">
      {/* Main Hero Image with Lightbox Trigger */}
      <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="w-full aspect-[16/10] bg-muted rounded-lg flex items-center justify-center border overflow-hidden group relative cursor-zoom-in outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Open full-screen gallery"
          >
            {failedUrls.has(activeImage) ? (
              <ImagePlaceholder />
            ) : (
              <img
                src={activeImage}
                alt={`${title} - Main`}
                loading="eager"
                className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                onError={() => {
                  markImageFailed(activeImage);
                }}
              />
            )}
            <div className="absolute top-4 right-4 h-9 w-9 rounded-md bg-background/80 backdrop-blur flex items-center justify-center shadow-sm transition-colors group-hover:bg-background">
              <Maximize2
                className="h-4 w-4 text-foreground"
                aria-hidden="true"
              />
            </div>
            <div className="absolute bottom-4 right-4 bg-background/80 backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
              {activeIndex + 1} / {images.length}
            </div>
          </button>
        </DialogTrigger>

        <DialogContent className="max-w-[95vw] h-[90vh] p-0 bg-black/95 border-none flex flex-col items-center justify-center">
          <DialogTitle className="sr-only">{title} - Full Gallery</DialogTitle>
          <DialogDescription className="sr-only">
            Full-screen high-resolution image gallery for {title}
          </DialogDescription>
          <div className="relative w-full h-full flex items-center justify-center">
            {failedUrls.has(activeImage) ? (
              <ImagePlaceholder />
            ) : (
              <img
                src={activeImage}
                alt={`${title} - Full Screen`}
                loading="lazy"
                className="max-w-full max-h-full object-contain"
                onError={() => {
                  markImageFailed(activeImage);
                }}
              />
            )}

            {/* Lightbox Controls */}
            {images.length > 1 && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 text-white hover:bg-white/10 h-12 w-12 rounded-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    prevImage();
                  }}
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 text-white hover:bg-white/10 h-12 w-12 rounded-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    nextImage();
                  }}
                  aria-label="Next image"
                >
                  <ChevronRight className="h-8 w-8" />
                </Button>
              </>
            )}

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
              {images.map((_, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition-all",
                    activeIndex === idx ? "bg-white w-4" : "bg-white/40"
                  )}
                />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Thumbnails Carousel */}
      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {images.map((image, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn(
                "relative aspect-square w-20 md:w-24 rounded-lg overflow-hidden border transition-all flex-shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary",
                activeIndex === index
                  ? "border-primary ring-2 ring-primary/20 scale-95"
                  : "border-transparent hover:border-primary/40"
              )}
              aria-label={`View image ${index + 1}`}
            >
              {failedUrls.has(image) ? (
                <span className="text-2xl" aria-hidden="true">
                  🚜
                </span>
              ) : (
                <img
                  src={image}
                  alt={`${title} thumbnail ${index + 1}`}
                  loading="lazy"
                  className="object-cover w-full h-full"
                  onError={() => {
                    markImageFailed(image);
                  }}
                />
              )}
              {activeIndex !== index && (
                <div className="absolute inset-0 bg-black/5 hover:bg-transparent transition-colors" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
