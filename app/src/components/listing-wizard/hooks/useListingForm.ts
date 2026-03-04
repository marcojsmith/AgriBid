import { useListingWizard } from "../context/useListingWizard";
import { STEPS } from "../constants";

/**
 * Custom hook for managing listing wizard form navigation and step validation.
 *
 * @returns Object with step navigation and validation functions
 */
export function useListingForm() {
  const { formData, currentStep, setCurrentStep } = useListingWizard();

  /**
   * Validates a specific wizard step.
   *
   * @param stepIndex - The index of the step to validate
   * @returns Error message string if invalid, null if valid
   */
  const getStepError = (stepIndex: number): string | null => {
    switch (stepIndex) {
      case 0: // General Info
        if (!formData.title?.trim()) return "Title is required";
        if (!formData.location?.trim()) return "Location is required";
        if (!formData.year || formData.year < 1900)
          return "Valid year is required";
        if (
          formData.operatingHours === undefined ||
          formData.operatingHours < 0
        )
          return "Operating hours are required";
        return null;
      case 1: // Technical Specs
        if (!formData.make?.trim()) return "Make is required";
        if (!formData.model?.trim()) return "Model is required";
        return null;
      case 3: {
        // Media Gallery
        const hasImages = Array.isArray(formData.images)
          ? formData.images.length > 0
          : !!(
              formData.images?.front ||
              formData.images?.engine ||
              formData.images?.cabin ||
              formData.images?.rear ||
              (formData.images?.additional &&
                formData.images.additional.length > 0)
            );
        if (!hasImages) return "At least one photo is required";
        return null;
      }
      case 4: // Pricing
        if (!formData.startingPrice || formData.startingPrice <= 0)
          return "Starting price must be greater than 0";
        if (
          !formData.reservePrice ||
          formData.reservePrice < formData.startingPrice
        )
          return "Reserve price must be at least the starting price";
        return null;
      default:
        return null;
    }
  };

  /**
   * Checks if current step is valid.
   */
  const isCurrentStepValid = () => {
    return getStepError(currentStep) === null;
  };

  /**
   * Navigates to the next step if current step is valid.
   */
  const next = () => {
    const error = getStepError(currentStep);
    if (!error) {
      setCurrentStep(Math.min(currentStep + 1, STEPS.length - 1));
    }
    return error;
  };

  /**
   * Navigates to the previous step.
   */
  const prev = () => setCurrentStep(Math.max(currentStep - 1, 0));

  return {
    next,
    prev,
    getStepError,
    isCurrentStepValid,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === STEPS.length - 1,
  };
}
