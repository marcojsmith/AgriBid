import { cn } from "@/lib/utils";

interface LotChipProps {
  /** The lot number shown as "Lot {number}". */
  number: number | string;
  /** Position over a photo, top-left with an 8px inset. Otherwise it sits inline beside a title. */
  overPhoto?: boolean;
  className?: string;
}

/**
 * The "Lot 3" chip: solid near-black fill, white 13px/600 text, a faint inner
 * ring and a 4px radius. One style everywhere: over a photo (top-left) or
 * inline beside the lot title.
 *
 * @param props - Component props
 * @param props.number - The lot number
 * @param props.overPhoto - Position over a photo, top-left
 * @param props.className - Extra classes merged onto the root element
 * @returns The chip
 */
export function LotChip({
  number,
  overPhoto = false,
  className,
}: LotChipProps) {
  return (
    <span
      data-slot="lot-chip"
      className={cn(
        "num inline-block rounded-sm bg-chip px-2 py-0.5 text-[13px] leading-normal lg:text-sm font-semibold whitespace-nowrap text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/.22)]",
        overPhoto && "absolute top-2 left-2 z-[2]",
        className
      )}
    >
      Lot {number}
    </span>
  );
}
