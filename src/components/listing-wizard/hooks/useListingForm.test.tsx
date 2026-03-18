import React from "react";
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { useListingForm } from "./useListingForm";
import {
  ListingWizardContext,
  type ListingWizardContextType,
} from "../context/ListingWizardContextDef";

const mockSetCurrentStep = vi.fn();

describe("useListingForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should validate General Info step (step 0)", () => {
    let currentFormData: Record<string, unknown> = {};
    const currentStepValue = 0;

    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <ListingWizardContext.Provider
        value={
          {
            formData: currentFormData,
            currentStep: currentStepValue,
            setCurrentStep: mockSetCurrentStep,
          } as unknown as ListingWizardContextType
        }
      >
        {children}
      </ListingWizardContext.Provider>
    );

    const { result, rerender } = renderHook(() => useListingForm(), {
      wrapper: Wrapper,
    });

    expect(result.current.getStepError(0)).toBe("Title is required");

    currentFormData = { title: "Test" };
    rerender();
    expect(result.current.getStepError(0)).toBe("Location is required");

    currentFormData = { title: "Test", location: "Loc" };
    rerender();
    expect(result.current.getStepError(0)).toBe("Valid year is required");

    currentFormData = { title: "Test", location: "Loc", year: 2020 };
    rerender();
    expect(result.current.getStepError(0)).toBe("Operating hours are required");

    currentFormData = {
      title: "Test",
      location: "Loc",
      year: 2020,
      operatingHours: 100,
    };
    rerender();
    expect(result.current.getStepError(0)).toBe(null);
  });

  it("should navigate next only if valid", () => {
    const currentFormData: Record<string, unknown> = { title: "Test" };
    const currentStepValue = 0;

    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <ListingWizardContext.Provider
        value={
          {
            formData: currentFormData,
            currentStep: currentStepValue,
            setCurrentStep: mockSetCurrentStep,
          } as unknown as ListingWizardContextType
        }
      >
        {children}
      </ListingWizardContext.Provider>
    );

    const { result } = renderHook(() => useListingForm(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.next();
    });
    // Since title only is not enough
    expect(mockSetCurrentStep).not.toHaveBeenCalled();
  });

  it("should navigate next if valid", () => {
    const currentFormData: Record<string, unknown> = {
      title: "Test",
      location: "Loc",
      year: 2020,
      operatingHours: 100,
    };
    const currentStepValue = 0;

    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <ListingWizardContext.Provider
        value={
          {
            formData: currentFormData,
            currentStep: currentStepValue,
            setCurrentStep: mockSetCurrentStep,
          } as unknown as ListingWizardContextType
        }
      >
        {children}
      </ListingWizardContext.Provider>
    );

    const { result } = renderHook(() => useListingForm(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.next();
    });
    expect(mockSetCurrentStep).toHaveBeenCalledWith(1);
  });

  it("should navigate prev", () => {
    const currentFormData: Record<string, unknown> = {};
    const currentStepValue = 1;

    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <ListingWizardContext.Provider
        value={
          {
            formData: currentFormData,
            currentStep: currentStepValue,
            setCurrentStep: mockSetCurrentStep,
          } as unknown as ListingWizardContextType
        }
      >
        {children}
      </ListingWizardContext.Provider>
    );

    const { result } = renderHook(() => useListingForm(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.prev();
    });
    expect(mockSetCurrentStep).toHaveBeenCalledWith(0);
  });
});
