import { useEffect, useState } from "react";
import { Wrench, ShieldCheck, Camera } from "lucide-react";

import indexCss from "@/index.css?raw";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ds/Banner";
import { BeforeYouBid } from "@/components/ds/BeforeYouBid";
import { FeesRulesSheet } from "@/components/ds/FeesRulesSheet";
import { HomeFilters } from "@/components/home/HomeFilters";
import { BottomSheet } from "@/components/ds/BottomSheet";
import { ConditionReport } from "@/components/ds/ConditionReport";
import { CostBox } from "@/components/ds/CostBox";
import { Countdown } from "@/components/ds/Countdown";
import { DepositLines } from "@/components/ds/DepositLines";
import { EventMosaic } from "@/components/ds/EventMosaic";
import { FilterChips, type ActiveFilter } from "@/components/ds/FilterChips";
import { IconList, IconRow } from "@/components/ds/IconRow";
import { LotCard } from "@/components/ds/LotCard";
import { LotChip } from "@/components/ds/LotChip";
import { Money } from "@/components/ds/Money";
import { NumberedSteps } from "@/components/ds/NumberedSteps";
import { PhotoFrame } from "@/components/ds/PhotoFrame";
import { ReservePill } from "@/components/ds/ReservePill";
import { SaleTerms } from "@/components/ds/SaleTerms";
import { SellerStrip } from "@/components/ds/SellerStrip";
import { ShareButton } from "@/components/ds/ShareButton";
import { SectionHeader } from "@/components/ds/SectionHeader";
import { SegmentedControl } from "@/components/ds/SegmentedControl";
import { SpecTable } from "@/components/ds/SpecTable";
import { StatusBadge } from "@/components/ds/StatusBadge";
import { StatusPill } from "@/components/ds/StatusPill";
import { StickyBar } from "@/components/ds/StickyBar";
import { Toast } from "@/components/ds/Toast";
import { showToast } from "@/components/ds/showToast";
import { WatchButton } from "@/components/ds/WatchButton";
import { WhatsAppButton } from "@/components/ds/WhatsAppButton";
import { contrastRatio, readHslTokens } from "@/lib/color-contrast";
import { formatRand } from "@/lib/currency";
import { formatSastDate } from "@/lib/dates";
import { formatClosesIn } from "@/lib/countdown";
import type { DisplayStatus } from "@/lib/auction-badges";

/** [foreground token, background token] pairs shown with their contrast. */
const PAIRS: readonly (readonly [string, string])[] = [
  ["foreground", "background"],
  ["muted-foreground", "background"],
  ["primary", "background"],
  ["btn-foreground", "btn"],
  ["primary", "primary-soft"],
  ["hero-foreground", "hero"],
  ["hero-muted", "hero"],
  ["ok-fg", "ok-soft"],
  ["warn-fg", "warn-soft"],
  ["ok-fg", "background"],
  ["warn-fg", "background"],
  ["destructive", "background"],
  ["live-fg", "live-soft"],
  ["soon-fg", "soon-soft"],
  ["urgent-fg", "urgent-soft"],
  ["sold-fg", "sold-soft"],
  ["passed-fg", "passed-soft"],
];

const SWATCHES = [
  "background",
  "card",
  "muted",
  "border",
  "primary",
  "primary-soft",
  "ok-soft",
  "warn-soft",
  "chip",
  "secondary",
  "btn",
  "hero",
  "live-solid",
  "soon-solid",
  "urgent-solid",
  "sold-solid",
  "passed-solid",
  "destructive",
  "ring",
] as const;

const TYPE_SCALE = [
  ["12 · eyebrow, uppercase", "text-xs uppercase tracking-wide"],
  ["13 · meta", "text-[13px]"],
  ["14 · secondary", "text-sm"],
  ["15 · body", "text-[15px]"],
  ["17 · lead", "text-[17px]"],
  ["20 · sheet title", "text-xl font-display"],
  ["22 · section heading", "text-[22px] font-display"],
  ["26 · page h1 (phone)", "text-[26px] font-display"],
  ["32 · lot title (desktop)", "text-[32px] font-display"],
  ["38 · page h1 (desktop band)", "text-[38px] font-display"],
] as const;

const NOW = Date.now();
const STATUSES: readonly DisplayStatus[] = [
  { kind: "live" },
  { kind: "closing-soon", urgent: false },
  { kind: "closing-soon", urgent: true },
  { kind: "opens", startTime: NOW + 3 * 86_400_000 },
  { kind: "sold" },
  { kind: "passed" },
  { kind: "under-consideration" },
];

const LOT = {
  number: 3,
  title: "New Holland T6070",
  href: "#ds-kit",
  photoSrc: `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="hsl(100 25% 55%)"/></svg>'
  )}`,
  year: 2016,
  hours: 4850,
  town: "Malmesbury",
};

