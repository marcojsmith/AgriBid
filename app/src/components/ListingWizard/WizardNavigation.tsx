import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useListingWizard } from "./context/ListingWizardContext";
import { useListingForm } from "./hooks/useListingForm";
import { STEPS } from "./constants";

interface WizardNavigationProps {
  onFinalSubmit: () => void;
}

export const WizardNavigation = ({ onFinalSubmit }: WizardNavigationProps) => {
  const { currentStep, isSubmitting } = useListingWizard();
  const { prev, next, getStepError } = useListingForm();

  return (
    <div className="flex justify-between items-center pt-4">
      <Button
        variant="outline"
        onClick={prev}
        disabled={currentStep === 0 || isSubmitting}
        className="h-12 px-6 rounded-xl font-bold border-2 gap-2"
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </Button>
      
      {currentStep === STEPS.length - 1 ? (
        <Button
          onClick={onFinalSubmit}
          disabled={isSubmitting || !!getStepError(currentStep)}
          className="h-14 px-12 rounded-xl font-black text-xl gap-2 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 transition-all scale-105"
        >
          {isSubmitting ? "Submitting..." : "Submit Listing"}
          {!isSubmitting && <Check className="h-6 w-6" />}
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
