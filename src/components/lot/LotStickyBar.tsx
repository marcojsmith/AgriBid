import { StickyBar } from "@/components/ds/StickyBar";
import { useNow } from "@/hooks/useNow";
import { formatRand } from "@/lib/currency";
import { stickyModel, type ViewerBidState } from "@/lib/lotPage";

/** What the bar's call to action does. */
export type LotStickyAction =
  | { kind: "link"; href: string; label: string }
  | { kind: "bid"; amount: number; onBid: () => void }
  | { kind: "raise"; onRaise: () => void };

interface LotStickyBarProps {
  /** The opening price or current bid. */
  price: number;
  hasBids: boolean;
  /** When bidding closes (ms), including any extension. */
  closesAt: number;
  viewer: ViewerBidState;
  action: LotStickyAction;
  whatsappHref?: string;
  /** Hide the bar (the panel's own button is on screen, or the lot is sold). */
  hidden?: boolean;
}

/**
 * The phone sticky bar of a live lot: line 1 "R 400 000 · 2d 3h", line 2 the
 * state ("Opening bid", "You're leading", "Outbid"), the WhatsApp logo and the
 * call to action. Under 10 minutes the countdown leads and turns red, with the
 * seconds ticking. The page hides it for sold lots.
 *
 * @param props - Component props
 * @param props.price - Opening price or current bid
 * @param props.hasBids - Whether any bid exists
 * @param props.closesAt - Closing time (ms)
 * @param props.viewer - The viewer's state
 * @param props.action - What the button does
 * @param props.whatsappHref - WhatsApp link
 * @param props.hidden - Hide the bar
 * @returns The bar
 */
export function LotStickyBar({
  price,
  hasBids,
  closesAt,
  viewer,
  action,
  whatsappHref,
  hidden,
}: LotStickyBarProps) {
  const now = useNow(1000);
  const model = stickyModel({
    price,
    remainingMs: closesAt - now,
    hasBids,
    viewer,
  });
  return (
    <StickyBar
      label="Bidding"
      hidden={hidden}
      title={model.title}
      sub={model.sub}
      subTone={model.subTone}
      urgent={model.urgent}
      whatsappHref={whatsappHref}
      cta={
        action.kind === "link"
          ? action.label
          : action.kind === "bid"
            ? `Bid ${formatRand(action.amount)}`
            : "Raise my bid"
      }
      ctaHref={action.kind === "link" ? action.href : undefined}
      onCta={
        action.kind === "bid"
          ? action.onBid
          : action.kind === "raise"
            ? action.onRaise
            : undefined
      }
      ctaVariant={action.kind === "raise" ? "outline" : "primary"}
    />
  );
}
