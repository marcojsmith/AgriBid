import { TrendingUp, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useListingWizard } from "@/hooks/listing-wizard/useListingWizard";

/**
 * Format a Date as a local-time string suitable for datetime-local inputs (YYYY-MM-DDTHH:mm).
 * Uses local time instead of UTC to avoid timezone-shift issues in the browser date picker.
 *
 * @param d - The Date to format
 * @returns Local ISO-like date-time string (YYYY-MM-DDTHH:mm)
 */
function formatLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear().toString()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Step 3 of the listing wizard: Pricing and Duration.
 *
 * @returns The rendered pricing and duration step.
 */
export const PricingDurationStep = () => {
  const { formData, updateField } = useListingWizard();
  const nowMin = formatLocalInput(new Date());

  const handlePriceChange =
    (field: "startingPrice" | "reservePrice") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (val === "") {
        updateField(field, 0);
        return;
      }
      const parsed = parseInt(val);
      if (!isNaN(parsed)) {
        updateField(field, Math.max(0, parsed));
      }
    };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="starting-price"
              className="text-xs font-black uppercase text-muted-foreground ml-1"
            >
              Starting Price (R)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-lg">
                R
              </span>
              <Input
                id="starting-price"
                type="number"
                inputMode="numeric"
                min="0"
                value={formData.startingPrice || ""}
                onChange={handlePriceChange("startingPrice")}
                className="h-14 pl-10 text-xl font-black rounded-xl border-2"
              />
            </div>
            <p className="text-[10px] text-muted-foreground font-medium uppercase px-1">
              The price at which bidding will begin.
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="reserve-price"
              className="text-xs font-black uppercase text-muted-foreground ml-1"
            >
              Reserve Price (R)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-lg">
                R
              </span>
              <Input
                id="reserve-price"
                type="number"
                inputMode="numeric"
                min="0"
                value={formData.reservePrice || ""}
                onChange={handlePriceChange("reservePrice")}
                className={cn(
                  "h-14 pl-10 text-xl font-black rounded-xl border-2",
                  formData.reservePrice !== 0 &&
                    formData.reservePrice < formData.startingPrice
                    ? "border-destructive focus-visible:ring-destructive"
                    : "border-primary/20"
                )}
              />
            </div>
            {formData.reservePrice !== 0 &&
              formData.reservePrice < formData.startingPrice && (
                <p className="text-[10px] text-destructive font-black uppercase px-1 mt-1">
                  Reserve price cannot be lower than the starting price.
                </p>
              )}
            <p className="text-[10px] text-muted-foreground font-medium uppercase px-1 mt-1">
              The minimum price you are willing to accept.
            </p>
          </div>

          <div className="space-y-2 pt-4">
            <label className="text-xs font-black uppercase text-muted-foreground ml-1">
              Auction Duration
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[3, 7, 14].map((days) => (
                <Button
                  key={days}
                  variant={
                    formData.durationDays === days ? "default" : "outline"
                  }
                  onClick={() => {
                    updateField("durationDays", days);
                  }}
                  className="h-12 font-black rounded-xl border-2"
                >
                  {days} DAYS
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-4">
            <label
              htmlFor="start-time"
              className="text-xs font-black uppercase text-muted-foreground ml-1"
            >
              Auction Start Date &amp; Time (Optional)
            </label>
            <Input
              id="start-time"
              type="datetime-local"
              min={nowMin}
              value={
                formData.startTime
                  ? formatLocalInput(new Date(formData.startTime))
                  : ""
              }
              onChange={(e) => {
                const val = e.target.value;
                updateField(
                  "startTime",
                  val ? new Date(val).getTime() : undefined
                );
              }}
              className="h-12 rounded-xl border-2"
            />
            <p className="text-[10px] text-muted-foreground font-medium uppercase px-1">
              Leave blank to start immediately upon admin approval.
            </p>
          </div>
        </div>

        <div className="bg-primary/5 border-2 border-primary/10 rounded-3xl p-6 space-y-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="font-black uppercase tracking-tight">
              Pricing Strategy
            </h3>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground font-bold uppercase text-[10px]">
                Market Confidence (Illustrative)
              </span>
              <Badge className="bg-green-500 hover:bg-green-600 font-black uppercase text-[10px]">
                High
              </Badge>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-green-500 w-[85%]" />
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Based on recent auctions for{" "}
              <strong>
                {formData.year} {formData.make} {formData.model}
              </strong>
              , items with verified service history often sell for 15% more than
              average.
            </p>
          </div>

          <div className="pt-4 border-t border-dashed border-primary/20">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Info className="h-4 w-4 text-primary" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-primary">
                Our recommendation: Set a lower starting price to encourage a
                "bidding war" early in the auction.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
