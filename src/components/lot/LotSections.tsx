import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  BadgeDollarSign,
  ChevronRight,
  FileText,
  Info,
  MapPin,
  ShieldCheck,
  Check,
  Truck,
  User,
  Wallet,
} from "lucide-react";

import { IconList, IconRow } from "@/components/ds/IconRow";
import { NumberedSteps } from "@/components/ds/NumberedSteps";
import { SectionHeader } from "@/components/ds/SectionHeader";
import { SpecTable, type SpecItem } from "@/components/ds/SpecTable";
import {
  COLLECTION_WINDOW_DAYS,
  PAYMENT_WINDOW_HOURS,
} from "@/lib/auctionRules";
import { formatRand } from "@/lib/currency";
import { groupDigits as group } from "@/lib/lotPage";
import { cn } from "@/lib/utils";
import type { SellerVatKind } from "@/lib/vat";

/**
 * A tap-to-call link.
 *
 * @param props - Component props
 * @param props.phone - The number as shown
 * @param props.tel - The `tel:` link
 * @returns The link
 */
function CallLink({ phone, tel }: { phone: string; tel: string }) {
  return (
    <a href={tel} className="font-medium underline underline-offset-2">
      {phone}
    </a>
  );
}

/**
 * A titled section with a divider above it, as the lot page stacks them.
 *
 * @param props - Component props
 * @param props.title - The section title
 * @param props.children - The section body
 * @param props.className - Extra classes merged onto the section
 * @returns The section
 */
export function LotSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn("border-t border-border pt-5", className)}
    >
      <SectionHeader title={title} className="mb-2" />
      {children}
    </section>
  );
}

interface ConditionProps {
  /** What the seller wrote about the machine's condition. */
  sellerNotes?: string;
  /** The seller's VAT kind and type label ("Farming business"). */
  sellerVatKind: SellerVatKind;
  sellerTypeLabel?: string;
  /** Link to the inspection PDF the seller uploaded, if any. */
  reportHref?: string;
  /** The viewing phone number and its `tel:` link, when configured. */
  phone?: { text: string; tel: string };
}

/**
 * The Condition section: the seller's own words ("Seller says:"), that the
 * seller's ID was checked, who the seller is and what VAT applies, and the
 * as-is line with a tap-to-call number. AgriBid does not inspect machines, so
 * a condition claim is always the seller's.
 *
 * @param props - Component props
 * @param props.sellerNotes - The seller's condition text
 * @param props.sellerVatKind - vat or private
 * @param props.sellerTypeLabel - The seller type, e.g. "Farming business"
 * @param props.reportHref - The seller's inspection PDF
 * @param props.phone - The viewing phone number
 * @returns The section
 */
export function ConditionSection({
  sellerNotes,
  sellerVatKind,
  sellerTypeLabel,
  reportHref,
  phone,
}: ConditionProps) {
  const notes = sellerNotes?.trim();
  const seller =
    sellerVatKind === "private"
      ? `Seller: ${sellerTypeLabel ?? "Private seller"}`
      : `Seller: ${sellerTypeLabel ? `${sellerTypeLabel} · ` : ""}VAT registered`;
  return (
    <LotSection title="Condition">
      <IconList>
        {notes ? <IconRow icon={Check}>Seller says: {notes}</IconRow> : null}
        <IconRow icon={ShieldCheck}>Seller ID checked (FICA)</IconRow>
        <IconRow icon={User}>{seller}</IconRow>
        <IconRow icon={BadgeDollarSign}>
          {sellerVatKind === "private"
            ? "No VAT on the bid (private seller)"
            : "VAT: tax invoice issued"}
        </IconRow>
        {reportHref ? (
          <IconRow icon={FileText}>
            <a
              href={reportHref}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              Seller&apos;s inspection report (PDF)
            </a>
          </IconRow>
        ) : null}
        <IconRow icon={Info}>
          {phone ? (
            <>
              Sold as is. Book a viewing before you bid:{" "}
              <CallLink phone={phone.text} tel={phone.tel} />
            </>
          ) : (
            "Sold as is."
          )}
        </IconRow>
      </IconList>
    </LotSection>
  );
}

/**
 * "If you win": invoice, EFT within 48 hours, the deposit counting towards
 * payment (when a deposit is charged), and collection within 7 days. The
 * windows come from `auctionRules`.
 *
 * @param props - Component props
 * @param props.deposit - The deposit amount, or undefined when none is charged
 * @returns The section
 */
export function IfYouWinSection({ deposit }: { deposit?: number }) {
  const steps: ReactNode[] = [
    "We email your invoice when the auction closes.",
    `Pay by EFT within ${String(PAYMENT_WINDOW_HOURS)} hours.`,
    ...(deposit
      ? [`Your ${formatRand(deposit)} deposit counts towards payment.`]
      : []),
    `Collect within ${String(COLLECTION_WINDOW_DAYS)} days of payment, or we arrange transport.`,
  ];
  return (
    <LotSection title="If you win">
      <NumberedSteps steps={steps} />
    </LotSection>
  );
}

