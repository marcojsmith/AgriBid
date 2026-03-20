import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("./context/useListingWizard", () => ({
  useListingWizard: vi.fn(),
}));

import { ListingWizard } from "./ListingWizard";
import { useListingWizard } from "./context/useListingWizard";
import { DEFAULT_FORM_DATA } from "./constants";

// Mock child components
vi.mock("./steps/GeneralInfoStep", () => ({
  GeneralInfoStep: () => <div>Step 0</div>,
}));
vi.mock("./steps/TechnicalSpecsStep", () => ({
  TechnicalSpecsStep: () => <div>Step 1</div>,
}));
vi.mock("./steps/MediaGalleryStep", () => ({
  MediaGalleryStep: () => <div>Step 2</div>,
}));
vi.mock("./steps/ConditionChecklistStep", () => ({
  ConditionChecklistStep: () => <div>Step 3</div>,
}));
vi.mock("./steps/PricingDurationStep", () => ({
  PricingDurationStep: () => <div>Step 4</div>,
}));
vi.mock("./steps/ReviewSubmitStep", () => ({
  ReviewSubmitStep: () => <div>Step 5</div>,
}));

vi.mock("@/hooks/useFileUpload", () => ({
  useFileUpload: () => ({
    files: [],
    previews: [],
    isUploading: false,
    handleFileChange: vi.fn(),
    removeFile: vi.fn(),
    uploadFiles: vi.fn(),
    clearFiles: vi.fn(),
  }),
}));

vi.mock("convex/react", () => ({
  useMutation: vi.fn(() => vi.fn()),
  useQuery: vi.fn(),
  usePaginatedQuery: vi.fn(() => ({
    results: [],
    status: "CanLoadMore",
    loadMore: vi.fn(),
  })),
}));

describe("ListingWizard Edge Cases", () => {
  const createMockContextValue = () => ({
    currentStep: 0,
    formData: { ...DEFAULT_FORM_DATA },
    updateField: vi.fn(),
    nextStep: vi.fn(),
    prevStep: vi.fn(),
    goToStep: vi.fn(),
    resetForm: vi.fn(),
    isSubmitting: false,
    isSavingDraft: false,
    error: null,
    isFormInitialized: true,
    setIsFormInitialized: vi.fn(),
    setDraftSaved: vi.fn(),
    setIsSubmitting: vi.fn(),
    setIsSuccess: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders null for invalid step index (line 317)", () => {
    vi.mocked(useListingWizard).mockReturnValue({
      ...createMockContextValue(),
      currentStep: 99, // Invalid step
    } as unknown as ReturnType<typeof useListingWizard>);

    const { container } = render(
      <MemoryRouter>
        <ListingWizard />
      </MemoryRouter>
    );

    // The inner div containing renderStep should be empty when currentStep is invalid
    const innerContent = container.querySelector(".bg-card");
    expect(innerContent?.innerHTML).toBe("");
  });

  it("handles invalid JSON in localStorage on mount", () => {
    localStorage.setItem("agribid_listing_draft", "{invalid json");

    vi.mocked(useListingWizard).mockReturnValue({
      ...createMockContextValue(),
      resetForm: vi.fn(),
    } as unknown as ReturnType<typeof useListingWizard>);

    render(
      <MemoryRouter>
        <ListingWizard />
      </MemoryRouter>
    );

    expect(vi.mocked(useListingWizard)().resetForm).toHaveBeenCalledWith();
  });

  it("handles valid draft but missing step in localStorage on mount", () => {
    localStorage.setItem(
      "agribid_listing_draft",
      JSON.stringify({ title: "Test" })
    );
    // agribid_listing_step is not set

    vi.mocked(useListingWizard).mockReturnValue({
      ...createMockContextValue(),
      resetForm: vi.fn(),
    } as unknown as ReturnType<typeof useListingWizard>);

    render(
      <MemoryRouter>
        <ListingWizard />
      </MemoryRouter>
    );

    expect(vi.mocked(useListingWizard)().resetForm).toHaveBeenCalledWith(
      { title: "Test" },
      0
    );
  });
});
