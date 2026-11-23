import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { StickyActionBar } from "./StickyActionBar";
import { WhatsAppButton } from "./WhatsAppButton";

interface StickyBarProps {
  /** The key figure: "Closes in 2d 3h", "R 414 000". Truncates to one line. */
  title: ReactNode;
  /** Context under the title: "Tue 25 Nov, 11:00", "You're leading". */
  sub?: ReactNode;
  /** Colour of the sub line: ok (green, leading) or warn (amber, outbid). */
  subTone?: "default" | "ok" | "warn";
  /** Under 10 minutes: the title (the countdown) turns red. */
  urgent?: boolean;
  /** The wa.me link for the 44px WhatsApp icon button. */
  whatsappHref: string;
  /** The call to action label, e.g. "Register to bid". */
  cta: ReactNode;
  /** Link target of the call to action. Use this or `onCta`. */
  ctaHref?: string;
  /** Click handler of the call to action. */
  onCta?: () => void;
  /** `outline` when the user is already leading ("Raise my bid"). */
  ctaVariant?: "primary" | "outline";
  /** Accessible name of the bar. */
  label?: string;
  /** Hide the bar (e.g. while the bid panel is in view). */
  hidden?: boolean;
  className?: string;
}

const SUB_TONE = {
  default: "text-muted-foreground",
  ok: "font-semibold text-ok-fg",
  warn: "font-semibold text-warn-fg",
} as const;

/**
 * The phone sticky bar, one layout in this order: [title / sub] [WhatsApp 44px]
 * [CTA]. The title is the key figure, the sub is context. Variants: a sale
 * (time and date), a lot opening, leading (green sub, outline CTA), outbid
 * (amber sub) and under 10 minutes (red countdown title). Hidden from `md`.
 * Pages add about 5rem of bottom padding and keep the footer reachable.
 *
 * @param props - Component props
 * @param props.title - The key figure
 * @param props.sub - Context line
 * @param props.subTone - default, ok or warn
 * @param props.urgent - Red title for the final 10 minutes
 * @param props.whatsappHref - WhatsApp link
 * @param props.cta - Call to action label
 * @param props.ctaHref - Call to action link
 * @param props.onCta - Call to action click handler
 * @param props.ctaVariant - primary or outline
 * @param props.label - Accessible name of the bar
 * @param props.hidden - Hide the bar
 * @param props.className - Extra classes merged onto the bar
 * @returns The bar
 */
export function StickyBar({
  title,
  sub,
  subTone = "default",
  urgent = false,
  whatsappHref,
  cta,
  ctaHref,
  onCta,
  ctaVariant = "primary",
  label = "Actions",
  hidden = false,
  className,
}: StickyBarProps) {
  const variant = ctaVariant === "outline" ? "outline" : "default";
  const ctaClass = cn(
    "h-12 px-3 text-[15px] font-semibold max-md:h-[46px]",
    ctaVariant === "outline" && "bg-card"
  );
  return (
    <StickyActionBar label={label} hidden={hidden} className={className}>
      <div data-slot="sticky-bar-text" className="min-w-0 flex-1">
        <b
          className={cn(
            "num block truncate text-[14.5px] font-bold",
            urgent && "text-urgent-fg"
          )}
        >
          {title}
        </b>
        {sub ? (
          <small className={cn("num block text-[13px]", SUB_TONE[subTone])}>
            {sub}
          </small>
        ) : null}
      </div>
      <WhatsAppButton href={whatsappHref} />
      {ctaHref ? (
        <Button asChild variant={variant} className={ctaClass}>
          <a href={ctaHref}>{cta}</a>
        </Button>
      ) : (
        <Button variant={variant} className={ctaClass} onClick={onCta}>
          {cta}
        </Button>
      )}
    </StickyActionBar>
  );
}
