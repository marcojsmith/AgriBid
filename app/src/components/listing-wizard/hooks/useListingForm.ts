import { useListingWizard } from "../context/useListingWizard";
import { STEPS } from "../constants";

/**
 * Manage navigation and validation for the multi-step listing wizard.
 *
 * Provides helpers to advance or rewind the wizard, validate individual steps, and inspect step state.
 *
 * @returns An object containing:
 *  - `next` — advance to the next step if the current step is valid, returns an error message string when validation fails or `null` when navigation succeeds.
 *  - `prev` — go back to the previous step.
 *  - `getStepError` — return a validation error message for a given step index, or `null` if the step is valid.
 *  - `isCurrentStepValid` — boolean indicating whether the current step has no validation errors.
 *  - `isFirstStep` — boolean indicating whether the current step is the first step.
 *  - `isLastStep` — boolean indicating whether the current step is the last step.
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
        if (!formData.categoryId) return "Please select a category.";
        if (!formData.make) return "Please select a manufacturer.";
        if (!formData.model) return "Please select a model.";
        return null;
      case 2: // Condition Checklist
        if (!formData.conditionChecklist) {
          return "Please complete the condition checklist.";
        }
        if (
          formData.conditionChecklist.engine === null ||
          formData.conditionChecklist.engine === undefined
        )
          return "Please specify the engine condition.";
        if (
          formData.conditionChecklist.hydraulics === null ||
          formData.conditionChecklist.hydraulics === undefined
        )
          return "Please specify the hydraulics condition.";
        if (
          formData.conditionChecklist.tires === null ||
          formData.conditionChecklist.tires === undefined
        )
          return "Please specify the tires condition.";
        if (
          formData.conditionChecklist.serviceHistory === null ||
          formData.conditionChecklist.serviceHistory === undefined
        )
          return "Please specify the service history.";
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
   * @returns True if current step is valid, false otherwise.
   */
  const isCurrentStepValid = () => {
    return getStepError(currentStep) === null;
  };

  /**
   * Navigates to the next step if current step is valid.
   * @returns Error message if navigation failed, null otherwise.
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
   * @returns void
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
