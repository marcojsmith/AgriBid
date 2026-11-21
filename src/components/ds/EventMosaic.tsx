import { cn } from "@/lib/utils";

import { PhotoFrame } from "./PhotoFrame";

/** One photo in a mosaic. */
export interface MosaicPhoto {
  src: string;
  alt: string;
}

interface EventMosaicProps {
  /** Up to three photos; extras are ignored. */
  photos: readonly MosaicPhoto[];
  /** Alt text for the empty state when there are no photos. */
  emptyAlt: string;
  className?: string;
}

/**
 * A 16:9 event image: one large photo with two small ones. Falls back to one
 * photo (full frame), two photos (side by side) or the branded empty state.
 *
 * Use it on event cards and event headers. Lot photos use `PhotoFrame`.
 *
 * @param props - Component props
 * @param props.photos
 * @param props.emptyAlt
 * @param props.className
 * @returns The mosaic
 */
export function EventMosaic({ photos, emptyAlt, className }: EventMosaicProps) {
  const shown = photos.slice(0, 3);
  const [first, second, third] = shown;
  if (!first) {
    return <PhotoFrame alt={emptyAlt} ratio="16:9" className={className} />;
  }
  if (!second) {
    return (
      <PhotoFrame
        src={first.src}
        alt={first.alt}
        ratio="16:9"
        className={className}
      />
    );
  }
  return (
    <div
      data-slot="event-mosaic"
      data-count={shown.length}
      className={cn(
        "grid aspect-video gap-0.5 overflow-hidden rounded-lg",
        third ? "grid-cols-3 grid-rows-2" : "grid-cols-2",
        className
      )}
    >
      <div className={cn(third && "col-span-2 row-span-2")}>
        <PhotoFrame
          src={first.src}
          alt={first.alt}
          fill
          className="rounded-none"
        />
      </div>
      <div>
        <PhotoFrame
          src={second.src}
          alt={second.alt}
          fill
          className="rounded-none"
        />
      </div>
      {third ? (
        <div>
          <PhotoFrame
            src={third.src}
            alt={third.alt}
            fill
            className="rounded-none"
          />
        </div>
      ) : null}
    </div>
  );
}
