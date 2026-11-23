import type { ReactNode } from "react";
import {
  ChevronRight,
  CreditCard,
  Landmark,
  MapPin,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";

import {
  COLLECTION_WINDOW_DAYS,
  PAYMENT_WINDOW_HOURS,
} from "@/lib/auctionRules";
import { cn } from "@/lib/utils";

/** The finance contact an admin sets, as `getPlatformSettings` returns it. */
export interface FinanceContact {
  name: string | null;
  company: string | null;
  phone: string | null;
}

interface BeforeYouBidProps {
  /** Where "Request a transport quote" goes. */
  transportHref: string;
  /** The finance contact; the "Need finance?" row is hidden when there is no phone. */
  finance?: FinanceContact | null;
  /** Whether a registration deposit applies (adds the deposit sentence to Payment). */
  depositEnabled?: boolean;
  className?: string;
}

interface RowProps {
  icon: LucideIcon;
  title: ReactNode;
  href?: string;
  children: ReactNode;
}

/**
 * One row: icon, bold title (a link when `href` is set, with a chevron) and a
 * short line of text. Rows sit under a hairline divider.
 *
 * @param props - Component props
 * @param props.icon - The lucide icon
 * @param props.title - The title
 * @param props.href - Makes the title a link and adds the chevron
 * @param props.children - The text
 * @returns The row
 */
function Row({ icon: Icon, title, href, children }: RowProps) {
  const body = (
    <div className="flex min-w-0 flex-1 gap-3">
      <Icon
        aria-hidden="true"
        className="mt-0.5 size-5 shrink-0 text-primary"
      />
      <div className="min-w-0">
        <p
          className={cn(
            "font-semibold",
            href && "underline underline-offset-2"
          )}
        >
          {title}
        </p>
        <p className="text-sm text-muted-foreground">{children}</p>
      </div>
    </div>
  );
  return (
    <li className="border-b border-border py-3.5 first:pt-0 lg:last:border-b-0">
      {href ? (
        <a href={href} className="flex items-center gap-2">
          {body}
          <ChevronRight
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        </a>
      ) : (
        body
      )}
    </li>
  );
}

/**
 * The "Before you bid" block that closes Home, the sale page and the lot page:
 * viewing and collection, a transport quote link, the finance contact, the
 * reserve rule and the payment rule. One column on phones, three on desktop.
 * The finance row is hidden until an admin sets a finance phone, and the
 * deposit sentence only shows while a deposit applies.
 *
 * @param props - Component props
 * @param props.transportHref - Where the transport quote link goes
 * @param props.finance - The finance contact from the platform settings
 * @param props.depositEnabled - Whether a registration deposit applies
 * @param props.className - Extra classes merged onto the section
 * @returns The section
 */
export function BeforeYouBid({
  transportHref,
  finance,
  depositEnabled = true,
  className,
}: BeforeYouBidProps) {
  const phone = finance?.phone?.trim() ?? "";
  const who = [finance?.name, finance?.company]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(", ");
  const financeLine = [who, phone].filter(Boolean).join(", ");
  return (
    <section
      data-slot="before-you-bid"
      aria-labelledby="before-you-bid"
      className={cn("bg-muted/60 py-8 md:py-10", className)}
    >
      <div className="mx-auto max-w-[1200px] px-4">
        <h2 id="before-you-bid" className="mb-4 font-display text-2xl">
          Before you bid
        </h2>
        <ul className="lg:grid lg:grid-cols-3 lg:gap-x-10">
          <Row icon={MapPin} title="Viewing and collection">
            Viewing where each lot stands. Call to book. Collect within{" "}
            {String(COLLECTION_WINDOW_DAYS)} days.
          </Row>
          <Row
            icon={Truck}
            title="Request a transport quote"
            href={transportHref}
          >
            The AgriBid team replies with a price.
          </Row>
          {phone ? (
            <Row
              icon={Landmark}
              title="Need finance?"
              href={`tel:${phone.replace(/[^0-9+]/g, "")}`}
            >
              {financeLine}
            </Row>
          ) : null}
          <Row icon={ShieldCheck} title="Reserve">
            The seller&apos;s minimum price. Each lot shows whether it&apos;s
            met. If bidding ends below it, the seller decides whether to accept.
          </Row>
          <Row icon={CreditCard} title="Payment">
            EFT within {String(PAYMENT_WINDOW_HOURS)} hours.
            {depositEnabled ? " Your deposit counts towards payment." : ""}
          </Row>
        </ul>
      </div>
    </section>
  );
}
