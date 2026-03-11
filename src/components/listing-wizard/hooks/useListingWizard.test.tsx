import React from "react";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { useListingWizard } from "./useListingWizard";
import {
  ListingWizardContext,
  type ListingWizardContextType,
} from "../context/ListingWizardContextDef";

describe("useListingWizard", () => {
  it("should throw error when used outside of Provider", () => {
    // Suppress console.error for this test as it's expected
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useListingWizard())).toThrow(
      "useListingWizard must be used within a ListingWizardProvider"
    );

    consoleSpy.mockRestore();
  });

  it("should return context when used within Provider", () => {
    const mockContextValue = {
      formData: {},
      currentStep: 0,
      isSubmitting: false,
      isSuccess: false,
      previews: {},
      draftSaved: false,
      updateField: vi.fn(),
      updateChecklist: vi.fn(),
      setCurrentStep: vi.fn(),
      setIsSubmitting: vi.fn(),
      setIsSuccess: vi.fn(),
      setPreviews: vi.fn(),
      setFormData: vi.fn(),
      setDraftSaved: vi.fn(),
      resetForm: vi.fn(),
    } as unknown as ListingWizardContextType;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ListingWizardContext.Provider value={mockContextValue}>
        {children}
      </ListingWizardContext.Provider>
    );

    const { result } = renderHook(() => useListingWizard(), { wrapper });
    expect(result.current).toBe(mockContextValue);
  });
});
