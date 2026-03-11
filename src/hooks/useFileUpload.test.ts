import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { useMutation } from "convex/react";
import { toast } from "sonner";

import { useFileUpload } from "./useFileUpload";

vi.mock("convex/react", () => ({
  useMutation: vi.fn(),
}));

vi.mock("convex/_generated/api", () => ({
  api: {
    auctions: {
      generateUploadUrl: "generateUploadUrl",
      deleteUpload: "deleteUpload",
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("useFileUpload", () => {
  const mockGenerateUploadUrl = vi.fn();
  const mockDeleteUpload = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useMutation as Mock).mockImplementation((mutation: string) => {
      if (mutation === "generateUploadUrl") return mockGenerateUploadUrl;
      if (mutation === "deleteUpload") return mockDeleteUpload;
      return vi.fn();
    });
    global.fetch = vi.fn();
  });

  it("should initialize with empty files and not uploading", () => {
    const { result } = renderHook(() => useFileUpload());
    expect(result.current.files).toEqual([]);
    expect(result.current.isUploading).toBe(false);
  });

  it("should handle file selection and validation", () => {
    const { result } = renderHook(() => useFileUpload({ maxSize: 100 }));

    const largeFile = new File(["a".repeat(200)], "large.jpg", {
      type: "image/jpeg",
    });
    const validFile = new File(["a".repeat(50)], "valid.jpg", {
      type: "image/jpeg",
    });
    const invalidTypeFile = new File(["a"], "invalid.txt", {
      type: "text/plain",
    });

    act(() => {
      const event = {
        target: {
          files: [largeFile, validFile, invalidTypeFile],
          value: "some-path",
        },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      result.current.handleFileChange(event);
    });

    expect(result.current.files).toHaveLength(1);
    expect(result.current.files[0].name).toBe("valid.jpg");
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("exceeds")
    );
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("not a supported format")
    );
  });

  it("should respect maxFiles limit", () => {
    const { result } = renderHook(() => useFileUpload({ maxFiles: 2 }));

    const file1 = new File(["a"], "1.jpg", { type: "image/jpeg" });
    const file2 = new File(["a"], "2.jpg", { type: "image/jpeg" });
    const file3 = new File(["a"], "3.jpg", { type: "image/jpeg" });

    act(() => {
      result.current.handleFileChange({
        target: { files: [file1, file2, file3], value: "" },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.files).toHaveLength(0); // None added if total exceeds max
    expect(toast.error).toHaveBeenCalledWith("Maximum 2 files allowed");
  });

  it("should remove file by index", () => {
    const { result } = renderHook(() => useFileUpload());
    const file1 = new File(["a"], "1.jpg", { type: "image/jpeg" });
    const file2 = new File(["a"], "2.jpg", { type: "image/jpeg" });

    act(() => {
      result.current.handleFileChange({
        target: { files: [file1, file2], value: "" },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.files).toHaveLength(2);

    act(() => {
      result.current.removeFile(0);
    });

    expect(result.current.files).toHaveLength(1);
    expect(result.current.files[0].name).toBe("2.jpg");
  });

  it("should upload files successfully", async () => {
    const { result } = renderHook(() => useFileUpload());
    const file = new File(["a"], "test.jpg", { type: "image/jpeg" });

    mockGenerateUploadUrl.mockResolvedValue("http://upload.url");
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ storageId: "storage-123" }),
    });

    let storageIds: string[] | null = null;
    await act(async () => {
      storageIds = await result.current.uploadFiles([file]);
    });

    expect(storageIds).toEqual(["storage-123"]);
    expect(mockGenerateUploadUrl).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      "http://upload.url",
      expect.any(Object)
    );
    expect(result.current.isUploading).toBe(false);
  });

  it("should handle upload failure and perform cleanup", async () => {
    const { result } = renderHook(() => useFileUpload());
    const file1 = new File(["a"], "1.jpg", { type: "image/jpeg" });
    const file2 = new File(["a"], "2.jpg", { type: "image/jpeg" });

    mockGenerateUploadUrl.mockResolvedValue("http://upload.url");

    // First upload succeeds, second fails
    (global.fetch as Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ storageId: "storage-1" }),
      })
      .mockResolvedValueOnce({
        ok: false,
      });

    let storageIds: string[] | null = ["initial"];
    await act(async () => {
      storageIds = await result.current.uploadFiles([file1, file2]);
    });

    expect(storageIds).toBe(null);
    expect(mockDeleteUpload).toHaveBeenCalledWith({ storageId: "storage-1" });
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to upload")
    );
  });

  it("should use cleanupHandler if provided", async () => {
    const customCleanup = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useFileUpload({ cleanupHandler: customCleanup })
    );

    await act(async () => {
      await result.current.cleanupUploads(["id1", "id2"]);
    });

    expect(customCleanup).toHaveBeenCalledWith(["id1", "id2"]);
    expect(mockDeleteUpload).not.toHaveBeenCalled();
  });
});
