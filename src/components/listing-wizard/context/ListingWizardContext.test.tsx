import React from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { ListingWizardProvider } from "./ListingWizardContext";
import { ListingWizardContext } from "./ListingWizardContextDef";
import { DEFAULT_FORM_DATA, STEPS } from "../constants";
import type { ListingWizardContextType } from "./ListingWizardContextDef";

function TestConsumer({
  onRender,
}: {
  onRender: (ctx: ListingWizardContextType) => void;
}) {
  const ctx = React.useContext(
    ListingWizardContext
  ) as ListingWizardContextType;

  React.useEffect(() => {
    onRender(ctx);
  }, [ctx, onRender]);

  return <div data-testid="consumer">Test</div>;
}

describe("ListingWizardProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe("Initial State", () => {
    it("initializes with default form data when no localStorage", () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      let contextValue: ListingWizardContextType | undefined;

      render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.formData).toEqual(DEFAULT_FORM_DATA);
    });

    it("initializes with default step (0) when no localStorage", () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      let contextValue: ListingWizardContextType | undefined;

      render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.currentStep).toBe(0);
    });

    it("initializes isSubmitting as false", () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      let contextValue: ListingWizardContextType | undefined;

      render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.isSubmitting).toBe(false);
    });

    it("initializes isSuccess as false", () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      let contextValue: ListingWizardContextType | undefined;

      render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.isSuccess).toBe(false);
    });

    it("initializes previews as empty object", () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      let contextValue: ListingWizardContextType | undefined;

      render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.previews).toEqual({});
    });

    it("initializes draftSaved as false", () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      let contextValue: ListingWizardContextType | undefined;

      render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.draftSaved).toBe(false);
    });
  });

  describe("localStorage Restoration", () => {
    it("restores form data from localStorage", () => {
      const savedDraft = {
        make: "John Deere",
        model: "8R 410",
        year: 2022,
        categoryId: "cat1",
      };
      vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
        if (key === "agribid_listing_draft") return JSON.stringify(savedDraft);
        if (key === "agribid_listing_step") return null;
        return null;
      });

      let contextValue: ListingWizardContextType | undefined;

      render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.formData.make).toBe("John Deere");
      expect(contextValue?.formData.model).toBe("8R 410");
    });

    it("restores step from localStorage", () => {
      vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
        if (key === "agribid_listing_draft") return null;
        if (key === "agribid_listing_step") return "3";
        return null;
      });

      let contextValue: ListingWizardContextType | undefined;

      render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.currentStep).toBe(3);
    });

    it("clamps step to valid range (min) when negative", () => {
      vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
        if (key === "agribid_listing_draft") return null;
        if (key === "agribid_listing_step") return "-5";
        return null;
      });

      let contextValue: ListingWizardContextType | undefined;

      render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.currentStep).toBe(0);
    });

    it("clamps step to valid range (max)", () => {
      vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
        if (key === "agribid_listing_draft") return null;
        if (key === "agribid_listing_step") return "100";
        return null;
      });

      let contextValue: ListingWizardContextType | undefined;

      render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      // Initial state returns 0 for out-of-range values (doesn't clamp like resetForm)
      expect(contextValue?.currentStep).toBe(0);
    });

    it("handles invalid localStorage JSON gracefully", () => {
      vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
        if (key === "agribid_listing_draft") return "invalid json{";
        if (key === "agribid_listing_step") return null;
        return null;
      });

      let contextValue: ListingWizardContextType | undefined;

      render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.formData).toEqual(DEFAULT_FORM_DATA);
    });
  });

  describe("updateField", () => {
    it("updates a single field in formData", () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      let contextValue: ListingWizardContextType | undefined;

      const { rerender } = render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      contextValue?.updateField("make", "New Holland");

      rerender(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.formData.make).toBe("New Holland");
      expect(contextValue?.draftSaved).toBe(false);
    });

    it("preserves other fields when updating one", () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      let contextValue: ListingWizardContextType | undefined;

      const { rerender } = render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      contextValue?.updateField("make", "Case IH");

      rerender(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.formData.model).toBe(DEFAULT_FORM_DATA.model);
      expect(contextValue?.formData.year).toBe(DEFAULT_FORM_DATA.year);
    });
  });

  describe("updateChecklist", () => {
    it("updates a single checklist item", () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      let contextValue: ListingWizardContextType | undefined;

      const { rerender } = render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      contextValue?.updateChecklist("engine", true);

      rerender(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.formData.conditionChecklist.engine).toBe(true);
      expect(contextValue?.draftSaved).toBe(false);
    });

    it("preserves other checklist items when updating one", () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      let contextValue: ListingWizardContextType | undefined;

      const { rerender } = render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      contextValue?.updateChecklist("hydraulics", false);

      rerender(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.formData.conditionChecklist.engine).toBe(null);
      expect(contextValue?.formData.conditionChecklist.tires).toBe(null);
    });
  });

  describe("setCurrentStep", () => {
    it("updates currentStep directly", () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      let contextValue: ListingWizardContextType | undefined;

      const { rerender } = render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      contextValue?.setCurrentStep(2);

      rerender(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.currentStep).toBe(2);
    });

    it("supports functional update", () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      let contextValue: ListingWizardContextType | undefined;

      const { rerender } = render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      contextValue?.setCurrentStep((prev) => prev + 1);

      rerender(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.currentStep).toBe(1);
    });
  });

  describe("setIsSubmitting", () => {
    it("updates isSubmitting state", () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      let contextValue: ListingWizardContextType | undefined;

      const { rerender } = render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.isSubmitting).toBe(false);

      contextValue?.setIsSubmitting(true);

      rerender(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.isSubmitting).toBe(true);
    });
  });

  describe("setIsSuccess", () => {
    it("updates isSuccess state", () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      let contextValue: ListingWizardContextType | undefined;

      const { rerender } = render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.isSuccess).toBe(false);

      contextValue?.setIsSuccess(true);

      rerender(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.isSuccess).toBe(true);
    });
  });

  describe("setPreviews", () => {
    it("updates previews object", () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      let contextValue: ListingWizardContextType | undefined;

      const { rerender } = render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      const newPreviews = { front: "preview-url-1" };

      contextValue?.setPreviews(newPreviews);

      rerender(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.previews).toEqual(newPreviews);
    });

    it("supports functional update for previews", () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      let contextValue: ListingWizardContextType | undefined;

      const { rerender } = render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      contextValue?.setPreviews((prev) => ({ ...prev, engine: "url" }));

      rerender(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.previews.engine).toBe("url");
    });
  });

  describe("setDraftSaved", () => {
    it("updates draftSaved state", () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      let contextValue: ListingWizardContextType | undefined;

      const { rerender } = render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.draftSaved).toBe(false);

      contextValue?.setDraftSaved(true);

      rerender(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.draftSaved).toBe(true);
    });
  });

  describe("resetForm", () => {
    it("reset path: clears form to defaults and removes localStorage", () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      let contextValue: ListingWizardContextType | undefined;

      const { rerender } = render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      contextValue?.updateField("make", "Modified Make");
      contextValue?.setCurrentStep(4);
      contextValue?.setIsSuccess(true);
      contextValue?.setIsSubmitting(true);

      rerender(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      contextValue?.resetForm();

      rerender(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.formData).toEqual(DEFAULT_FORM_DATA);
      expect(contextValue?.currentStep).toBe(0);
      expect(contextValue?.isSuccess).toBe(false);
      expect(contextValue?.isSubmitting).toBe(false);
      expect(contextValue?.draftSaved).toBe(false);
      expect(localStorage.removeItem).toHaveBeenCalledWith(
        "agribid_listing_draft"
      );
      expect(localStorage.removeItem).toHaveBeenCalledWith(
        "agribid_listing_step"
      );
    });

    it("hydration path: sets form data and step from provided initialData", () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      let contextValue: ListingWizardContextType | undefined;

      const { rerender } = render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      const initialData = {
        make: "Kubota",
        model: "M7-172",
        year: 2023,
      };

      contextValue?.resetForm(initialData, 2);

      rerender(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.formData.make).toBe("Kubota");
      expect(contextValue?.formData.model).toBe("M7-172");
      expect(contextValue?.currentStep).toBe(2);
      expect(contextValue?.isSuccess).toBe(false);
      expect(contextValue?.isSubmitting).toBe(false);
      expect(contextValue?.draftSaved).toBe(true);
    });

    it("hydration path: clamps step to valid range", () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      let contextValue: ListingWizardContextType | undefined;

      const { rerender } = render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      contextValue?.resetForm({}, 100);

      rerender(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.currentStep).toBe(STEPS.length - 1);
    });

    it("hydration path: clamps negative step to 0", () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      let contextValue: ListingWizardContextType | undefined;

      const { rerender } = render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      contextValue?.resetForm({}, -10);

      rerender(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.currentStep).toBe(0);
    });

    it("always clears previews on reset", () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      let contextValue: ListingWizardContextType | undefined;

      const { rerender } = render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      contextValue?.setPreviews({ front: "some-url" });

      rerender(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      contextValue?.resetForm({ make: "Test" });

      rerender(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      expect(contextValue?.previews).toEqual({});
    });
  });

  describe("localStorage Persistence", () => {
    it("saves formData to localStorage on change", async () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      let contextValue: ListingWizardContextType | undefined;

      render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      contextValue?.updateField("make", "Updated Make");

      await waitFor(() => {
        expect(localStorage.setItem).toHaveBeenCalledWith(
          "agribid_listing_draft",
          expect.any(String)
        );
      });
    });

    it("saves step to localStorage on change", async () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      let contextValue: ListingWizardContextType | undefined;

      render(
        <ListingWizardProvider>
          <TestConsumer
            onRender={(ctx) => {
              contextValue = ctx;
            }}
          />
        </ListingWizardProvider>
      );

      contextValue?.setCurrentStep(3);

      await waitFor(() => {
        expect(localStorage.setItem).toHaveBeenCalledWith(
          "agribid_listing_step",
          "3"
        );
      });
    });
  });
});
