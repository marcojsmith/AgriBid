import { formatRand } from "@/lib/currency";
import { cn } from "@/lib/utils";

interface MoneyProps {
  /** Amount in rand. */
  amount: number;
  /** Optional label, e.g. "Opening bid", "Current bid", "Sold for". */
  label?: string;
  /** Append "excl. VAT". */
  exclVat?: boolean;
  /** Render the figure in the display serif (lot page prices). */
  display?: boolean;
  className?: string;
}

/**
 * A price in whole rand (`R 200 000`) with tabular figures, an optional label
 * above it and an optional "excl. VAT" suffix.
 *
 * Use it for every price shown to a user. Do not format money by hand.
 *
 * @param props - Component props
 * @param props.amount - Amount in rand
 * @param props.label - Optional label shown above the amount
 * @param props.exclVat - Append "excl. VAT" after the amount
 * @param props.display - Use the display serif for the figure
 * @param props.className - Extra classes merged onto the root element
 * @returns The price element
 */
export function Money({
  amount,
  label,
  exclVat = false,
  display = false,
  className,
}: MoneyProps) {
  return (
    <span data-slot="money" className={cn("inline-flex flex-col", className)}>
      {label ? (
        <span className="text-[13px] text-muted-foreground">{label}</span>
      ) : null}
      <span>
        <span
          className={cn(
            "num font-semibold",
            display && "font-display text-3xl"
          )}
        >
          {formatRand(amount)}
        </span>
        {exclVat ? (
          <span className="ml-1 text-[13px] font-normal text-muted-foreground">
            excl. VAT
          </span>
        ) : null}
      </span>
    </span>
  );
}
