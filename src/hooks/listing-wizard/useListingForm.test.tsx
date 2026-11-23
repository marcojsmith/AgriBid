import React from "react";
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  ListingWizardContext,
  type ListingWizardContextType,
} from "@/components/listing-wizard/context/ListingWizardContextDef";
import { DEFAULT_FORM_DATA } from "@/components/listing-wizard/constants";

import { useListingForm } from "./useListingForm";

const mockSetCurrentStep = vi.fn();
const mockUseQuery = vi.hoisted(() => vi.fn());

vi.mock("convex/react", () => ({ useQuery: mockUseQuery }));
vi.mock("convex/_generated/api", () => ({
  api: {
    admin: {
      platformSettings: { getPlatformSettings: "admin:getPlatformSettings" },
    },
  },
}));

/**
 * Renders the hook with the given form data on the media step.
 *
 * @param images - Image slots to place in the form data.
 * @returns The hook's render result.
 */
function renderMediaStep(images: Partial<typeof DEFAULT_FORM_DATA.images>) {
  const formData = {
    ...DEFAULT_FORM_DATA,
    images: { ...DEFAULT_FORM_DATA.images, ...images },
  };
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <ListingWizardContext.Provider
      value={
        {
          formData,
          currentStep: 3,
          setCurrentStep: mockSetCurrentStep,
        } as unknown as ListingWizardContextType
      }
    >
      {children}
    </ListingWizardContext.Provider>
  );
  return renderHook(() => useListingForm(), { wrapper: Wrapper });
}

describe("useListingForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue({ minPhotosPerLot: 8 });
  });

  it("requires the configured minimum number of distinct photos on the media step", () => {
    const { result } = renderMediaStep({
      front: "a",
      engine: "b",
      additional: ["c", "c", "d"],
    });
    expect(result.current.getStepError(3)).toBe(
      "At least 8 photos are required (you have 4)"
    );
  });

  it("accepts the media step once the minimum is met", () => {
    const { result } = renderMediaStep({
      front: "a",
      engine: "b",
      cabin: "c",
      rear: "d",
      additional: ["e", "f", "g", "h"],
    });
    expect(result.current.getStepError(3)).toBeNull();
  });

  it("only requires one photo until the platform settings have loaded", () => {
    mockUseQuery.mockReturnValue(undefined);
    expect(renderMediaStep({}).result.current.getStepError(3)).toBe(
      "At least one photo is required"
    );
    expect(
      renderMediaStep({ front: "a" }).result.current.getStepError(3)
    ).toBeNull();
  });

  it("should validate General Info step (step 0)", () => {
    let currentFormData = { ...DEFAULT_FORM_DATA };
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

    currentFormData = { ...DEFAULT_FORM_DATA, title: "Test" };
    rerender();
    expect(result.current.getStepError(0)).toBe("Location is required");

    currentFormData = { ...DEFAULT_FORM_DATA, title: "Test", location: "Loc" };
    rerender();
    expect(result.current.getStepError(0)).toBe("Province is required");

    // Default year is current year, so we need to set an invalid year to test this
    currentFormData = {
      ...DEFAULT_FORM_DATA,
      title: "Test",
      location: "Loc",
      province: "gauteng" as const,
      year: 0,
    };
    rerender();
    expect(result.current.getStepError(0)).toBe("Valid year is required");

    currentFormData = {
      ...DEFAULT_FORM_DATA,
      title: "Test",
      location: "Loc",
      province: "gauteng" as const,
      year: 2020,
      operatingHours: -1,
    };
    rerender();
    expect(result.current.getStepError(0)).toBe(
      "Operating hours cannot be negative"
    );

    currentFormData = {
      ...DEFAULT_FORM_DATA,
      title: "Test",
      location: "Loc",
      province: "gauteng" as const,
      year: 2020,
      operatingHours: undefined as unknown as number,
    };
    rerender();
    expect(result.current.getStepError(0)).toBe("Operating hours are required");

    currentFormData = {
      ...DEFAULT_FORM_DATA,
      title: "Test",
      location: "Loc",
      province: "gauteng" as const,
      year: 2020,
      operatingHours: 100,
    };
    rerender();
    expect(result.current.getStepError(0)).toBe(null);
  });

  it("should navigate next only if valid", () => {
    const currentFormData = {
      ...DEFAULT_FORM_DATA,
      title: "Test",
      location: "",
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
    expect(mockSetCurrentStep).not.toHaveBeenCalled();
  });

  it("should navigate next if valid", () => {
    const currentFormData = {
      ...DEFAULT_FORM_DATA,
      title: "Test",
      location: "Loc",
      province: "gauteng" as const,
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
    const currentFormData = { ...DEFAULT_FORM_DATA };
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
