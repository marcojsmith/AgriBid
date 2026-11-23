import { LotSpecsFields } from "@/components/lot-specs/LotSpecsFields";
import { useListingWizard } from "@/hooks/listing-wizard/useListingWizard";

/**
 * Compact optional "Specs" section of the listing wizard (power, drive,
 * transmission, tyre condition, serial number).
 *
 * @returns The section, wired to the wizard form state
 */
export function LotSpecsSection() {
  const { formData, setFormData, setDraftSaved } = useListingWizard();

  return (
    <section
      aria-labelledby="lot-specs-heading"
      className="space-y-3 border-t border-dashed pt-4"
    >
      <h3 id="lot-specs-heading" className="text-sm font-semibold">
        Specs (optional)
      </h3>
      <LotSpecsFields
        idPrefix="wizard-spec"
        values={formData}
        onChange={(patch) => {
          setFormData((prev) => ({ ...prev, ...patch }));
          setDraftSaved(false);
        }}
      />
    </section>
  );
}
