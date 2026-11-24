import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRegistrationUpload } from "./useRegistrationUpload";

const getToken = vi.fn();

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ getToken }),
}));

const fetchMock = vi.fn();

/**
 * Builds a File of a given type and size.
 *
 * @param name - File name
 * @param type - MIME type
 * @param size - Size in bytes
 * @returns The file
 */
function file(name: string, type: string, size = 100): File {
  return new File([new Uint8Array(size)], name, { type });
}

/**
 * Builds a fetch response.
 *
 * @param status - HTTP status
 * @param body - JSON body
 * @returns The response
 */
function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("useRegistrationUpload", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    getToken.mockReset().mockResolvedValue("clerk-token");
    vi.stubEnv("VITE_CONVEX_SITE_URL", "https://site.test/");
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("posts the raw file with the bearer token to the upload route", async () => {
    fetchMock.mockResolvedValue(reply(200, { documentId: "d1" }));
    const { result } = renderHook(() => useRegistrationUpload());
    const photo = file("front card.jpg", "image/jpeg");

    let ok = false;
    await act(async () => {
      ok = await result.current.upload("id_front", photo);
    });

    expect(ok).toBe(true);
    expect(getToken).toHaveBeenCalledWith({ template: "convex" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://site.test/documents/upload?kind=id_front&fileName=front+card.jpg",
      {
        method: "POST",
        headers: { Authorization: "Bearer clerk-token" },
        body: photo,
      }
    );
    expect(result.current.uploadingKind).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("reports which slot is uploading", async () => {
    let finish: (value: Response) => void = () => undefined;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        finish = resolve;
      })
    );
    const { result } = renderHook(() => useRegistrationUpload());

    let pending: Promise<boolean> = Promise.resolve(false);
    await act(async () => {
      pending = result.current.upload(
        "proof_of_address",
        file("a.pdf", "application/pdf")
      );
      await Promise.resolve();
    });
    expect(result.current.uploadingKind).toBe("proof_of_address");

    await act(async () => {
      finish(reply(200, { documentId: "d2" }));
      await pending;
    });
    expect(result.current.uploadingKind).toBeNull();
  });

  it("rejects an unsupported file type before uploading", async () => {
    const { result } = renderHook(() => useRegistrationUpload());
    let ok = true;
    await act(async () => {
      ok = await result.current.upload(
        "id_back",
        file("x.svg", "image/svg+xml")
      );
    });
    expect(ok).toBe(false);
    expect(result.current.error).toEqual({
      kind: "id_back",
      message: "Upload a photo (JPG, PNG) or a PDF.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a file over 10 MB before uploading", async () => {
    const { result } = renderHook(() => useRegistrationUpload());
    await act(async () => {
      await result.current.upload(
        "id_back",
        file("big.jpg", "image/jpeg", 10_485_761)
      );
    });
    expect(result.current.error?.message).toBe(
      "That file is too large. The limit is 10 MB."
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the server's message when it refuses the file, then clears it on retry", async () => {
    fetchMock.mockResolvedValueOnce(
      reply(400, { error: "That document isn't needed for your ID type." })
    );
    const { result } = renderHook(() => useRegistrationUpload());

    await act(async () => {
      await result.current.upload("id_front", file("a.jpg", "image/jpeg"));
    });
    expect(result.current.error?.message).toBe(
      "That document isn't needed for your ID type."
    );

    fetchMock.mockResolvedValueOnce(reply(200, { documentId: "d1" }));
    await act(async () => {
      await result.current.upload("id_front", file("a.jpg", "image/jpeg"));
    });
    expect(result.current.error).toBeNull();
  });

  it("falls back to a generic message when the error body is not JSON", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 502 }));
    const { result } = renderHook(() => useRegistrationUpload());
    let ok = true;
    await act(async () => {
      ok = await result.current.upload("id_front", file("a.jpg", "image/jpeg"));
    });
    expect(ok).toBe(false);
    expect(result.current.error).toEqual({
      kind: "id_front",
      message: "Upload failed",
    });
    expect(result.current.uploadingKind).toBeNull();
  });

  it("fails without a token and never calls the server", async () => {
    getToken.mockResolvedValue(null);
    const { result } = renderHook(() => useRegistrationUpload());
    let ok = true;
    await act(async () => {
      ok = await result.current.upload("id_front", file("a.jpg", "image/jpeg"));
    });
    expect(ok).toBe(false);
    expect(result.current.error?.message).toBe(
      "Sign in again to upload documents."
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("Failed to fetch"));
    const { result } = renderHook(() => useRegistrationUpload());
    await act(async () => {
      await result.current.upload("id_front", file("a.jpg", "image/jpeg"));
    });
    expect(result.current.error?.message).toBe("Failed to fetch");
  });
});
