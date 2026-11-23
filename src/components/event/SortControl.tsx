import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { BottomSheet } from "@/components/ds/BottomSheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { SORT_OPTIONS, type EventSort } from "@/lib/eventPage";
import { cn } from "@/lib/utils";

interface SortControlProps {
  /** The lot count line, e.g. "85 lots". */
  countText: string;
  value: EventSort;
  onChange: (value: EventSort) => void;
  className?: string;
}

/**
 * The row under the filters: "{n} lots" on the left and "Sort: Lot number" on
 * the right. The sort opens as a bottom sheet on phones and as a menu from
 * `md`. Sort is Lot number by default.
 *
 * @param props - Component props
 * @param props.countText - The lot count line
 * @param props.value - The selected sort
 * @param props.onChange - Called with the new sort
 * @param props.className - Extra classes merged onto the row
 * @returns The row
 */
export function SortControl({
  countText,
  value,
  onChange,
  className,
}: SortControlProps) {
  const desktop = useMediaQuery("(min-width: 768px)");
  const [sheetOpen, setSheetOpen] = useState(false);
  const current =
    SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0];
  const trigger = (
    <button
      type="button"
      aria-haspopup={desktop ? "menu" : "dialog"}
      className="inline-flex h-11 items-center gap-1 text-[15px]"
      onClick={
        desktop
          ? undefined
          : () => {
              setSheetOpen(true);
            }
      }
    >
      Sort: {current.label}
      <ChevronDown aria-hidden="true" className="size-4" />
    </button>
  );

  return (
    <div
      data-slot="sort-control"
      className={cn("flex items-center justify-between", className)}
    >
      <p className="num text-[15px] font-medium" role="status">
        {countText}
      </p>
      {desktop ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={value}
              onValueChange={(next) => {
                onChange(next as EventSort);
              }}
            >
              {SORT_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <>
          {trigger}
          <BottomSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            title="Sort"
          >
            <ul role="radiogroup" aria-label="Sort" className="divide-y">
              {SORT_OPTIONS.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={option.value === value}
                    className="flex min-h-12 w-full items-center justify-between text-left text-base"
                    onClick={() => {
                      onChange(option.value);
                      setSheetOpen(false);
                    }}
                  >
                    {option.label}
                    {option.value === value ? (
                      <Check
                        aria-hidden="true"
                        className="size-5 text-primary"
                      />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </BottomSheet>
        </>
      )}
    </div>
  );
}
