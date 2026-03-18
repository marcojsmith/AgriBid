import React from "react";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { useListingWizard } from "./useListingWizard";
import { ListingWizardProvider } from "./ListingWizardContext";

describe("useListingWizard", () => {
  it("throws error when used outside of ListingWizardProvider", () => {
    // Suppress console.error for this test as React will log the error boundary/unhandled error
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useListingWizard())).toThrow(
      "useListingWizard must be used within a ListingWizardProvider"
    );

    spy.mockRestore();
  });

  it("returns context when used inside ListingWizardProvider", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ListingWizardProvider>{children}</ListingWizardProvider>
    );

    const { result } = renderHook(() => useListingWizard(), { wrapper });

    expect(result.current).toBeDefined();
    expect(result.current.formData).toBeDefined();
  });
});
