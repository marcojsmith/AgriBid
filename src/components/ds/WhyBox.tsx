import { formatSastDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface WhyBoxProps {
  /** Why the document was rejected, in plain words. */
  reason: string;
  /** When the reviewer checked it (milliseconds since the Unix epoch). */
  checkedAt: number;
  className?: string;
}

/**
 * The reason a document was rejected: a 3px destructive left border, "Why" in
 * bold, the reason, then "Checked Sun 22 Nov, 11:40" in muted text.
 *
 * @param props - Component props
 * @param props.reason - The rejection reason
 * @param props.checkedAt - When it was checked
 * @param props.className - Extra classes merged onto the root element
 * @returns The box
 */
export function WhyBox({ reason, checkedAt, className }: WhyBoxProps) {
  return (
    <div
      data-slot="why-box"
      className={cn(
        "mb-4 border-l-[3px] border-destructive py-1 pl-3",
        className
      )}
    >
      <b className="text-sm font-bold">Why</b>
      <p className="my-0.5 text-[15px]">{reason}</p>
      <small className="text-[13px] text-muted-foreground">
        {`Checked ${formatSastDate(checkedAt)}`}
      </small>
    </div>
  );
}
