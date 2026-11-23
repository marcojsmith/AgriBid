import { describe, it, expect } from "vitest";

import { resolveLotSellerVat, resolveSellerVatKind } from "./sellerVat";

describe("resolveSellerVatKind", () => {
  it("returns private only when explicitly not VAT-registered", () => {
    expect(resolveSellerVatKind({ vatRegistered: false })).toBe("private");
  });

  it("returns vat when registered", () => {
    expect(resolveSellerVatKind({ vatRegistered: true })).toBe("vat");
  });

  it("returns vat (worst case) when unset or the profile is missing", () => {
    expect(resolveSellerVatKind({})).toBe("vat");
    expect(resolveSellerVatKind(null)).toBe("vat");
    expect(resolveSellerVatKind(undefined)).toBe("vat");
  });
});

describe("resolveLotSellerVat", () => {
  const profile = { vatRegistered: false, sellerType: "dealer" as const };

  it("uses the lot snapshot over the live profile once assigned", () => {
    expect(
      resolveLotSellerVat(
        { sellerVatRegistered: true, sellerType: "private_farmer" },
        profile
      )
    ).toEqual({ vatKind: "vat", sellerType: "private_farmer" });
  });

  it("treats an assigned lot with an unknown snapshot as VAT, ignoring the profile", () => {
    expect(resolveLotSellerVat({ premiumSource: "auction" }, profile)).toEqual({
      vatKind: "vat",
      sellerType: undefined,
    });
  });

  it("falls back to the live profile for lots that were never assigned", () => {
    expect(resolveLotSellerVat({}, profile)).toEqual({
      vatKind: "private",
      sellerType: "dealer",
    });
  });

  it("is VAT with no type when never assigned and the profile is missing", () => {
    expect(resolveLotSellerVat({}, null)).toEqual({
      vatKind: "vat",
      sellerType: undefined,
    });
  });
});
