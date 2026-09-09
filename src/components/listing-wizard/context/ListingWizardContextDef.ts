import { createContext } from "react";

import type { ListingFormData, ConditionChecklist } from "../types";

export interface ListingWizardContextType {
  formData: ListingFormData;
  currentStep: number;
  isSubmitting: boolean;
  isSuccess: boolean;
  /** Preview URLs keyed by slot ID or storage ID; absent keys have no preview yet. */
  previews: Record<string, string | undefined>;
  draftSaved: boolean;
  updateField: <K extends keyof ListingFormData>(
    field: K,
    value: ListingFormData[K]
  ) => void;
  updateChecklist: <K extends keyof ConditionChecklist>(
    field: K,
    value: ConditionChecklist[K]
  ) => void;
  setCurrentStep: (step: number | ((prev: number) => number)) => void;
  setIsSubmitting: (isSubmitting: boolean) => void;
  setIsSuccess: (isSuccess: boolean) => void;
  setPreviews: (
    previews:
      | Record<string, string | undefined>
      | ((
          prev: Record<string, string | undefined>
        ) => Record<string, string | undefined>)
  ) => void;
  setFormData: (
    data: ListingFormData | ((prev: ListingFormData) => ListingFormData)
  ) => void;
  setDraftSaved: (saved: boolean) => void;
  resetForm: (
    initialData?: Partial<ListingFormData>,
    initialStep?: number
  ) => void;
}

export const ListingWizardContext = createContext<
  ListingWizardContextType | undefined
>(undefined);
