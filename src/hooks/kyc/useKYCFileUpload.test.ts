import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMutation } from "convex/react";
import { toast } from "sonner";

import { useFileUpload } from "@/hooks/useFileUpload";

import { useKYCFileUpload } from "./useKYCFileUpload";

vi.mock("convex/react", () => ({
  useMutation: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/hooks/useFileUpload", () => ({
  useFileUpload: vi.fn(),
}));

type FileUploadResult = ReturnType<typeof useFileUpload>;

/**
 * Builds a typed stub for the value `useFileUpload` returns, mocking every
 * member so each test only has to override what it cares about.
 *
 * @param overrides - Members that differ from the default stub
 * @returns A complete `useFileUpload` return value
 */
const mockFileUpload = (
  overrides: Partial<FileUploadResult> = {}
): FileUploadResult => ({
  isUploading: false,
  files: [],
  setFiles: vi.fn(),
  handleFileChange: vi.fn(),
  removeFile: vi.fn(),
  uploadFiles: vi.fn(),
  cleanupUploads: vi.fn(),
  ...overrides,
});

/**
 * Shapes a plain mock function like the value Convex's `useMutation` returns,
 * including the `withOptimisticUpdate` member the hook's result carries.
 *
 * @param mutation - Mock standing in for a mutation trigger function
 * @returns The same mock, typed as a `useMutation` result
 */
const asMutationResult = (
  mutation: ReturnType<typeof vi.fn>
): ReturnType<typeof useMutation> =>
  Object.assign(mutation, {
    withOptimisticUpdate: vi.fn(),
  }) as unknown as ReturnType<typeof useMutation>;

/**
 * Reads the options `useKYCFileUpload` passes to `useFileUpload`, failing loudly
 * when the hook has not called it.
 *
 * @returns The recorded `useFileUpload` call options
 */
const useFileUploadOptions = (): NonNullable<
  Parameters<typeof useFileUpload>[0]
> => {
  const options = vi.mocked(useFileUpload).mock.calls[0]?.[0];
  if (!options) {
    throw new Error("Expected useKYCFileUpload to call useFileUpload");
  }
  return options;
};

