import { describe, it, expect } from "vitest";

import { resolveSellerVatKind } from "./sellerVat";

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
