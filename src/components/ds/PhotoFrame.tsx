import { Tractor } from "lucide-react";

import { cn } from "@/lib/utils";

interface PhotoFrameProps {
  /** Image URL; when missing a branded empty state is shown. */
  src?: string | null;
  /** Required description (also labels the empty state). */
  alt: string;
  /** Aspect ratio: events use 16:9, lots and galleries 4:3. */
  ratio?: "16:9" | "4:3";
  /** Fill the parent instead of using an aspect ratio (used by `EventMosaic`). */
  fill?: boolean;
  /** Load eagerly (above-the-fold hero image only). */
  eager?: boolean;
  className?: string;
}

/**
 * A photo in a fixed aspect ratio with `object-fit: cover`, 8px radius and
 * lazy loading. Shows a branded placeholder when there is no image.
 *
 * Use it for every event, lot or gallery photo so crops stay consistent.
 *
 * @param props - Component props
 * @param props.src - Image URL; a branded empty state is shown when missing
 * @param props.alt - Required alt text (also labels the empty state)
 * @param props.ratio - Aspect ratio, 16:9 or 4:3 (default 4:3)
 * @param props.fill - Fill the parent instead of using an aspect ratio
 * @param props.eager - Load eagerly (above-the-fold hero only)
 * @param props.className - Extra classes merged onto the root element
 * @returns The framed photo
 */
export function PhotoFrame({
  src,
  alt,
  ratio = "4:3",
  fill = false,
  eager = false,
  className,
}: PhotoFrameProps) {
  const frame = cn(
    "relative overflow-hidden rounded-lg bg-muted",
    fill ? "size-full" : ratio === "16:9" ? "aspect-video" : "aspect-[4/3]",
    className
  );
  if (!src) {
    return (
      <div
        role="img"
        aria-label={alt}
        data-slot="photo-frame"
        data-empty="true"
        className={cn(
          frame,
          "flex flex-col items-center justify-center gap-1 text-muted-foreground"
        )}
      >
        <Tractor aria-hidden="true" className="size-8" />
        <span className="text-[13px]">No photo yet</span>
      </div>
    );
  }
  return (
    <div data-slot="photo-frame" className={frame}>
      <img
        src={src}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className="absolute inset-0 size-full object-cover"
      />
    </div>
  );
}
