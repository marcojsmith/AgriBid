import React, { createContext, useState, useEffect } from "react";
import type { ListingFormData, ConditionChecklist } from "../types";
import { DEFAULT_FORM_DATA, STEPS } from "../constants";

interface ListingWizardContextType {
  formData: ListingFormData;
  currentStep: number;
  isSubmitting: boolean;
  isSuccess: boolean;
  previews: Record<string, string>;
  draftSaved: boolean;
  setFormData: React.Dispatch<React.SetStateAction<ListingFormData>>;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSuccess: React.Dispatch<React.SetStateAction<boolean>>;
  setPreviews: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  updateField: <K extends keyof ListingFormData>(
    field: K,
    value: ListingFormData[K]
  ) => void;
  updateChecklist: <K extends keyof ConditionChecklist>(
    field: K,
    value: ConditionChecklist[K]
  ) => void;
  resetForm: (initialData?: ListingFormData) => void;
}

const ListingWizardContext = createContext<
  ListingWizardContextType | undefined
>(undefined);

/**
 * Deeply merges a source object into a target object.
 * - Skips undefined values from source
 * - Replaces arrays (not merged)
 * - Recursively merges nested plain objects
 * - Guards against prototype pollution by skipping __proto__, prototype, constructor
 *
 * @param target - The target object to merge into
 * @param source - The source object to merge from
 * @returns The merged result with type T
 */
function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target } as Record<string, unknown>;
  for (const key in source) {
    if (
      Object.prototype.hasOwnProperty.call(source, key) &&
      source[key] !== undefined &&
      key !== "__proto__" &&
      key !== "prototype" &&
      key !== "constructor"
    ) {
      const sourceVal = source[key];
      const targetVal = result[key];
      if (
        sourceVal !== null &&
        typeof sourceVal === "object" &&
        !Array.isArray(sourceVal) &&
        targetVal !== null &&
        typeof targetVal === "object" &&
        !Array.isArray(targetVal)
      ) {
        result[key] = deepMerge(targetVal, sourceVal);
      } else {
        result[key] = sourceVal;
      }
    }
  }
  return result as T;
}

export { ListingWizardContext, type ListingWizardContextType };

export const ListingWizardProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentStep, setCurrentStep] = useState(() => {
    if (typeof window === "undefined") return 0;
    const saved = localStorage.getItem("agribid_listing_step");
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (Number.isFinite(parsed) && parsed >= 0 && parsed < STEPS.length) {
        return parsed;
      }
    }
    return 0;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [draftSaved, setDraftSaved] = useState(false);

  const [formData, setFormData] = useState<ListingFormData>(() => {
    if (typeof window === "undefined") return DEFAULT_FORM_DATA;

    const saved = localStorage.getItem("agribid_listing_draft");
    if (!saved) return DEFAULT_FORM_DATA;
    try {
      const parsed = JSON.parse(saved) as Partial<ListingFormData>;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return DEFAULT_FORM_DATA;
      }
      if (
        parsed.images &&
        typeof parsed.images === "object" &&
        !Array.isArray(parsed.images)
      ) {
        parsed.images = {
          ...DEFAULT_FORM_DATA.images,
          ...parsed.images,
          additional: Array.isArray(parsed.images.additional)
            ? parsed.images.additional
            : [],
        };
      }
      return deepMerge(DEFAULT_FORM_DATA, parsed);
    } catch (e) {
      console.error("Failed to parse listing draft", e);
      localStorage.removeItem("agribid_listing_draft");
      return DEFAULT_FORM_DATA;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const timer = setTimeout(() => {
      localStorage.setItem("agribid_listing_draft", JSON.stringify(formData));
      localStorage.setItem("agribid_listing_step", currentStep.toString());
      setDraftSaved(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [formData, currentStep]);

  const updateField = <K extends keyof ListingFormData>(
    field: K,
    value: ListingFormData[K]
  ) => {
    setDraftSaved(false);
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      if (field === "make" || field === "model" || field === "year") {
        const parts = [newData.year, newData.make, newData.model].filter(
          (v) => v !== undefined && v !== null && v !== ""
        );
        if (parts.length > 0) {
          newData.title = parts.join(" ");
        }
      }
      return newData;
    });
  };

  const updateChecklist = <K extends keyof ConditionChecklist>(
    field: K,
    value: ConditionChecklist[K]
  ) => {
    setDraftSaved(false);
    setFormData((prev) => ({
      ...prev,
      conditionChecklist: {
        ...prev.conditionChecklist,
        [field]: value,
      },
    }));
  };

  const resetForm = (initialData?: ListingFormData) => {
    setFormData(initialData ?? DEFAULT_FORM_DATA);
    setCurrentStep(0);
    setPreviews({});
    localStorage.removeItem("agribid_listing_draft");
    localStorage.removeItem("agribid_listing_step");
  };

  return (
    <ListingWizardContext.Provider
      value={{
        formData,
        currentStep,
        isSubmitting,
        isSuccess,
        previews,
        draftSaved,
        setFormData,
        setCurrentStep,
        setIsSubmitting,
        setIsSuccess,
        setPreviews,
        updateField,
        updateChecklist,
        resetForm,
      }}
    >
      {children}
    </ListingWizardContext.Provider>
  );
};
