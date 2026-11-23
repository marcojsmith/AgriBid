import { formatRand } from "@/lib/currency";
import { cn } from "@/lib/utils";
import {
  DEFAULT_VAT_RATE_PCT,
  calculateBuyerTotal,
  premiumFromRate,
  vatBaseForSeller,
  type SellerVatKind,
} from "@/lib/vat";

interface CostBoxProps {
  /** The bid to work out, in rand. Default 400 000. */
  bid?: number;
  /** vat: VAT-registered seller. private: private seller (VAT on the premium only). any: seller not known (Home, Event). */
  seller?: SellerVatKind;
  /** Buyer's premium as a percentage (12 = 12%). Default 12. */
  premiumPct?: number;
  /** Fixed buyer fees in rand, charged before VAT. Default 0. */
  fixedFees?: number;
  /** VAT rate as a percentage. Default 15. */
  vatRatePct?: number;
  /** Names the lot the example is for, shown as "e.g. {example}". */
  example?: string;
  /** Use the light-on-green colours of the dark band. */
  onDark?: boolean;
  /** Where "Fees & rules" goes. Ignored when `onFeesClick` is set. */
  feesHref?: string;
  /** Opens the Fees & rules sheet instead of linking. */
  onFeesClick?: () => void;
  className?: string;
}

const pct = (n: number): string => String(Number(n.toFixed(2)));

/**
 * The worked total: "Bid R 400 000 → pay R 515 200", then the rule in plain
 * words and a "Fees & rules" link. The figure comes from `calculateBuyerTotal`
 * in `src/lib/vat.ts`, the single source of the maths; a private seller's lot
 * charges VAT on the premium only, a VAT-registered seller's on bid plus
 * premium. With `seller="any"` (Home, Event) the rule says only "+ VAT" and
 * the example uses the VAT-registered maths.
 *
 * @param props - Component props
 * @param props.bid - The bid to work out
 * @param props.seller - Seller kind: vat, private or any
 * @param props.premiumPct - Buyer's premium percentage
 * @param props.fixedFees - Fixed buyer fees in rand, before VAT
 * @param props.vatRatePct - VAT percentage
 * @param props.example - Names the example lot
 * @param props.onDark - Colours for the dark green band
 * @param props.feesHref - Link target for "Fees & rules"
 * @param props.onFeesClick - Opens the Fees & rules sheet
 * @param props.className - Extra classes merged onto the root element
 * @returns The cost box
 */
export function CostBox({
  bid = 400_000,
  seller = "vat",
  premiumPct = 12,
  fixedFees = 0,
  vatRatePct = DEFAULT_VAT_RATE_PCT,
  example,
  onDark = false,
  feesHref,
  onFeesClick,
  className,
}: CostBoxProps) {
  const { bid: shownBid, total } = calculateBuyerTotal({
    bid,
    premium: premiumFromRate(bid, premiumPct / 100) + fixedFees,
    vatRatePct,
    vatBase: vatBaseForSeller(seller),
  });
  const vat = `${pct(vatRatePct)}% VAT`;
  const rule =
    seller === "private"
      ? `${pct(premiumPct)}% premium + ${vat} on the premium`
      : seller === "any"
        ? `${pct(premiumPct)}% premium + VAT`
        : `${pct(premiumPct)}% premium + ${vat}`;
  const linkClass = cn(
    "underline underline-offset-2",
    onDark ? "text-hero-foreground" : "text-foreground"
  );
  const secondary = onDark ? "text-hero-muted" : "text-muted-foreground";

  return (
    <div
      data-slot="cost-box"
      data-seller={seller}
      className={cn(
        "flex flex-col gap-px rounded-md border px-3 py-2.5",
        onDark ? "border-hero-muted/40" : "border-border",
        className
      )}
    >
      {example ? (
        <span className={cn("text-sm", secondary)}>e.g. {example}</span>
      ) : null}
      <b className="num text-base font-bold">
        Bid {formatRand(shownBid)} → pay {formatRand(total)}
      </b>
      <span className={cn("text-sm", secondary)}>
        {rule} ·{" "}
        {onFeesClick ? (
          <button type="button" className={linkClass} onClick={onFeesClick}>
            Fees &amp; rules
          </button>
        ) : feesHref ? (
          <a href={feesHref} className={linkClass}>
            Fees &amp; rules
          </a>
        ) : (
          <span>Fees &amp; rules</span>
        )}
      </span>
    </div>
  );
}
