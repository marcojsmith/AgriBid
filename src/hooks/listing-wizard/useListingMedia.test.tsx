import React from "react";
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMutation } from "convex/react";
import { toast } from "sonner";

import {
  ListingWizardContext,
  type ListingWizardContextType,
} from "@/components/listing-wizard/context/ListingWizardContextDef";
import type { ListingFormData } from "@/components/listing-wizard/types";

import { useListingMedia } from "./useListingMedia";

vi.mock("convex/react", () => ({
  useMutation: vi.fn(),
}));

vi.mock("convex/_generated/api", () => ({
  api: {
    auctions: {
      mutations: {
        create: {
          generateUploadUrl: "auctions/mutations/create:generateUploadUrl",
        },
      },
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

const mockCreateObjectURL = vi.fn().mockReturnValue("blob:test-url");
const mockRevokeObjectURL = vi.fn();
const mockFetch = vi.fn();

global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;
global.fetch = mockFetch;

describe("useListingMedia", () => {
  const mockSetFormData = vi.fn(
    (cb: ListingFormData | ((prev: ListingFormData) => ListingFormData)) => {
      if (typeof cb === "function") {
        cb(currentFormData);
      }
    }
  );
  const mockSetPreviews = vi.fn(
    (
      cb:
        | Record<string, string>
        | ((prev: Record<string, string>) => Record<string, string>)
    ) => {
      if (typeof cb === "function") {
        cb(currentPreviews);
      }
    }
  );
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
    mockSetFormData.mockImplementation(
      (cb: ListingFormData | ((prev: ListingFormData) => ListingFormData)) => {
        if (typeof cb === "function") {
          cb(currentFormData);
        }
      }
    );
    mockSetPreviews.mockImplementation(
      (
        cb:
          | Record<string, string>
          | ((prev: Record<string, string>) => Record<string, string>)
      ) => {
        if (typeof cb === "function") {
          cb(currentPreviews);
        }
      }
    );
    currentFormData = {
      images: { additional: [] },
    } as unknown as ListingFormData;
    currentPreviews = {};
    vi.mocked(useMutation).mockReturnValue(
      mockGenerateUploadUrl as unknown as ReturnType<typeof useMutation>
    );
    mockFetch.mockReset();
    mockCreateObjectURL.mockReturnValue("blob:test-url");
    mockRevokeObjectURL.mockReset();
  });

  it("should handle single upload success and revoke old preview", async () => {
    mockGenerateUploadUrl.mockResolvedValue("http://upload.url");
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ storageId: "storage-1" }),
    });

    mockSetPreviews.mockImplementation(
      (
        cb:
          | Record<string, string>
          | ((prev: Record<string, string>) => Record<string, string>)
      ) => {
        if (typeof cb === "function") {
          cb({ front: "blob:old" });
        }
      }
    );

    const file = new File([""], "test.jpg", { type: "image/jpeg" });
    const { result } = renderHook(() => useListingMedia(), {
      wrapper: (props) =>
        wrapper({ ...props, previews: { front: "blob:old" } }),
    });

    await act(async () => {
      await result.current.handleUpload("front", file);
    });

    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:old");
    expect(mockSetPreviews).toHaveBeenCalled();
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it("should handle single upload to empty slot (covers false branch of line 44)", async () => {
    mockGenerateUploadUrl.mockResolvedValue("http://upload.url");
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ storageId: "storage-1" }),
    });

    const file = new File([""], "test.jpg", { type: "image/jpeg" });
    const { result } = renderHook(() => useListingMedia(), {
      wrapper: (props) => wrapper({ ...props, previews: {} }),
    });

    await act(async () => {
      await result.current.handleUpload("front", file);
    });

    expect(mockRevokeObjectURL).not.toHaveBeenCalled();
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
    expect(mockSetPreviews).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:test-url");
  });

  it("should handle upload result not ok", async () => {
    mockGenerateUploadUrl.mockResolvedValue("http://url");
    mockFetch.mockResolvedValue({ ok: false });
    const file = new File([""], "test.jpg", { type: "image/jpeg" });
    const { result } = renderHook(() => useListingMedia(), { wrapper });

    await act(async () => {
      await result.current.handleUpload("front", file);
    });

    expect(toast.error).toHaveBeenCalledWith("Upload failed");
  });

  it("should handle additional upload success", async () => {
    mockGenerateUploadUrl.mockResolvedValue("http://upload.url");
    mockFetch.mockResolvedValue({
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
    const formData = {
      images: { additional: ["1", "2", "3", "4", "5", "6"] },
    } as unknown as ListingFormData;
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
    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:test-url");
  });

  it("should handle remove additional", () => {
    const formData = {
      images: { additional: ["storage-add-0", "storage-add-1"] },
    } as unknown as ListingFormData;
    const previews = { "storage-add-0": "blob:url0" };
    const { result } = renderHook(() => useListingMedia(), {
      wrapper: (props) => wrapper({ ...props, formData, previews }),
    });

    act(() => {
      result.current.handleRemove("additional", 0);
    });

    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:url0");
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
    const formData = {
      images: { front: "s1", additional: [] },
    } as unknown as ListingFormData;
    const { result } = renderHook(() => useListingMedia(), {
      wrapper: (props) => wrapper({ ...props, formData, previews: {} }),
    });

    act(() => {
      result.current.handleRemove("front");
    });

    expect(mockRevokeObjectURL).not.toHaveBeenCalled();
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

    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:url1");
    expect(mockRevokeObjectURL).not.toHaveBeenCalledWith("http://other");
  });
});
