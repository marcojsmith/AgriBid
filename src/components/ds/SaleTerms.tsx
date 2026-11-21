import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

interface SaleTermsProps {
  /** Buyer's premium percentage; the row is hidden when unset. */
  buyersPremiumPct?: number | null;
  /** VAT percentage; the row is hidden when unset. */
  vatPct?: number | null;
  /** Where "Full auction rules" points. */
  rulesHref?: string;
  className?: string;
}

/**
 * Platform-wide sale terms: payment, viewing, collection, buyer's premium and
 * VAT, with a "Full auction rules" link. Premium and VAT rows are hidden when
 * their value is unset so we never show a made-up number.
 *
 * Use it on the auction event page and next to the bid panel.
 *
 * @param props - Component props
 * @param props.buyersPremiumPct
 * @param props.vatPct
 * @param props.rulesHref
 * @param props.className
 * @returns The sale terms list
 */
export function SaleTerms({
  buyersPremiumPct,
  vatPct,
  rulesHref = "/faq",
  className,
}: SaleTermsProps) {
  const rows: { label: string; value: string }[] = [
    { label: "Payment", value: "EFT within 48 hours of the sale" },
    { label: "Viewing", value: "By appointment" },
    { label: "Collection", value: "Within 7 days of payment" },
  ];
  if (typeof buyersPremiumPct === "number") {
    rows.push({
      label: "Buyer's premium",
      value: `${String(buyersPremiumPct)}% of the winning bid`,
    });
  }
  if (typeof vatPct === "number") {
    rows.push({
      label: "VAT",
      value: `${String(vatPct)}% added where applicable`,
    });
  }
  return (
    <section
      data-slot="sale-terms"
      aria-label="Sale terms"
      className={cn("text-sm", className)}
    >
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-[13px] text-muted-foreground">{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <Link
        to={rulesHref}
        className="mt-3 inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
      >
        Full auction rules
      </Link>
    </section>
  );
}
