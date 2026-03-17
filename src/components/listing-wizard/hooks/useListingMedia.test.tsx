import React from "react";
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { useMutation } from "convex/react";
import { toast } from "sonner";

import { useListingMedia } from "./useListingMedia";
import {
  ListingWizardContext,
  type ListingWizardContextType,
} from "../context/ListingWizardContextDef";
import type { ListingFormData } from "../types";

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
  const mockSetFormData = vi.fn((cb) => {
    if (typeof cb === "function") {
      cb(currentFormData);
    }
  });
  const mockSetPreviews = vi.fn((cb) => {
    if (typeof cb === "function") {
      cb(currentPreviews);
    }
  });
  const mockGenerateUploadUrl = vi.fn();

  let currentFormData: ListingFormData;
  let currentPreviews: Record<string, string>;

  const wrapper = ({
    children,
    formData,
    previews = {},
  }: {
    children: React.ReactNode;
    formData?: ListingFormData;
    previews?: Record<string, string>;
  }) => {
    if (formData) {
      currentFormData = formData;
    }
    currentPreviews = previews;
    return (
      <ListingWizardContext.Provider
        value={
          {
            formData: currentFormData,
            setFormData: mockSetFormData,
            previews: currentPreviews,
            setPreviews: mockSetPreviews,
          } as unknown as ListingWizardContextType
        }
      >
        {children}
      </ListingWizardContext.Provider>
    );
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockSetFormData.mockImplementation((cb) => {
      if (typeof cb === "function") {
        cb(currentFormData);
      }
    });
    mockSetPreviews.mockImplementation((cb) => {
      if (typeof cb === "function") {
        cb(currentPreviews);
      }
    });
    currentFormData = {
      images: { additional: [] },
    } as unknown as ListingFormData;
    currentPreviews = {};
    (useMutation as Mock).mockReturnValue(mockGenerateUploadUrl);
    global.fetch = vi.fn();
    global.URL.createObjectURL = vi.fn().mockReturnValue("blob:test-url");
    global.URL.revokeObjectURL = vi.fn();
  });

  it("should handle single upload success and revoke old preview", async () => {
    mockGenerateUploadUrl.mockResolvedValue("http://upload.url");
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ storageId: "storage-1" }),
    });

    // Mock setPreviews to trigger the callback where revocation happens
    mockSetPreviews.mockImplementation((cb) => {
      cb({ front: "blob:old" });
    });

    const file = new File([""], "test.jpg", { type: "image/jpeg" });
    const { result } = renderHook(() => useListingMedia(), {
      wrapper: (props) =>
        wrapper({ ...props, previews: { front: "blob:old" } }),
    });

    await act(async () => {
      await result.current.handleUpload("front", file);
    });

    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:old");
    expect(mockSetPreviews).toHaveBeenCalled();
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it("should handle single upload to empty slot (covers false branch of line 44)", async () => {
    mockGenerateUploadUrl.mockResolvedValue("http://upload.url");
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ storageId: "storage-1" }),
    });

    const file = new File([""], "test.jpg", { type: "image/jpeg" });
    const { result } = renderHook(() => useListingMedia(), {
      wrapper: (props) => wrapper({ ...props, previews: {} }), // Empty previews
    });

    await act(async () => {
      await result.current.handleUpload("front", file);
    });

    expect(global.URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(mockSetPreviews).toHaveBeenCalled();
  });

  it("should handle single upload failure", async () => {
    mockGenerateUploadUrl.mockRejectedValue(new Error("API Error"));
    const file = new File([""], "test.jpg", { type: "image/jpeg" });
    const { result } = renderHook(() => useListingMedia(), { wrapper });

    await act(async () => {
      await result.current.handleUpload("front", file);
    });

    expect(toast.error).toHaveBeenCalledWith("API Error");
    expect(mockSetPreviews).toHaveBeenCalled(); // Should cleanup on fail
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-url");
  });

  it("should handle upload result not ok", async () => {
    mockGenerateUploadUrl.mockResolvedValue("http://url");
    (global.fetch as Mock).mockResolvedValue({ ok: false });
    const file = new File([""], "test.jpg", { type: "image/jpeg" });
    const { result } = renderHook(() => useListingMedia(), { wrapper });

    await act(async () => {
      await result.current.handleUpload("front", file);
    });

    expect(toast.error).toHaveBeenCalledWith("Upload failed");
  });

  it("should handle additional upload success", async () => {
    mockGenerateUploadUrl.mockResolvedValue("http://upload.url");
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ storageId: "storage-add-1" }),
    });

    const files = [new File([""], "add1.jpg", { type: "image/jpeg" })];
    const { result } = renderHook(() => useListingMedia(), { wrapper });

    await act(async () => {
      await result.current.handleAdditionalUpload(files);
    });

    expect(mockSetFormData).toHaveBeenCalled();
    expect(mockSetPreviews).toHaveBeenCalled();
  });

  it("should handle additional upload max limit", async () => {
    const formData = { images: { additional: ["1", "2", "3", "4", "5", "6"] } };
    const { result } = renderHook(() => useListingMedia(), {
      wrapper: (props) => wrapper({ ...props, formData }),
    });

    await act(async () => {
      await result.current.handleAdditionalUpload([new File([""], "7.jpg")]);
    });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Maximum of 6")
    );
  });

  it("should handle additional upload failure", async () => {
    mockGenerateUploadUrl.mockRejectedValue(new Error("Fail"));
    const files = [new File([""], "fail.jpg")];
    const { result } = renderHook(() => useListingMedia(), { wrapper });

    await act(async () => {
      await result.current.handleAdditionalUpload(files);
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Failed to upload one or more images"
    );
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-url");
  });

  it("should handle remove additional", () => {
    const formData = {
      images: { additional: ["storage-add-0", "storage-add-1"] },
    };
    const previews = { "storage-add-0": "blob:url0" };
    const { result } = renderHook(() => useListingMedia(), {
      wrapper: (props) => wrapper({ ...props, formData, previews }),
    });

    act(() => {
      result.current.handleRemove("additional", 0);
    });

    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:url0");
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it("should ignore remove additional if index missing", () => {
    const { result } = renderHook(() => useListingMedia(), { wrapper });
    act(() => {
      result.current.handleRemove("additional");
    });
    expect(mockSetFormData).not.toHaveBeenCalled();
  });

  it("should handle remove without preview", () => {
    const formData = { images: { front: "s1", additional: [] } };
    const { result } = renderHook(() => useListingMedia(), {
      wrapper: (props) => wrapper({ ...props, formData, previews: {} }),
    });

    act(() => {
      result.current.handleRemove("front");
    });

    expect(global.URL.revokeObjectURL).not.toHaveBeenCalled();
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
