import React, { useState, useEffect, useCallback } from "react";

import { normalizeListingImages } from "@/lib/normalize-images";

import type { ListingFormData, ConditionChecklist } from "../types";
import { DEFAULT_FORM_DATA, STEPS } from "../constants";
import { ListingWizardContext } from "./ListingWizardContextDef";

/**
 * Validates and normalizes saved draft data to ensure it matches the ListingFormData shape.
 *
 * @param saved - The raw parsed data from localStorage
 * @returns A normalized ListingFormData object
 */
const validateAndNormalizeDraft = (saved: unknown): ListingFormData => {
  const data = (
    saved && typeof saved === "object" ? saved : {}
  ) as Partial<ListingFormData>;

  const normalizedImages = normalizeListingImages(
    data.images || DEFAULT_FORM_DATA.images
  );

  return {
    ...DEFAULT_FORM_DATA,
    ...data,
    images: normalizedImages,
    conditionChecklist: {
      ...DEFAULT_FORM_DATA.conditionChecklist,
      ...(data.conditionChecklist || {}),
    },
  };
};

/**
 * Provider component for the Listing Wizard state.
 * Manages form data, current step, submission status, and image previews.
 * Persists state to localStorage for session recovery.
 *
 * @param props - Component props
 * @param props.children - Child components that will have access to the context
 * @returns The context provider component
 */
export const ListingWizardProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Initialize from localStorage on client side only to avoid SSR mismatch
  const [formData, setFormData] = useState<ListingFormData>(() => {
    if (typeof window !== "undefined") {
      const savedDraft = localStorage.getItem("agribid_listing_draft");
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft) as unknown;
          return validateAndNormalizeDraft(parsed);
        } catch {
          // fallback to DEFAULT_FORM_DATA below
        }
      }
    }
    return DEFAULT_FORM_DATA;
  });

  const [currentStep, setCurrentStep] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const savedStep = localStorage.getItem("agribid_listing_step");
      if (savedStep) {
        const step = parseInt(savedStep, 10);
        if (Number.isInteger(step) && step >= 0 && step <= STEPS.length - 1) {
          return step;
        }
      }
    }
    return 0;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [draftSaved, setDraftSaved] = useState(false);

  // Persistence effect
  useEffect(() => {
    if (!isSuccess) {
      localStorage.setItem("agribid_listing_draft", JSON.stringify(formData));
      localStorage.setItem("agribid_listing_step", currentStep.toString());
    }
  }, [formData, currentStep, isSuccess]);

  const updateField = useCallback(
    <K extends keyof ListingFormData>(field: K, value: ListingFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setDraftSaved(false);
    },
    []
  );

  const updateChecklist = useCallback(
    <K extends keyof ConditionChecklist>(
      field: K,
      value: ConditionChecklist[K]
    ) => {
      setFormData((prev) => ({
        ...prev,
        conditionChecklist: {
          ...prev.conditionChecklist,
          [field]: value,
        },
      }));
      setDraftSaved(false);
    },
    []
  );

  /**
   * Resets the form state.
   * If initialData is provided, it hydrates the form (hydration path).
   * If no initialData is provided, it resets to defaults and clears storage (reset path).
   *
   * @param initialData - Optional partial data to hydrate the form with
   * @param initialStep - Optional number indicating which wizard step to start on; defaults to 0.
   */
  const resetForm = useCallback(
    (initialData?: Partial<ListingFormData>, initialStep?: number) => {
      if (initialData) {
        // Hydration path: normalize and set state, but don't clear storage
        const normalized = validateAndNormalizeDraft(initialData);
        setFormData(normalized);

        const clampedStep = Math.max(
          0,
          Math.min(initialStep ?? 0, STEPS.length - 1)
        );
        setCurrentStep(clampedStep);
        setIsSuccess(false);
        setIsSubmitting(false);
        setDraftSaved(true);
      } else {
        // Reset path: clear state and clear storage
        setFormData(DEFAULT_FORM_DATA);
        setCurrentStep(0);
        setIsSuccess(false);
        setIsSubmitting(false);
        setDraftSaved(false);
        localStorage.removeItem("agribid_listing_draft");
        localStorage.removeItem("agribid_listing_step");
      }
      setPreviews({});
    },
    []
  );

  return (
    <ListingWizardContext.Provider
      value={{
        formData,
        setFormData,
        currentStep,
        setCurrentStep,
        isSubmitting,
        setIsSubmitting,
        isSuccess,
        setIsSuccess,
        previews,
        setPreviews,
        draftSaved,
        setDraftSaved,
        updateField,
        updateChecklist,
        resetForm,
      }}
    >
      {children}
    </ListingWizardContext.Provider>
  );
};
