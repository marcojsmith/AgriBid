import { formatRand } from "@/lib/currency";
import { cn } from "@/lib/utils";

interface DepositLinesProps {
  /** Deposit in rand (an Admin setting). Default 5 000. */
  amount?: number;
  /** Working days within which the deposit is refunded (an Admin setting). Default 3. */
  refundDays?: number;
  /** Use the light-on-green colours of the dark band (home hero, sale header). */
  onDark?: boolean;
  className?: string;
}

/**
 * The two deposit lines shown near every bid call to action:
 * "R 5 000 deposit, refunded within 3 working days if you don't buy" and
 * "Have ready: ID + proof of address". 14px.
 *
 * @param props - Component props
 * @param props.amount - Deposit in rand
 * @param props.refundDays - Refund window in working days
 * @param props.onDark - Colours for the dark green band
 * @param props.className - Extra classes merged onto the root element
 * @returns The two lines
 */
export function DepositLines({
  amount = 5000,
  refundDays = 3,
  onDark = false,
  className,
}: DepositLinesProps) {
  return (
    <p
      data-slot="deposit-lines"
      className={cn(
        "text-sm leading-[1.45]",
        onDark ? "text-hero-muted" : "text-muted-foreground",
        className
      )}
    >
      {formatRand(amount)} deposit, refunded within {refundDays} working days if
      you don&apos;t buy
      <br />
      Have ready: ID + proof of address
    </p>
  );
}
