import { act, renderHook } from "@testing-library/react";
import { api } from "convex/_generated/api";
import { ConvexError } from "convex/values";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mutationMock, resetConvexState } from "@/pages/register/testing";

import { useRegistrationUpload } from "./useRegistrationUpload";

vi.mock("convex/react", async () => {
  const t = await import("@/pages/register/testing");
  return { useMutation: t.mockUseMutation };
});

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

describe("useRegistrationUpload", () => {
  beforeEach(() => {
    resetConvexState();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mutationMock(api.registration.generateDocumentUploadUrl).mockResolvedValue(
      "https://upload.test/u1"
    );
    mutationMock(api.registration.attachMyDocument).mockResolvedValue({
      documentId: "d1",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("gets a URL, posts the file and attaches it", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ storageId: "s1" }),
    });
    const { result } = renderHook(() => useRegistrationUpload());
    const photo = file("front.jpg", "image/jpeg");

    let ok = false;
    await act(async () => {
      ok = await result.current.upload("id_front", photo);
    });

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("https://upload.test/u1", {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: photo,
    });
    expect(
      mutationMock(api.registration.attachMyDocument)
    ).toHaveBeenCalledWith({
      kind: "id_front",
      storageId: "s1",
      fileName: "front.jpg",
    });
    expect(result.current.uploadingKind).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("reports which slot is uploading", async () => {
    let finish: (value: unknown) => void = () => undefined;
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
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
      finish({ ok: true, json: () => Promise.resolve({ storageId: "s2" }) });
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

  it("reports a failed POST", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    const { result } = renderHook(() => useRegistrationUpload());
    let ok = true;
    await act(async () => {
      ok = await result.current.upload("id_front", file("a.jpg", "image/jpeg"));
    });
    expect(ok).toBe(false);
    expect(result.current.error?.kind).toBe("id_front");
    expect(
      mutationMock(api.registration.attachMyDocument)
    ).not.toHaveBeenCalled();
    expect(result.current.uploadingKind).toBeNull();
  });

  it("shows the server's message when attaching fails, then clears it on retry", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ storageId: "s1" }),
    });
    const attach = mutationMock(api.registration.attachMyDocument);
    attach.mockRejectedValueOnce(
      new ConvexError("That upload has expired. Please upload it again.")
    );
    const { result } = renderHook(() => useRegistrationUpload());

    await act(async () => {
      await result.current.upload("id_front", file("a.jpg", "image/jpeg"));
    });
    expect(result.current.error?.message).toBe(
      "That upload has expired. Please upload it again."
    );

    await act(async () => {
      await result.current.upload("id_front", file("a.jpg", "image/jpeg"));
    });
    expect(result.current.error).toBeNull();
  });
});
