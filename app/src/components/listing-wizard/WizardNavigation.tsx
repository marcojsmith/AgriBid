import { ChevronLeft, ChevronRight, Check, Save, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useListingWizard } from "./hooks/useListingWizard";
import { useListingForm } from "./hooks/useListingForm";
import { STEPS } from "./constants";

interface WizardNavigationProps {
  onFinalSubmit: () => void;
  onSaveDraft: () => void;
}

/**
 * Navigation controls for the listing wizard.
 * Provides "Previous", "Next", "Save Draft", and final "Submit" actions.
 *
 * @param props - Component props containing final submit and save draft handlers
 * @param props.onFinalSubmit
 * @param props.onSaveDraft
 * @returns The navigation UI row
 */
export const WizardNavigation = ({
  onFinalSubmit,
  onSaveDraft,
}: WizardNavigationProps) => {
  const { currentStep, isSubmitting, draftSaved } = useListingWizard();
  const { prev, next, getStepError } = useListingForm();

  return (
    <div className="flex justify-between items-center pt-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={prev}
          disabled={currentStep === 0 || isSubmitting}
          className="h-12 px-6 rounded-xl font-bold border-2 gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          onClick={onSaveDraft}
          disabled={isSubmitting}
          className="h-12 px-6 rounded-xl font-bold border-2 gap-2"
        >
          {draftSaved ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {draftSaved ? "Saved" : "Save Draft"}
        </Button>
      </div>

      {currentStep === STEPS.length - 1 ? (
        <Button
          onClick={onFinalSubmit}
          disabled={isSubmitting || !!getStepError(currentStep)}
          className="h-14 px-12 rounded-xl font-black text-xl gap-2 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 transition-all scale-105"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              Submit Listing
              <Check className="h-6 w-6" />
            </>
          )}
        </Button>
      ) : (
        <Button
          onClick={next}
          disabled={!!getStepError(currentStep)}
          className="h-12 px-8 rounded-xl font-black text-lg gap-2 shadow-lg shadow-primary/20"
        >
          Next Step
          <ChevronRight className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
};
