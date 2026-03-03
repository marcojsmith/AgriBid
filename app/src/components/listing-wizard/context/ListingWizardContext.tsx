import React, { useState, useEffect } from "react";
import type { ListingFormData, ConditionChecklist } from "../types";
import { DEFAULT_FORM_DATA } from "../constants";
import { normalizeListingImages } from "@/lib/normalize-images";
import { ListingWizardContext } from "./ListingWizardContextDef";

/**
 * Provider component for the Listing Wizard state.
 * Manages form data, current step, submission status, and image previews.
 * Persists state to localStorage for session recovery.
 *
 * @param props.children - Child components that will have access to the context
 */
export const ListingWizardProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [formData, setFormData] = useState<ListingFormData>(DEFAULT_FORM_DATA);
  const [currentStep, setCurrentStep] = useState<number>(0);

  // Initialize from localStorage on client side only to avoid SSR mismatch
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedDraft = localStorage.getItem("agribid_listing_draft");
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft) as Partial<ListingFormData>;
          const normalizedImages = normalizeListingImages(
            parsed.images || DEFAULT_FORM_DATA.images
          );
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setFormData({
            ...DEFAULT_FORM_DATA,
            ...parsed,
            images: normalizedImages,
          });
        } catch {
          // silently fallback to DEFAULT_FORM_DATA
        }
      }
      const savedStep = localStorage.getItem("agribid_listing_step");
      if (savedStep) {
        setCurrentStep(parseInt(savedStep, 10));
      }
    }
  }, []);

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

  const updateField = <K extends keyof ListingFormData>(
    field: K,
    value: ListingFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setDraftSaved(false);
  };

  const updateChecklist = <K extends keyof ConditionChecklist>(
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
  };

  /**
   * Resets the form state.
   * If initialData is provided, it hydrates the form (hydration path).
   * If no initialData is provided, it resets to defaults and clears storage (reset path).
   *
   * @param initialData - Optional partial data to hydrate the form with
   */
  const resetForm = (
    initialData?: Partial<ListingFormData>,
    initialStep?: number
  ) => {
    if (initialData) {
      // Hydration path: normalize and set state, but don't clear storage
      const normalizedImages = normalizeListingImages(
        initialData.images || DEFAULT_FORM_DATA.images
      );
      setFormData({
        ...DEFAULT_FORM_DATA,
        ...initialData,
        images: normalizedImages,
      });
      setCurrentStep(initialStep ?? 0);
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
  };

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
