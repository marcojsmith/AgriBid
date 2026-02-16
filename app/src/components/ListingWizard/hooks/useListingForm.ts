import { toast } from "sonner";
import { useListingWizard } from "../context/ListingWizardContext";
import { STEPS } from "../constants";

export const useListingForm = () => {
  const { 
    formData, 
    currentStep, 
    setCurrentStep,
  } = useListingWizard();

  const getStepError = (step: number): string | null => {
    switch (step) {
      case 0:
        if (formData.year <= 1900) return "Please enter a valid manufacturing year.";
        if (formData.location.length <= 2) return "Please enter a valid location.";
        if (formData.title.length <= 5) return "Please enter a more descriptive title.";
        return null;
      case 1:
        if (!formData.make) return "Please select a manufacturer.";
        if (!formData.model) return "Please select a model.";
        return null;
      case 2:
        if (formData.conditionChecklist.engine === null) return "Please specify the engine condition.";
        if (formData.conditionChecklist.hydraulics === null) return "Please specify the hydraulics condition.";
        if (formData.conditionChecklist.tires === null) return "Please specify the tires condition.";
        if (formData.conditionChecklist.serviceHistory === null) return "Please specify the service history.";
        return null;
      case 3: {
        const { additional, ...slots } = formData.images;
        const hasImages = Object.values(slots).some(Boolean) || (additional && additional.length > 0);
        return hasImages ? null : "Please upload at least one photo of the equipment.";
      }
      case 4:
        if (formData.startingPrice <= 0) return "Starting price must be greater than R 0.";
        if (formData.reservePrice !== 0 && formData.reservePrice < formData.startingPrice) {
          return "Reserve price cannot be lower than the starting price.";
        }
        if (formData.durationDays <= 0) return "Please select an auction duration.";
        return null;
      default:
        return null;
    }
  };

  const next = () => {
    const error = getStepError(currentStep);
    if (!error) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    } else {
      toast.error(error);
    }
  };
  
  const prev = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  return {
    getStepError,
    next,
    prev,
  };
};
