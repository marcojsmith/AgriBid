import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/utils";
import { parseVatRate } from "@/lib/vat";

/**
 * Inner form, mounted once the stored rate has loaded so its draft starts from it.
 *
 * @param props - Component props
 * @param props.currentRate - The stored VAT rate (percent)
 * @returns The form element
 */
function VatRateForm({ currentRate }: { currentRate: number }) {
  const updateVatRate = useMutation(api.admin.updateVatRate);
  const [draft, setDraft] = useState(String(currentRate));
  const [isSaving, setIsSaving] = useState(false);

  const parsed = parseVatRate(draft);
  const isInvalid = parsed === null;
  const isUnchanged = parsed === currentRate;

  const handleSave = async (): Promise<void> => {
    if (parsed === null || isSaving) return;
    setIsSaving(true);
    try {
      await updateVatRate({ vatRatePct: parsed });
      toast.success("VAT rate saved");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save VAT rate"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSave();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="vat-rate">VAT rate (%)</Label>
        <Input
          id="vat-rate"
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step="0.01"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          aria-invalid={isInvalid}
          aria-describedby="vat-rate-help"
          className="sm:w-40"
        />
      </div>
      <Button type="submit" disabled={isInvalid || isUnchanged || isSaving}>
        {isSaving ? "Saving..." : "Save VAT rate"}
      </Button>
      <p
        id="vat-rate-help"
        className={`text-xs sm:basis-full ${isInvalid ? "text-destructive" : "text-muted-foreground"}`}
      >
        {isInvalid
          ? "Enter a number between 0 and 100."
          : "Applied to the hammer price plus buyer fees in fee estimates. Defaults to 15%."}
      </p>
    </form>
  );
}

/**
 * Admin section for the platform VAT rate shown in buyer fee estimates.
 *
 * @returns The VAT rate form, or a loading line while the rate loads
 */
export function VatRateCard() {
  const rate = useQuery(api.admin.getVatRate);

  return (
    <section aria-labelledby="vat-rate-heading" className="space-y-3">
      <h2 id="vat-rate-heading" className="text-sm font-semibold">
        Tax
      </h2>
      {rate === undefined ? (
        <p className="text-sm text-muted-foreground">Loading VAT rate…</p>
      ) : (
        <VatRateForm key={rate.vatRatePct} currentRate={rate.vatRatePct} />
      )}
    </section>
  );
}
