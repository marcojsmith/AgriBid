import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight, Maximize2, Play, X } from "lucide-react";
import { Dialog } from "radix-ui";

import { PhotoFrame } from "@/components/ds/PhotoFrame";
import type { GallerySlide } from "@/lib/lotPage";
import { cn } from "@/lib/utils";

interface LotGalleryProps {
  slides: readonly GallerySlide[];
  /** The lot's name, for alt text: "New Holland T6070". */
  title: string;
  /** The heart and share buttons, drawn on the photo's top-right corner. */
  actions?: ReactNode;
  /** Slide the full-screen viewer is open at, or null when it is closed. */
  viewerAt: number | null;
  onViewerChange: (at: number | null) => void;
  className?: string;
}

/**
 * Text for the counter under the photo: "1 / 9 · Cold-start video".
 *
 * @param index - Zero-based slide index
 * @param slides - The slides
 * @returns The counter text
 */
function counterText(index: number, slides: readonly GallerySlide[]): string {
  const caption = slides[index]?.caption;
  const count = `${String(index + 1)} / ${String(slides.length)}`;
  return caption ? `${count} · ${caption}` : count;
}

/**
 * One slide's media: a photo, or the cold-start video with native controls.
 *
 * @param props - Component props
 * @param props.slide - The slide
 * @param props.alt - Alt text for a photo
 * @param props.eager - Load eagerly (the first photo)
 * @param props.contain - Fit the whole photo (the full-screen viewer)
 * @returns The media element
 */
function SlideMedia({
  slide,
  alt,
  eager,
  contain,
}: {
  slide: GallerySlide;
  alt: string;
  eager?: boolean;
  contain?: boolean;
}) {
  if (slide.kind === "video") {
    return (
      <video
        src={slide.url}
        controls
        playsInline
        preload="metadata"
        aria-label={alt}
        className={cn(
          "size-full bg-black",
          contain ? "max-h-full object-contain" : "object-cover"
        )}
      />
    );
  }
  if (contain) {
    return (
      <img
        src={slide.url}
        alt={alt}
        className="max-h-full max-w-full object-contain"
      />
    );
  }
  return (
    <PhotoFrame
      src={slide.url}
      alt={alt}
      ratio="4:3"
      eager={eager}
      className="size-full rounded-md"
    />
  );
}

/**
 * The lot gallery: swipeable photos with a peek of the next one, a
 * "1 / 9 · caption" counter, a full-screen button, and a thumbnail strip. The
 * cold-start video, when there is one, is the first slide. Heart and share
 * sit on the photo. Tapping the photo opens the full-screen viewer.
 *
 * @param props - Component props
 * @param props.slides - The video and photos
 * @param props.title - The lot's name, for alt text
 * @param props.actions - Heart and share buttons
 * @param props.viewerAt - Open slide of the full-screen viewer, or null
 * @param props.onViewerChange - Opens or closes the viewer
 * @param props.className - Extra classes merged onto the root element
 * @returns The gallery
 */
export function LotGallery({
  slides,
  title,
  actions,
  viewerAt,
  onViewerChange,
  className,
}: LotGalleryProps) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const goTo = useCallback((next: number) => {
    const el = track.current;
    const child = el?.children[next];
    if (el && child instanceof HTMLElement) {
      el.scrollTo({
        left: child.offsetLeft - el.offsetLeft,
        behavior: "smooth",
      });
    }
    setIndex(next);
  }, []);

  if (slides.length === 0) {
    return (
      <div className={className}>
        <PhotoFrame alt={`${title}, no photo yet`} ratio="4:3" />
      </div>
    );
  }

  return (
    <div data-slot="lot-gallery" className={cn("relative", className)}>
      <div className="relative">
        <div
          ref={track}
          role="group"
          aria-roledescription="carousel"
          aria-label={`${title} photos`}
          tabIndex={0}
          onScroll={(event) => {
            const el = event.currentTarget;
            const first = el.children[0];
            const width =
              first instanceof HTMLElement ? first.offsetWidth + 8 : 0;
            if (width > 0) {
              const next = Math.round(el.scrollLeft / width);
              setIndex((prev) => (prev === next ? prev : next));
            }
          }}
          className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((slide, i) => (
            <div
              key={`${slide.url}-${String(i)}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${String(i + 1)} of ${String(slides.length)}`}
              className="relative aspect-[4/3] w-[92%] shrink-0 snap-center md:w-full"
            >
              <SlideMedia
                slide={slide}
                alt={`${title}, ${slide.caption ?? `photo ${String(i + 1)}`}`}
                eager={i === 0}
              />
              {slide.kind === "photo" ? (
                <button
                  type="button"
                  aria-label={`Open photo ${String(i + 1)} full screen`}
                  className="absolute inset-0"
                  onClick={() => {
                    onViewerChange(i);
                  }}
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white/90 bg-black/40 text-white"
                >
                  <Play className="size-6 fill-current" />
                </span>
              )}
            </div>
          ))}
        </div>
        {actions ? (
          <div className="absolute top-0 right-0 z-[3] flex flex-col md:right-0">
            {actions}
          </div>
        ) : null}
        <p
          aria-live="polite"
          className="num pointer-events-none absolute bottom-2.5 left-2.5 rounded-sm bg-black/65 px-2 py-0.5 text-[13px] font-semibold text-white"
        >
          {counterText(index, slides)}
        </p>
        <button
          type="button"
          aria-label="View full screen"
          className="absolute right-2.5 bottom-2.5 flex size-9 items-center justify-center rounded-sm bg-black/65 text-white md:right-2.5"
          onClick={() => {
            onViewerChange(index);
          }}
        >
          <Maximize2 aria-hidden="true" className="size-[18px]" />
        </button>
      </div>

      <Thumbnails
        slides={slides}
        current={index}
        onSelect={goTo}
        className="mt-2"
      />

      <GalleryViewer
        slides={slides}
        title={title}
        at={viewerAt}
        onChange={(next) => {
          if (next !== null) goTo(next);
          onViewerChange(next);
        }}
      />
    </div>
  );
}

