import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { makeDoc } from "@/pages/register/testing";

import { useDocumentPreview } from "./useDocumentPreview";

describe("useDocumentPreview", () => {
  it("returns nothing for an empty slot", () => {
    const { result } = renderHook(() => useDocumentPreview(undefined));
    expect(result.current).toEqual({ isPdf: false });
  });

  it("uses the stored URL for an image", () => {
    const { result } = renderHook(() =>
      useDocumentPreview(makeDoc("id_front"))
    );
    expect(result.current).toEqual({
      src: "https://files.test/id_front",
      isPdf: false,
    });
  });

  it("flags a PDF and gives no image source", () => {
    const { result } = renderHook(() =>
      useDocumentPreview(
        makeDoc("proof_of_address", "pending", { fileName: "bill.PDF" })
      )
    );
    expect(result.current).toEqual({ isPdf: true });
  });

  it("gives no source when the URL is missing", () => {
    const { result } = renderHook(() =>
      useDocumentPreview(makeDoc("id_back", "pending", { url: null }))
    );
    expect(result.current).toEqual({ src: undefined, isPdf: false });
  });
});
