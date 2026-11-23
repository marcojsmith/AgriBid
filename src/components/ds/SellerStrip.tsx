import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

interface SellerStripProps {
  /** The WhatsApp link that starts a valuation chat. */
  href: string;
  /** Seller commission percentage, an Admin setting. Default 8. */
  commissionPct?: number;
  className?: string;
}

/**
 * The seller call to action: a full-width `primary-soft` band, "Selling a
 * machine? WhatsApp us 3 photos for a free valuation. 8% + VAT commission, no
 * listing fee", with an arrow. The whole strip is the link (56px high).
 *
 * @param props - Component props
 * @param props.href - WhatsApp link
 * @param props.commissionPct - Seller commission percentage
 * @param props.className - Extra classes merged onto the link
 * @returns The strip
 */
export function SellerStrip({
  href,
  commissionPct = 8,
  className,
}: SellerStripProps) {
  return (
    <a
      data-slot="seller-strip"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex min-h-14 w-full items-center justify-between gap-3 border-b border-border bg-primary-soft px-4 py-2 text-sm text-foreground",
        className
      )}
    >
      <span>
        <b className="font-bold">Selling a machine?</b> WhatsApp us 3 photos for
        a free valuation. {commissionPct}% + VAT commission, no listing fee
      </span>
      <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-primary" />
    </a>
  );
}