/**
 * The strip of thumbnails under the photo or in the viewer.
 *
 * @param props - Component props
 * @param props.slides - The slides
 * @param props.current - The current index
 * @param props.onSelect - Called with the tapped index
 * @param props.className - Extra classes merged onto the strip
 * @returns The strip
 */
function Thumbnails({
  slides,
  current,
  onSelect,
  className,
}: {
  slides: readonly GallerySlide[];
  current: number;
  onSelect: (index: number) => void;
  className?: string;
}) {
  return (
    <ul
      aria-label="Photo thumbnails"
      className={cn(
        "m-0 flex list-none gap-1.5 overflow-x-auto p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {slides.map((slide, i) => (
        <li key={`${slide.url}-${String(i)}`} className="shrink-0">
          <button
            type="button"
            aria-label={`Show ${slide.caption ?? `photo ${String(i + 1)}`}`}
            aria-current={i === current}
            onClick={() => {
              onSelect(i);
            }}
            className={cn(
              "relative block h-12 w-16 overflow-hidden rounded-sm bg-muted outline-offset-2",
              i === current ? "ring-2 ring-primary" : "opacity-80"
            )}
          >
            {slide.kind === "video" ? (
              <span className="flex size-full items-center justify-center bg-black text-white">
                <Play aria-hidden="true" className="size-4 fill-current" />
              </span>
            ) : (
              <img
                src={slide.url}
                alt=""
                loading="lazy"
                className="size-full object-cover"
              />
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The full-screen viewer: one large photo or video, its caption, previous and
 * next, close, and the thumbnail strip. Escape closes it; the arrow keys move.
 *
 * @param props - Component props
 * @param props.slides - The slides
 * @param props.title - The lot's name, for alt text
 * @param props.at - Open slide, or null when closed
 * @param props.onChange - Moves to a slide, or closes with null
 * @returns The viewer
 */
function GalleryViewer({
  slides,
  title,
  at,
  onChange,
}: {
  slides: readonly GallerySlide[];
  title: string;
  at: number | null;
  onChange: (at: number | null) => void;
}) {
  const open = at !== null;
  const current = at ?? 0;
  const slide = slides[current];

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" && current < slides.length - 1) {
        onChange(current + 1);
      } else if (event.key === "ArrowLeft" && current > 0) {
        onChange(current - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, current, slides.length, onChange]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onChange(null);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col text-white outline-none"
        >
          <div className="flex items-center justify-between px-4 py-2">
            <Dialog.Title className="num text-[15px] font-semibold">
              {counterText(current, slides)}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="-mr-2 flex size-11 items-center justify-center"
            >
              <X aria-hidden="true" className="size-6" />
            </Dialog.Close>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
            {slide ? (
              <SlideMedia
                slide={slide}
                alt={`${title}, ${slide.caption ?? `photo ${String(current + 1)}`}`}
                contain
              />
            ) : null}
            {current > 0 ? (
              <button
                type="button"
                aria-label="Previous photo"
                className="absolute left-1 flex size-11 items-center justify-center rounded-full bg-black/50"
                onClick={() => {
                  onChange(current - 1);
                }}
              >
                <ChevronLeft aria-hidden="true" className="size-6" />
              </button>
            ) : null}
            {current < slides.length - 1 ? (
              <button
                type="button"
                aria-label="Next photo"
                className="absolute right-1 flex size-11 items-center justify-center rounded-full bg-black/50"
                onClick={() => {
                  onChange(current + 1);
                }}
              >
                <ChevronRight aria-hidden="true" className="size-6" />
              </button>
            ) : null}
          </div>
          <Thumbnails
            slides={slides}
            current={current}
            onSelect={onChange}
            className="px-4 py-3"
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