describe("useKYCFileUpload", () => {
  const mockDeleteMyKYCDocument = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMutation).mockReturnValue(
      asMutationResult(mockDeleteMyKYCDocument)
    );
  });

  it("should initialize with empty existing documents", () => {
    vi.mocked(useFileUpload).mockReturnValue(mockFileUpload());

    const { result } = renderHook(() => useKYCFileUpload());

    expect(result.current.existingDocuments).toEqual([]);
    expect(result.current.isUploading).toBe(false);
    expect(result.current.files).toEqual([]);
  });

  it("should set existing documents", () => {
    vi.mocked(useFileUpload).mockReturnValue(mockFileUpload());

    const { result } = renderHook(() => useKYCFileUpload());

    act(() => {
      result.current.setExistingDocuments(["doc1", "doc2"]);
    });

    expect(result.current.existingDocuments).toEqual(["doc1", "doc2"]);
  });

  it("should delete document successfully", async () => {
    mockDeleteMyKYCDocument.mockResolvedValueOnce({});
    vi.mocked(useFileUpload).mockReturnValue(mockFileUpload());

    const { result } = renderHook(() => useKYCFileUpload());

    act(() => {
      result.current.setExistingDocuments(["doc1", "doc2"]);
    });

    let deleteResult: boolean | undefined;
    await act(async () => {
      deleteResult = await result.current.executeDeleteDocument("doc1");
    });

    expect(deleteResult).toBe(true);
    expect(mockDeleteMyKYCDocument).toHaveBeenCalledWith({
      storageId: "doc1",
    });
    expect(toast.success).toHaveBeenCalledWith("Document deleted");
    expect(result.current.existingDocuments).toEqual(["doc2"]);
  });

  it("should handle delete error and rollback", async () => {
    mockDeleteMyKYCDocument.mockRejectedValueOnce(new Error("Delete failed"));
    vi.mocked(useFileUpload).mockReturnValue(mockFileUpload());

    const { result } = renderHook(() => useKYCFileUpload());

    act(() => {
      result.current.setExistingDocuments(["doc1", "doc2"]);
    });

    let deleteResult: boolean | undefined;
    await act(async () => {
      deleteResult = await result.current.executeDeleteDocument("doc1");
    });

    expect(deleteResult).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(
      "Failed to delete document: Delete failed"
    );
    expect(result.current.existingDocuments).toEqual(["doc2", "doc1"]);
  });

  it("should handle delete error with unknown message", async () => {
    mockDeleteMyKYCDocument.mockRejectedValueOnce("unknown error");
    vi.mocked(useFileUpload).mockReturnValue(mockFileUpload());

    const { result } = renderHook(() => useKYCFileUpload());

    act(() => {
      result.current.setExistingDocuments(["doc1"]);
    });

    await act(async () => {
      await result.current.executeDeleteDocument("doc1");
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Failed to delete document: Unknown error"
    );
  });

  it("should not duplicate document in rollback if already present", async () => {
    mockDeleteMyKYCDocument.mockRejectedValueOnce(new Error("Delete failed"));
    vi.mocked(useFileUpload).mockReturnValue(mockFileUpload());

    const { result } = renderHook(() => useKYCFileUpload());

    act(() => {
      result.current.setExistingDocuments(["doc1", "doc2"]);
    });

    await act(async () => {
      await result.current.executeDeleteDocument("doc1");
    });

    expect(result.current.existingDocuments).toEqual(["doc2", "doc1"]);
  });

  it("should pass upload configuration to useFileUpload", () => {
    const mockUploadFn = vi.fn();
    vi.mocked(useFileUpload).mockReturnValue(
      mockFileUpload({ uploadFiles: mockUploadFn })
    );

    renderHook(() => useKYCFileUpload());

    const uploadConfig = useFileUploadOptions();
    expect(uploadConfig.maxSize).toBe(10 * 1024 * 1024);
    expect(uploadConfig.allowedTypes).toContain("image/png");
    expect(uploadConfig.allowedTypes).toContain("image/jpeg");
    expect(uploadConfig.allowedTypes).toContain("application/pdf");
    expect(uploadConfig.maxFiles).toBe(5);
  });

  it("should cleanup KYC documents in cleanup handler", async () => {
    const mockCleanup = vi.fn();
    vi.mocked(useFileUpload).mockReturnValue(
      mockFileUpload({ cleanupUploads: mockCleanup })
    );

    const { result } = renderHook(() => useKYCFileUpload());

    await act(async () => {
      await result.current.cleanupUploads([]);
    });

    expect(mockCleanup).toHaveBeenCalled();
  });

  it("should expose isUploading from useFileUpload", () => {
    vi.mocked(useFileUpload).mockReturnValue(
      mockFileUpload({ isUploading: true })
    );

    const { result } = renderHook(() => useKYCFileUpload());

    expect(result.current.isUploading).toBe(true);
  });

  it("should expose files from useFileUpload", () => {
    const mockFiles = [new File([""], "test.pdf")];
    vi.mocked(useFileUpload).mockReturnValue(
      mockFileUpload({ files: mockFiles })
    );

    const { result } = renderHook(() => useKYCFileUpload());

    expect(result.current.files).toEqual(mockFiles);
  });

  it("should expose setFiles from useFileUpload", () => {
    const mockSetFiles = vi.fn();
    vi.mocked(useFileUpload).mockReturnValue(
      mockFileUpload({ setFiles: mockSetFiles })
    );

    const { result } = renderHook(() => useKYCFileUpload());

    act(() => {
      result.current.setFiles([]);
    });

    expect(mockSetFiles).toHaveBeenCalled();
  });

  it("should expose handleFileChange from useFileUpload", () => {
    const mockHandleFileChange = vi.fn();
    vi.mocked(useFileUpload).mockReturnValue(
      mockFileUpload({ handleFileChange: mockHandleFileChange })
    );

    const { result } = renderHook(() => useKYCFileUpload());

    const event = {
      target: { files: [new File([""], "test.pdf")] },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    act(() => {
      result.current.handleFileChange(event);
    });

    expect(mockHandleFileChange).toHaveBeenCalledWith(event);
  });

  it("should expose uploadFiles from useFileUpload", () => {
    const mockUploadFiles = vi.fn();
    vi.mocked(useFileUpload).mockReturnValue(
      mockFileUpload({ uploadFiles: mockUploadFiles })
    );

    const { result } = renderHook(() => useKYCFileUpload());

    act(() => {
      void result.current.uploadFiles();
    });

    expect(mockUploadFiles).toHaveBeenCalled();
  });

  it("should delete every stored id through the injected cleanup handler", async () => {
    vi.mocked(useFileUpload).mockReturnValue(mockFileUpload());
    mockDeleteMyKYCDocument.mockResolvedValue(undefined);

    renderHook(() => useKYCFileUpload());

    const cleanupHandler = useFileUploadOptions().cleanupHandler;
    expect(cleanupHandler).toBeDefined();
    await cleanupHandler?.(["storage1", "storage2"]);

    expect(mockDeleteMyKYCDocument).toHaveBeenCalledTimes(2);
    expect(mockDeleteMyKYCDocument).toHaveBeenCalledWith({
      storageId: "storage1",
    });
  });

  it("should log failures reported by the cleanup handler", async () => {
    vi.mocked(useFileUpload).mockReturnValue(mockFileUpload());
    mockDeleteMyKYCDocument
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("storage delete failed"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // intentional no-op: silence the expected cleanup failure log
    });

    renderHook(() => useKYCFileUpload());

    const cleanupHandler = useFileUploadOptions().cleanupHandler;
    expect(cleanupHandler).toBeDefined();
    await cleanupHandler?.(["storage1", "storage2"]);

    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to delete KYC storage storage2:",
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });
});
