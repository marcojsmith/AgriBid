import { useRef, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

/** One option of a segmented control. */
export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Optional count shown after the label. */
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the group. */
  ariaLabel: string;
  className?: string;
}

/**
 * A single-choice control rendered as an accessible radiogroup with roving
 * tabindex and arrow-key support. 44px tall on phone, 36px from `md`.
 *
 * Use it to switch a view of the same list (Live & upcoming / Closing soon /
 * Results). For navigation between pages use links, not this.
 *
 * @param props - Component props
 * @param props.options - The selectable options
 * @param props.value - The currently selected value
 * @param props.onChange - Called with the new value when the selection changes
 * @param props.ariaLabel - Accessible name of the group
 * @param props.className - Extra classes merged onto the root element
 * @returns The control
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const hasSelection = options.some((o) => o.value === value);
  const refs = useRef(new Map<number, HTMLButtonElement>());

  const move = (from: number, delta: number) => {
    const next = (from + delta + options.length) % options.length;
    const option = options.at(next);
    if (!option) return;
    onChange(option.value);
    refs.current.get(next)?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      move(index, 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      move(index, -1);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-slot="segmented-control"
      className={cn(
        "inline-flex rounded-md border border-border bg-muted p-0.5",
        className
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              if (el) refs.current.set(index, el);
              else refs.current.delete(index);
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (!hasSelection && index === 0) ? 0 : -1}
            onClick={() => {
              onChange(option.value);
            }}
            onKeyDown={(e) => {
              onKeyDown(e, index);
            }}
            className={cn(
              "min-h-11 rounded-sm px-3 text-sm font-medium transition-colors md:min-h-9",
              selected
                ? "bg-card text-foreground ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
            {typeof option.count === "number" ? (
              <span className="num ml-1.5 text-[13px] text-muted-foreground">
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
