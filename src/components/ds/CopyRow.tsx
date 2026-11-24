import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { showToast } from "./showToast";

interface CopyRowProps {
  label: string;
  value: string;
  /**
   * Tint the row (the deposit reference): `primary-soft` background, 20px
   * value. Meant for the last row of a card with 14px side padding (it bleeds
   * out with a negative margin).
   */
  highlight?: boolean;
  /** Called after the value was copied. Defaults to the "Copied" toast. */
  onCopied?: () => void;
  className?: string;
}

/**
 * A row for a value the buyer must copy exactly (bank details, deposit
 * reference): 14px muted label, 17px/700 value, and an outline "Copy" button
 * (44px) on the right. Rows divide themselves with a top border.
 *
 * @param props - Component props
 * @param props.label - What the value is, e.g. "Account number"
 * @param props.value - The text to show and copy
 * @param props.highlight - Tint the row
 * @param props.onCopied - Replaces the default "Copied" toast
 * @param props.className - Extra classes merged onto the root element
 * @returns The row
 */
export function CopyRow({
  label,
  value,
  highlight = false,
  onCopied,
  className,
}: CopyRowProps) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      showToast("Couldn't copy", "error");
      return;
    }
    if (onCopied) onCopied();
    else showToast("Copied");
  };

  return (
    <div
      data-slot="copy-row"
      className={cn(
        "flex items-center justify-between gap-2.5 border-t border-border py-2.5 first:border-t-0 [h2+&]:border-t-0 [h3+&]:border-t-0",
        highlight && "-mx-3.5 rounded-b bg-primary-soft px-3.5",
        className
      )}
    >
      <span className="min-w-0">
        <small className="block text-[13px] text-muted-foreground">
          {label}
        </small>
        <b
          className={cn(
            "num block break-words",
            highlight
              ? "text-xl font-bold tracking-[0.02em]"
              : "text-base font-semibold"
          )}
        >
          {value}
        </b>
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 shrink-0"
        aria-label={`Copy ${label}`}
        onClick={() => {
          void copy();
        }}
      >
        <Copy aria-hidden="true" />
        Copy
      </Button>
    </div>
  );
}
