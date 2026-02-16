import { Save } from "lucide-react";
import { useListingWizard } from "./context/ListingWizardContext";
import { STEPS } from "./constants";

export const StepIndicator = () => {
  const { currentStep } = useListingWizard();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <p className="text-xs font-black text-primary uppercase tracking-[0.2em]">Step {currentStep + 1} of {STEPS.length}</p>
          <h2 className="text-2xl font-black uppercase tracking-tight">{STEPS[currentStep]}</h2>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Save className="h-4 w-4" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Draft Saved</span>
        </div>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
        />
      </div>
    </div>
  );
};