/** The lot facts the Specs section reads. */
export interface SpecsLot {
  year: number;
  operatingHours: number;
  powerKw?: number;
  drive?: "2wd" | "4wd" | "tracks";
  transmission?: string;
  frontTyrePct?: number;
  rearTyrePct?: number;
  serialNumber?: string;
  make: string;
  model: string;
}

const DRIVE_TEXT = { "2wd": "2WD", "4wd": "4WD", tracks: "Tracks" } as const;

/**
 * The Specs table: year, hours (with "See meter photo" when the lot has an
 * hour-meter photo), power, drive, transmission, tyres, serial number, make
 * and model. Empty rows are hidden.
 *
 * @param props - Component props
 * @param props.lot - The lot facts
 * @param props.onSeeMeter - Opens the hour-meter photo; the link is hidden without it
 * @returns The section
 */
export function SpecsSection({
  lot,
  onSeeMeter,
}: {
  lot: SpecsLot;
  onSeeMeter?: () => void;
}) {
  const tyres = [
    lot.frontTyrePct !== undefined
      ? `Front ${String(lot.frontTyrePct)}%`
      : null,
    lot.rearTyrePct !== undefined ? `Rear ${String(lot.rearTyrePct)}%` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
  const items: SpecItem[] = [
    { label: "Year", value: lot.year ? String(lot.year) : undefined },
    {
      label: "Hours",
      value: lot.operatingHours ? (
        <>
          {group(lot.operatingHours)} hrs
          {onSeeMeter ? (
            <>
              {" · "}
              <button
                type="button"
                onClick={onSeeMeter}
                className="font-semibold underline underline-offset-2"
              >
                See meter photo
              </button>
            </>
          ) : null}
        </>
      ) : undefined,
    },
    {
      label: "Power",
      value: lot.powerKw ? `${group(lot.powerKw)} kW` : undefined,
    },
    { label: "Drive", value: lot.drive ? DRIVE_TEXT[lot.drive] : undefined },
    { label: "Transmission", value: lot.transmission },
    { label: "Tyres", value: tyres || undefined },
    { label: "Serial no.", value: lot.serialNumber },
    { label: "Make", value: lot.make },
    { label: "Model", value: lot.model },
  ];
  return (
    <LotSection title="Specs">
      <SpecTable
        items={items}
        className="[&_dt]:w-32 [&_div]:justify-start [&_dd]:text-left"
      />
    </LotSection>
  );
}

interface ViewCollectProps {
  /** "Malmesbury, Western Cape". */
  place: string;
  phone?: { text: string; tel: string };
  finance?: { name: string | null; phone: string | null; tel?: string };
  className?: string;
  /** Draw the divider and title (phone) or just the rows (the desktop column). */
  heading?: boolean;
}

/**
 * "View & collect": where the machine stands and how to book a viewing,
 * "Request a transport quote" (to the support page for now), and the finance
 * contact (tap to call). Rows with no data are hidden.
 *
 * @param props - Component props
 * @param props.place - Town and province
 * @param props.phone - The viewing phone number
 * @param props.finance - The finance contact
 * @param props.className - Extra classes merged onto the root element
 * @param props.heading - Show the section heading
 * @returns The rows, wrapped in a section when `heading` is set
 */
export function ViewCollect({
  place,
  phone,
  finance,
  className,
  heading = true,
}: ViewCollectProps) {
  const rows = (
    <IconList className={className}>
      {place ? (
        <IconRow icon={MapPin}>
          Stands near {place}.
          {phone ? (
            <>
              {" "}
              Call <CallLink phone={phone.text} tel={phone.tel} /> to book a
              viewing.
            </>
          ) : null}
        </IconRow>
      ) : null}
      <li className="border-t border-border">
        <Link
          to="/support"
          className="flex min-h-12 items-center gap-2.5 py-1.5 text-[15px] font-medium"
        >
          <Truck
            aria-hidden="true"
            className="size-[18px] shrink-0 text-primary"
          />
          <span className="flex-1">Request a transport quote</span>
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      </li>
      {finance?.phone && finance.tel ? (
        <li className="border-t border-border">
          <a
            href={finance.tel}
            className="flex min-h-12 items-center gap-2.5 py-1.5 text-[15px] font-medium"
          >
            <Wallet
              aria-hidden="true"
              className="size-[18px] shrink-0 text-primary"
            />
            <span className="flex-1">
              Need finance?{finance.name ? ` ${finance.name},` : ""}{" "}
              {finance.phone}
            </span>
            <ChevronRight aria-hidden="true" className="size-4" />
          </a>
        </li>
      ) : null}
    </IconList>
  );
  return heading ? (
    <LotSection title="View & collect">{rows}</LotSection>
  ) : (
    rows
  );
}
