import React, { createContext, useContext, useState, useEffect } from "react";
import type { ListingFormData, ConditionChecklist } from "../types";
import { DEFAULT_FORM_DATA } from "../constants";

interface ListingWizardContextType {
  formData: ListingFormData;
  currentStep: number;
  isSubmitting: boolean;
  isSuccess: boolean;
  previews: Record<string, string>;
  setFormData: React.Dispatch<React.SetStateAction<ListingFormData>>;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSuccess: React.Dispatch<React.SetStateAction<boolean>>;
  setPreviews: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  updateField: <K extends keyof ListingFormData>(field: K, value: ListingFormData[K]) => void;
  updateChecklist: <K extends keyof ConditionChecklist>(field: K, value: ConditionChecklist[K]) => void;
}

const ListingWizardContext = createContext<ListingWizardContextType | undefined>(undefined);

export const ListingWizardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<ListingFormData>(() => {
    const saved = localStorage.getItem("agribid_listing_draft");
    if (!saved) return DEFAULT_FORM_DATA;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.images) || !parsed.images?.additional) {
        return DEFAULT_FORM_DATA;
      }
      return parsed;
    } catch (e) {
      console.error("Failed to parse listing draft", e);
      localStorage.removeItem("agribid_listing_draft");
      return DEFAULT_FORM_DATA;
    }
  });

  useEffect(() => {
    localStorage.setItem("agribid_listing_draft", JSON.stringify(formData));
  }, [formData]);

  const updateField = <K extends keyof ListingFormData>(field: K, value: ListingFormData[K]) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      if (field === "make" || field === "model" || field === "year") {
        const parts = [newData.year, newData.make, newData.model].filter(Boolean);
        if (parts.length > 0) {
          newData.title = parts.join(" ");
        }
      }
      return newData;
    });
  };

  const updateChecklist = <K extends keyof ConditionChecklist>(field: K, value: ConditionChecklist[K]) => {
    setFormData((prev) => ({
      ...prev,
      conditionChecklist: {
        ...prev.conditionChecklist,
        [field]: value,
      }
    }));
  };

  return (
    <ListingWizardContext.Provider
      value={{
        formData,
        currentStep,
        isSubmitting,
        isSuccess,
        previews,
        setFormData,
        setCurrentStep,
        setIsSubmitting,
        setIsSuccess,
        setPreviews,
        updateField,
        updateChecklist,
      }}
    >
      {children}
    </ListingWizardContext.Provider>
  );
};

export const useListingWizard = () => {
  const context = useContext(ListingWizardContext);
  if (context === undefined) {
    throw new Error("useListingWizard must be used within a ListingWizardProvider");
  }
  return context;
};
