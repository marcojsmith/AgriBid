import { Save } from "lucide-react";

import { cn } from "@/lib/utils";
import { useListingWizard } from "@/hooks/listing-wizard/useListingWizard";

import { STEPS } from "./constants";

/**
 * Component for a step indicator in the listing wizard.
 *
 * @returns The rendered step indicator.
 */
export const StepIndicator = () => {
  const { currentStep, draftSaved } = useListingWizard();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <p className="text-xs font-black text-primary uppercase tracking-[0.2em]">
            Step {String(currentStep + 1)} of {String(STEPS.length)}
          </p>
          <h2 className="text-2xl font-black uppercase tracking-tight">
            {Reflect.get(STEPS, currentStep)}
          </h2>
        </div>
        <div
          className={cn(
            "flex items-center gap-2 transition-opacity duration-300",
            draftSaved ? "opacity-100" : "opacity-0"
          )}
        >
          <Save className="h-4 w-4 text-muted-foreground" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Draft Saved
          </span>
        </div>
      </div>
      <div
        className="h-2 w-full bg-muted rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={currentStep + 1}
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-label={`Step ${String(currentStep + 1)} of ${String(
          STEPS.length
        )}`}
      >
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{
            width: `${String(((currentStep + 1) / STEPS.length) * 100)}%`,
          }}
        />
      </div>
    </div>
  );
};
