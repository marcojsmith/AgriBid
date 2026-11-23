import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";

import { useListingWizard } from "@/hooks/listing-wizard/useListingWizard";
import { STEPS } from "@/components/listing-wizard/constants";
import { getLotSpecsError } from "@/lib/lotSpecs";

/**
 * Custom hook for managing listing wizard form navigation and step validation.
 *
 * @returns Object with step navigation and validation functions
 */
export function useListingForm() {
  const { formData, currentStep, setCurrentStep } = useListingWizard();
  const settings = useQuery(api.admin.platformSettings.getPlatformSettings);
  // Until the settings load, only require one photo so the wizard is never
  // blocked; the server enforces the real minimum on submit.
  const minPhotosPerLot = settings?.minPhotosPerLot ?? 1;

  /**
   * Validates a specific wizard step.
   *
   * @param stepIndex - The index of the step to validate
   * @returns Error message string if invalid, null if valid
   */
  const getStepError = (stepIndex: number): string | null => {
    switch (stepIndex) {
      case 0: {
        // General Info
        if (!formData.title.trim()) return "Title is required";
        if (!formData.location.trim()) return "Location is required";
        if (!formData.province) return "Province is required";
        if (!formData.year || formData.year < 1900)
          return "Valid year is required";
        // operatingHours is typed `number`, but drafts restored from storage
        // may hold null/undefined at runtime, so validate the raw value.
        const operatingHours: unknown = formData.operatingHours;
        if (operatingHours === undefined || operatingHours === null) {
          return "Operating hours are required";
        }
        if (
          typeof operatingHours !== "number" ||
          !Number.isFinite(operatingHours)
        ) {
          return "Operating hours must be a valid number";
        }
        if (operatingHours < 0) return "Operating hours cannot be negative";
        return null;
      }
      case 1: // Technical Specs
        if (!formData.categoryId) return "Please select a category.";
        if (!formData.make) return "Please select a manufacturer.";
        if (!formData.model) return "Please select a model.";
        return getLotSpecsError(formData);
      case 2: // Condition Checklist
        if (formData.conditionChecklist.engine === null)
          return "Please specify the engine condition.";
        if (formData.conditionChecklist.hydraulics === null)
          return "Please specify the hydraulics condition.";
        if (formData.conditionChecklist.tires === null)
          return "Please specify the tires condition.";
        if (formData.conditionChecklist.serviceHistory === null)
          return "Please specify the service history.";
        return null;
      case 3: {
        // Media Gallery
        const photoCount = new Set(
          [
            formData.images.front,
            formData.images.engine,
            formData.images.cabin,
            formData.images.rear,
            ...formData.images.additional,
          ].filter((ref): ref is string => !!ref)
        ).size;
        if (photoCount >= minPhotosPerLot) return null;
        if (minPhotosPerLot <= 1) return "At least one photo is required";
        return `At least ${String(minPhotosPerLot)} photos are required (you have ${String(photoCount)})`;
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
  const prev = () => {
    setCurrentStep(Math.max(currentStep - 1, 0));
  };

  return {
    next,
    prev,
    getStepError,
    isCurrentStepValid,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === STEPS.length - 1,
  };
}
