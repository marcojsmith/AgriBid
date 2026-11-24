import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeDoc } from "@/pages/register/testing";

import { useDocumentPreview, useProtectedDocument } from "./useDocumentPreview";

const getToken = vi.fn();

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ getToken }),
}));

const fetchMock = vi.fn();
const createObjectURL = vi.fn();
const revokeObjectURL = vi.fn();

/**
 * Builds a file response.
 *
 * @param type - Content-Type header
 * @param status - HTTP status
 * @returns The response
 */
function file(type: string, status = 200): Response {
  return new Response(new Uint8Array([1, 2, 3]), {
    status,
    headers: { "Content-Type": type },
  });
}

describe("useDocumentPreview", () => {
  let counter = 0;

  beforeEach(() => {
    counter = 0;
    fetchMock.mockReset();
    getToken.mockReset().mockResolvedValue("clerk-token");
    createObjectURL.mockReset().mockImplementation(() => {
      counter += 1;
      return `blob:doc-${String(counter)}`;
    });
    revokeObjectURL.mockReset();
    vi.stubEnv("VITE_CONVEX_SITE_URL", "https://site.test");
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal(
      "URL",
      Object.assign(URL, { createObjectURL, revokeObjectURL })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns nothing for an empty slot and never fetches", () => {
    const { result } = renderHook(() => useDocumentPreview(undefined));
    expect(result.current).toEqual({ isPdf: false, loading: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches an image with the bearer token and exposes an object URL", async () => {
    fetchMock.mockResolvedValue(file("image/jpeg"));
    const doc = makeDoc("id_front");
    const { result } = renderHook(() => useDocumentPreview(doc));

    expect(result.current.loading).toBe(true);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://site.test/documents/file?id=doc_id_front",
      expect.objectContaining({
        headers: { Authorization: "Bearer clerk-token" },
      })
    );
    expect(getToken).toHaveBeenCalledWith({ template: "convex" });
    expect(result.current).toMatchObject({
      src: "blob:doc-1",
      href: "blob:doc-1",
      isPdf: false,
      loading: false,
    });
  });

  it("revokes the object URL on unmount", async () => {
    fetchMock.mockResolvedValue(file("image/png"));
    const { result, unmount } = renderHook(() =>
      useDocumentPreview(makeDoc("id_front"))
    );
    await waitFor(() => {
      expect(result.current.src).toBe("blob:doc-1");
    });
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:doc-1");
  });

  it("revokes the old URL and fetches again when the document changes", async () => {
    // A Response body can be read once, so build a fresh one per call.
    fetchMock.mockImplementation(() => Promise.resolve(file("image/jpeg")));
    const { result, rerender } = renderHook(
      ({ kind }: { kind: "id_front" | "id_back" }) =>
        useDocumentPreview(makeDoc(kind)),
      { initialProps: { kind: "id_front" } }
    );
    await waitFor(() => {
      expect(result.current.src).toBe("blob:doc-1");
    });

    rerender({ kind: "id_back" });
    await waitFor(() => {
      expect(result.current.src).toBe("blob:doc-2");
    });
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:doc-1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("flags a PDF and gives no image source, only a link", async () => {
    fetchMock.mockResolvedValue(file("application/pdf"));
    const { result } = renderHook(() =>
      useDocumentPreview(
        makeDoc("proof_of_address", "pending", {
          fileName: "bill.PDF",
          contentType: "application/pdf",
        })
      )
    );
    expect(result.current.isPdf).toBe(true);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current).toMatchObject({
      isPdf: true,
      src: undefined,
      href: "blob:doc-1",
    });
  });

  it("never lets an unexpected content type render", async () => {
    fetchMock.mockResolvedValue(file("text/html"));
    const { result } = renderHook(() =>
      useDocumentPreview(makeDoc("id_front"))
    );
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.src).toBeUndefined();
    expect(result.current.isPdf).toBe(false);
  });

  it("reports a 404 as an error and creates no object URL", async () => {
    fetchMock.mockResolvedValue(file("application/json", 404));
    const { result } = renderHook(() =>
      useDocumentPreview(makeDoc("id_front"))
    );
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe("That document isn't available.");
    expect(result.current.src).toBeUndefined();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("reports a server error and a missing token", async () => {
    fetchMock.mockResolvedValue(file("application/json", 500));
    const first = renderHook(() => useDocumentPreview(makeDoc("id_front")));
    await waitFor(() => {
      expect(first.result.current.error).toBe("Couldn't load that document.");
    });

    getToken.mockResolvedValue(null);
    const second = renderHook(() => useDocumentPreview(makeDoc("id_back")));
    await waitFor(() => {
      expect(second.result.current.error).toBe(
        "Sign in again to view documents."
      );
    });
  });

  it("falls back to a generic message for a non-Error rejection", async () => {
    getToken.mockRejectedValue("nope");
    const { result } = renderHook(() =>
      useDocumentPreview(makeDoc("id_front"))
    );
    await waitFor(() => {
      expect(result.current.error).toBe("Couldn't load that document.");
    });
  });

  it("ignores a response that arrives after unmount", async () => {
    let finish: (value: Response) => void = () => undefined;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        finish = resolve;
      })
    );
    const { unmount } = renderHook(() =>
      useDocumentPreview(makeDoc("id_front"))
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    unmount();
    finish(file("image/jpeg"));
    await Promise.resolve();
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});

describe("useProtectedDocument (legacy target)", () => {
  beforeEach(() => {
    fetchMock
      .mockReset()
      .mockImplementation(() => Promise.resolve(file("image/jpeg")));
    getToken.mockReset().mockResolvedValue("clerk-token");
    createObjectURL.mockReset().mockReturnValue("blob:legacy");
    vi.stubEnv("VITE_CONVEX_SITE_URL", "https://site.test");
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal(
      "URL",
      Object.assign(URL, { createObjectURL, revokeObjectURL })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("reads a legacy file by user and index", async () => {
    const { result } = renderHook(() =>
      useProtectedDocument({ kind: "legacy", userId: "user_1", index: 2 })
    );
    await waitFor(() => {
      expect(result.current.src).toBe("blob:legacy");
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://site.test/documents/file?legacyUser=user_1&index=2",
      expect.anything()
    );
  });

  it("clears the preview when the target goes away", async () => {
    const { result, rerender } = renderHook(
      ({ on }: { on: boolean }) =>
        useProtectedDocument(
          on ? { kind: "legacy", userId: "user_1", index: 0 } : undefined
        ),
      { initialProps: { on: true } }
    );
    await waitFor(() => {
      expect(result.current.src).toBe("blob:legacy");
    });
    rerender({ on: false });
    await waitFor(() => {
      expect(result.current).toEqual({ isPdf: false, loading: false });
    });
  });
});
