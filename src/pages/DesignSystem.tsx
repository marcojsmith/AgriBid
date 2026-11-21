import { useEffect, useState } from "react";

import indexCss from "@/index.css?raw";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConditionReport } from "@/components/ds/ConditionReport";
import { Countdown } from "@/components/ds/Countdown";
import { EventMosaic } from "@/components/ds/EventMosaic";
import { FilterChips, type ActiveFilter } from "@/components/ds/FilterChips";
import { Money } from "@/components/ds/Money";
import { PhotoFrame } from "@/components/ds/PhotoFrame";
import { ReservePill } from "@/components/ds/ReservePill";
import { SaleTerms } from "@/components/ds/SaleTerms";
import { SectionHeader } from "@/components/ds/SectionHeader";
import { SegmentedControl } from "@/components/ds/SegmentedControl";
import { SpecTable } from "@/components/ds/SpecTable";
import { StatusBadge } from "@/components/ds/StatusBadge";
import { StickyActionBar } from "@/components/ds/StickyActionBar";
import { contrastRatio, readHslTokens } from "@/lib/color-contrast";
import { formatRand } from "@/lib/currency";
import { formatSastDate } from "@/lib/dates";
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
  ["22 · h3 / section", "text-[22px] font-display"],
  ["28 · h2", "text-[28px] font-display"],
  ["36 · h1", "text-4xl font-display"],
] as const;

const NOW = Date.now();
const STATUSES: readonly DisplayStatus[] = [
  { kind: "live" },
  { kind: "closing-soon", urgent: false },
  { kind: "closing-soon", urgent: true },
  { kind: "opens", startTime: NOW + 3 * 86_400_000 },
  { kind: "sold" },
  { kind: "passed" },
];

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
          <ReservePill state="met" />
          <ReservePill state="not-met" />
          <ReservePill state="none" />
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
            Under 2 min: <Countdown endTime={NOW + 90_000} />
          </span>
          <span>
            Absolute: <Countdown endTime={NOW + 86_400_000} absolute />
          </span>
          <span>
            Ended: <Countdown endTime={NOW - 1000} />
          </span>
          <span>SAST: {formatSastDate(NOW)}</span>
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

      <StickyActionBar label="Sample actions">
        <Button className="flex-1" size="touch">
          Place bid
        </Button>
      </StickyActionBar>
    </div>
  );
}
