// app/src/components/ImageGallery.tsx
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageGalleryProps {
  images: string[];
  title: string;
}

export const ImageGallery = ({ images, title }: ImageGalleryProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  if (!images || images.length === 0) {
    return (
      <div className="aspect-[16/10] bg-muted rounded-2xl flex items-center justify-center border-2 overflow-hidden">
        <div className="flex flex-col items-center">
          <span className="text-6xl mb-4">🚜</span>
          <span className="text-muted-foreground font-medium italic text-center px-4">
            Image Pending (Seller Inspection in Progress)
          </span>
        </div>
      </div>
    );
  }

  const nextImage = () => setActiveIndex((prev) => (prev + 1) % images.length);
  const prevImage = () => setActiveIndex((prev) => (prev - 1 + images.length) % images.length);

  return (
    <div className="space-y-4">
      {/* Main Hero Image with Lightbox Trigger */}
      <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
        <DialogTrigger asChild>
          <button 
            className="w-full aspect-[16/10] bg-muted rounded-2xl flex items-center justify-center border-2 overflow-hidden group relative cursor-zoom-in outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Open full-screen gallery"
          >
            <img
              src={images[activeIndex]}
              alt={`${title} - Main`}
              className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute bottom-4 right-4 bg-background/80 backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
              {activeIndex + 1} / {images.length}
            </div>
          </button>
        </DialogTrigger>
        
        <DialogContent className="max-w-[95vw] h-[90vh] p-0 bg-black/95 border-none flex flex-col items-center justify-center">
          <DialogTitle className="sr-only">{title} - Full Gallery</DialogTitle>
          <div className="sr-only">Full-screen high-resolution image gallery for {title}</div>
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={images[activeIndex]}
              alt={`${title} - Full Screen`}
              className="max-w-full max-h-full object-contain"
            />
            
            {/* Lightbox Controls */}
            {images.length > 1 && (
              <>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute left-4 text-white hover:bg-white/10 h-12 w-12 rounded-full"
                  onClick={(e) => { e.stopPropagation(); prevImage(); }}
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-4 text-white hover:bg-white/10 h-12 w-12 rounded-full"
                  onClick={(e) => { e.stopPropagation(); nextImage(); }}
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
              onClick={() => setActiveIndex(index)}
              className={cn(
                "relative aspect-square w-20 md:w-24 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary",
                activeIndex === index 
                  ? "border-primary ring-2 ring-primary/20 scale-95" 
                  : "border-transparent hover:border-primary/40"
              )}
              aria-label={`View image ${index + 1}`}
            >
              <img
                src={image}
                alt={`${title} thumbnail ${index + 1}`}
                className="object-cover w-full h-full"
              />
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
