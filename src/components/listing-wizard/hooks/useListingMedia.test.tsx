import React from "react";
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { useMutation } from "convex/react";

import { useListingMedia } from "./useListingMedia";
import {
  ListingWizardContext,
  type ListingWizardContextType,
} from "../context/ListingWizardContextDef";

vi.mock("convex/react", () => ({
  useMutation: vi.fn(),
}));

vi.mock("convex/_generated/api", () => ({
  api: {
    auctions: {
      generateUploadUrl: "generateUploadUrl",
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

// Mock URL
global.URL.createObjectURL = vi.fn().mockReturnValue("blob:test-url");
global.URL.revokeObjectURL = vi.fn();

describe("useListingMedia", () => {
  const mockSetFormData = vi.fn();
  const mockSetPreviews = vi.fn();
  const mockGenerateUploadUrl = vi.fn();

  const wrapper = ({
    children,
    formData = { images: { additional: [] } },
    previews = {},
  }: {
    children: React.ReactNode;
    formData?: Record<string, unknown>;
    previews?: Record<string, string>;
  }) => (
    <ListingWizardContext.Provider
      value={
        {
          formData,
          setFormData: mockSetFormData,
          previews,
          setPreviews: mockSetPreviews,
        } as unknown as ListingWizardContextType
      }
    >
      {children}
    </ListingWizardContext.Provider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    (useMutation as Mock).mockReturnValue(mockGenerateUploadUrl);
    global.fetch = vi.fn();
  });

  it("should handle single upload", async () => {
    mockGenerateUploadUrl.mockResolvedValue("http://upload.url");
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ storageId: "storage-1" }),
    });

    const file = new File([""], "test.jpg", { type: "image/jpeg" });
    const { result } = renderHook(() => useListingMedia(), { wrapper });

    await act(async () => {
      await result.current.handleUpload("front", file);
    });

    expect(global.URL.createObjectURL).toHaveBeenCalledWith(file);
    expect(mockSetPreviews).toHaveBeenCalled();
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it("should handle remove", () => {
    const previews = { front: "blob:url-1" };
    const formData = { images: { front: "storage-1", additional: [] } };

    const { result } = renderHook(() => useListingMedia(), {
      wrapper: (props) => wrapper({ ...props, formData, previews }),
    });

    act(() => {
      result.current.handleRemove("front");
    });

    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:url-1");
    expect(mockSetPreviews).toHaveBeenCalled();
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it("should cleanup previews", () => {
    const previews = { id1: "blob:url1", id2: "http://other" };
    const { result } = renderHook(() => useListingMedia(), {
      wrapper: (props) => wrapper({ ...props, previews }),
    });

    act(() => {
      result.current.cleanupPreviews();
    });

    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:url1");
    expect(global.URL.revokeObjectURL).not.toHaveBeenCalledWith("http://other");
  });
});