const PHOTO = (n: number) => ({
  src: `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="hsl(${String(90 + n * 40)} 25% 55%)"/></svg>`
  )}`,
  alt: `Sample photo ${String(n)}`,
});

/**
 * Dev-only design-system reference: tokens (with contrast), type scale,
 * buttons, badges and every `ds` component in its states. Registered in
 * `App.tsx` only when `import.meta.env.DEV` is true.
 *
 * @returns The reference page
 */
export default function DesignSystem() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );
  const [view, setView] = useState("live");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [feesOpen, setFeesOpen] = useState(false);
  const [watching, setWatching] = useState(false);
  const [filters, setFilters] = useState<ActiveFilter[]>([
    { key: "cat", label: "Tractors" },
    { key: "prov", label: "Free State" },
  ]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const tokens = readHslTokens(indexCss, dark ? ".dark" : ":root");

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-8 pb-24 md:pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Dev only
          </p>
          <h1 className="text-4xl">Design system</h1>
        </div>
        <Button
          variant="outline"
          size="touch"
          aria-pressed={dark}
          onClick={() => {
            setDark((d) => !d);
          }}
        >
          {dark ? "Switch to light" : "Switch to dark"}
        </Button>
      </div>

      <section aria-labelledby="ds-tokens" className="space-y-4">
        <SectionHeader id="ds-tokens" title="Colour tokens" />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SWATCHES.map((name) => (
            <li key={name} className="text-[13px]">
              <div
                className="h-12 rounded-md border border-border"
                style={{ background: `hsl(var(--${name}))` }}
              />
              <span className="font-medium">{name}</span>
            </li>
          ))}
        </ul>
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Text and background contrast</caption>
          <thead>
            <tr className="border-b border-border text-[13px] text-muted-foreground">
              <th className="py-2 font-medium">Pair</th>
              <th className="py-2 font-medium">Sample</th>
              <th className="py-2 text-right font-medium">Contrast</th>
            </tr>
          </thead>
          <tbody>
            {PAIRS.map(([fg, bg]) => {
              const f = tokens.get(fg);
              const b = tokens.get(bg);
              const ratio = f && b ? contrastRatio(f, b) : null;
              return (
                <tr key={`${fg}/${bg}`} className="border-b border-border">
                  <td className="py-2">
                    {fg} on {bg}
                  </td>
                  <td className="py-2">
                    <span
                      className="rounded-sm px-2 py-0.5 text-[13px] font-medium"
                      style={{
                        color: `hsl(var(--${fg}))`,
                        background: `hsl(var(--${bg}))`,
                      }}
                    >
                      Aa 123
                    </span>
                  </td>
                  <td className="num py-2 text-right">
                    {ratio === null ? "n/a" : `${ratio.toFixed(1)}:1`}
                    {ratio !== null && ratio >= 4.5 ? " AA" : " fails AA"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="ds-type" className="space-y-3">
        <SectionHeader id="ds-type" title="Type scale" />
        {TYPE_SCALE.map(([label, cls]) => (
          <p key={label} className={cls}>
            {label}: Tractor, 2019
          </p>
        ))}
        <p className="num text-[15px]">
          Tabular figures: 0123456789 · {formatRand(1234567)}
        </p>
      </section>

      <section aria-labelledby="ds-buttons" className="space-y-3">
        <SectionHeader id="ds-buttons" title="Buttons and badges" />
        <div className="flex flex-wrap gap-3">
          <Button>Place bid</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button size="touch">Touch 44px</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="live">live</Badge>
          <Badge variant="soon">soon</Badge>
          <Badge variant="urgent">urgent</Badge>
          <Badge variant="sold">sold</Badge>
          <Badge variant="passed">passed</Badge>
        </div>
      </section>

      <section aria-labelledby="ds-status" className="space-y-3">
        <SectionHeader
          id="ds-status"
          title="Status, reserve, money, countdown"
        />
        {(["solid", "soft"] as const).map((variant) => (
          <div key={variant} className="flex flex-wrap items-center gap-2">
            <span className="w-12 text-[13px] text-muted-foreground">
              {variant}
            </span>
            {STATUSES.map((s, i) => (
              <StatusBadge key={i} status={s} variant={variant} />
            ))}
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <ReservePill state="applies" />
          <ReservePill state="not-met" />
          <ReservePill state="met" />
          <ReservePill state="none" />
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill outcome="sold" />
          <StatusPill outcome="not-sold" />
          <StatusPill outcome="under-consideration" />
          <LotChip number={3} />
        </div>
        <div className="flex flex-wrap gap-8">
          <Money amount={200000} label="Opening bid" />
          <Money amount={245000} label="Current bid" exclVat />
          <Money amount={310000} label="Sold for" display />
        </div>
        <div className="flex flex-wrap gap-8 text-sm">
          <span>
            Neutral: <Countdown endTime={NOW + 5 * 3_600_000 + 61_000} />
          </span>
          <span>
            Under 1h: <Countdown endTime={NOW + 20 * 60_000} />
          </span>
          <span>
            Under 10 min: <Countdown endTime={NOW + 112_000} />
          </span>
          <span>
            Absolute: <Countdown endTime={NOW + 86_400_000} absolute />
          </span>
          <span>
            Past: <Countdown endTime={NOW - 1000} />
          </span>
          <span>Date: {formatSastDate(NOW)}</span>
          <span>{formatClosesIn(2 * 86_400_000 + 3 * 3_600_000)}</span>
        </div>
      </section>

      <section aria-labelledby="ds-photos" className="space-y-3">
        <SectionHeader id="ds-photos" title="Imagery" />
        <div className="grid gap-4 md:grid-cols-2">
          <EventMosaic
            photos={[PHOTO(1), PHOTO(2), PHOTO(3)]}
            emptyAlt="None"
          />
          <EventMosaic photos={[PHOTO(1), PHOTO(2)]} emptyAlt="None" />
          <EventMosaic photos={[PHOTO(1)]} emptyAlt="None" />
          <EventMosaic photos={[]} emptyAlt="No photos for this sale yet" />
          <PhotoFrame {...PHOTO(4)} ratio="4:3" />
          <PhotoFrame alt="No photo for this lot" ratio="4:3" />
        </div>
      </section>

      <section aria-labelledby="ds-lot" className="space-y-4">
        <SectionHeader
          id="ds-lot"
          title="Lot detail blocks"
          controls={<a href="#ds-lot">Link</a>}
        />
        <div className="grid gap-8 md:grid-cols-2">
          <SpecTable
            items={[
              { label: "Make", value: "John Deere" },
              { label: "Model", value: "6130R" },
              { label: "Year", value: 2019 },
              { label: "Hours", value: undefined },
            ]}
          />
          <ConditionReport
            checklist={{
              engine: true,
              hydraulics: false,
              tires: true,
              notes: "New rear tyres fitted in 2025.",
            }}
            pdfHref="https://example.com/report.pdf"
          />
        </div>
        <SaleTerms buyersPremiumPct={10} vatPct={15} />
        <SaleTerms />
      </section>

      <section aria-labelledby="ds-controls" className="space-y-3">
        <SectionHeader id="ds-controls" title="Controls" />
        <SegmentedControl
          ariaLabel="Auction view"
          value={view}
          onChange={setView}
          options={[
            { value: "live", label: "Live & upcoming", count: 4 },
            { value: "soon", label: "Closing soon", count: 1 },
            { value: "results", label: "Results" },
          ]}
        />
        <FilterChips
          filters={filters}
          onRemove={(key) => {
            setFilters((f) => f.filter((x) => x.key !== key));
          }}
          onClear={() => {
            setFilters([]);
          }}
        />
        <p className="text-[13px] text-muted-foreground">
          The sticky action bar shows below 768px only (resize to see it).
        </p>
      </section>

      <section aria-labelledby="ds-kit" className="space-y-6">
        <SectionHeader id="ds-kit" title="Lot cards" />
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 lg:grid-cols-3 lg:gap-x-6">
          <LotCard
            lot={LOT}
            state="open"
            price={400_000}
            count={8}
            watching={watching}
            onToggleWatch={() => {
              setWatching((w) => !w);
            }}
          />
          <LotCard
            lot={{ ...LOT, number: 4 }}
            state="current-bid"
            price={414_000}
            count={7}
            closesIn="2d 3h"
            onToggleWatch={() => undefined}
          />
          <LotCard
            lot={{ ...LOT, number: 5 }}
            state="sold"
            price={428_000}
            count={9}
          />
          <LotCard
            lot={{ ...LOT, number: 6 }}
            state="not-sold"
            price={310_000}
            count={4}
          />
          <LotCard
            lot={{ ...LOT, number: 7, photoSrc: null, hours: null }}
            state="under-consideration"
            price={355_000}
            count={6}
          />
        </div>
      </section>

      <section aria-labelledby="ds-money" className="space-y-4">
        <SectionHeader id="ds-money" title="Cost, deposit, banners" />
        <div className="grid gap-4 md:grid-cols-3">
          <CostBox seller="vat" feesHref="#ds-money" />
          <CostBox seller="private" feesHref="#ds-money" />
          <CostBox
            seller="any"
            example="Lot 3, New Holland T6070"
            feesHref="#ds-money"
          />
        </div>
        <div className="space-y-2 bg-hero p-4 text-hero-foreground">
          <CostBox seller="any" onDark onFeesClick={() => undefined} />
          <DepositLines onDark />
        </div>
        <DepositLines />
        <div className="grid gap-2 md:grid-cols-2">
          <Banner kind="ok">You&apos;re leading</Banner>
          <Banner kind="warn">You&apos;ve been outbid</Banner>
          <Banner kind="urgent">Bidding extended by 2 minutes</Banner>
          <Banner kind="info">
            Under consideration: the seller decides within 48 hours
          </Banner>
          <Banner kind="sold">Sold for R 428 000</Banner>
        </div>
      </section>

      <section aria-labelledby="ds-actions" className="space-y-4">
        <SectionHeader id="ds-actions" title="Actions and lists" />
        <div className="flex flex-wrap items-center gap-3">
          <WatchButton watching={false} onToggle={() => undefined} />
          <WatchButton watching onToggle={() => undefined} />
          <WhatsAppButton href="https://wa.me/27837000000" />
          <ShareButton
            title="John Deere 8370RT"
            text={`John Deere 8370RT on AgriBid, closes ${formatSastDate(NOW + 2 * 86_400_000)}`}
            url="https://agribid-iota.vercel.app"
            onResult={(result) => {
              if (result === "copied") showToast("Link copied");
            }}
          />
          <Button
            variant="outline"
            onClick={() => {
              setSheetOpen(true);
            }}
          >
            Open bottom sheet
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              showToast(
                "Watching. We will notify you 1 hour before close and if you are outbid."
              );
            }}
          >
            Show toast
          </Button>
        </div>
        <Toast>
          Watching. We&apos;ll notify you 1 hour before close and if you&apos;re
          outbid.
        </Toast>
        <div className="grid gap-6 md:grid-cols-2">
          <IconList>
            <IconRow icon={Wrench}>
              Seller says: starts, runs and drives.
            </IconRow>
            <IconRow icon={ShieldCheck}>Seller ID checked (FICA)</IconRow>
            <IconRow icon={Camera}>
              Sold as is.{" "}
              <a href="#ds-actions" className="underline">
                Book a viewing
              </a>
            </IconRow>
          </IconList>
          <NumberedSteps
            steps={[
              "Invoice by email",
              "Pay by EFT within 48 hours",
              "Collect within 7 days, or we arrange transport",
            ]}
          />
        </div>
        <SellerStrip href="https://wa.me/27837000000" />
        <p className="text-[13px] text-muted-foreground">
          The sticky bar shows below 768px only (resize to see it).
        </p>
      </section>

      <section aria-labelledby="ds-frame" className="space-y-4">
        <SectionHeader id="ds-frame" title="Page frame and Home blocks" />
        <p className="text-sm text-muted-foreground">
          The Header and Footer are the real ones: this page sits between them.
          Phone: logo, call icon (when a phone is set), Sell, Sign in, menu.
          Desktop: navigation, search, phone number, Sign in and Register to
          bid. The Footer shows each company detail only when an admin has set
          it.
        </p>
        <HomeFilters
          total={85}
          categories={[
            { key: "tractors", label: "Tractors", count: 48 },
            { key: "implements", label: "Implements", count: 22 },
          ]}
          makes={[
            { key: "Massey Ferguson", label: "Massey Ferguson", count: 14 },
            { key: "Ford", label: "Ford", count: 8 },
          ]}
          priceRange={{ min: 20000, max: 2000000 }}
          category={null}
          make={null}
          price={{}}
          onCategory={() => undefined}
          onMake={() => undefined}
          onPrice={() => undefined}
          onSearch={() => undefined}
        />
        <Button
          variant="outline"
          onClick={() => {
            setFeesOpen(true);
          }}
        >
          Open Fees &amp; rules
        </Button>
        <BeforeYouBid
          transportHref="/support"
          finance={{
            name: "Lee-Anne Vermeulen",
            company: null,
            phone: "083 277 0178",
          }}
        />
      </section>

      <FeesRulesSheet
        open={feesOpen}
        onOpenChange={setFeesOpen}
        premiumPct={12}
        deposit={{ enabled: true, amount: 5000, refundDays: 3 }}
      />

      <BottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Fees & rules"
        actions={
          <Button
            className="h-12 flex-1"
            onClick={() => {
              setSheetOpen(false);
            }}
          >
            Got it
          </Button>
        }
      >
        <CostBox seller="vat" />
      </BottomSheet>

      <StickyBar
        label="Sample actions"
        title="Closes in 2d 3h"
        sub={formatSastDate(NOW + 2 * 86_400_000)}
        whatsappHref="https://wa.me/27837000000"
        cta="Register to bid"
        onCta={() => undefined}
      />
    </div>
  );
}
