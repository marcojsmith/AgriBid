import { describe, it, expect } from "vitest";

import { formatRand } from "@/lib/currency";

import { getLotCta } from "./lotCta";

const base = { signedIn: true, isVerified: true, nextBid: 217_500 };

describe("getLotCta", () => {
  it("asks a guest to register before the start", () => {
    expect(getLotCta({ ...base, phase: "upcoming", signedIn: false })).toEqual({
      kind: "register",
      label: "Register to bid",
    });
  });

  it("lets a verified user set a max bid before the start", () => {
    expect(getLotCta({ ...base, phase: "upcoming" })).toEqual({
      kind: "set-max",
      label: "Set max bid",
    });
  });

  it("treats an unknown verification state like a verified user", () => {
    expect(
      getLotCta({ ...base, phase: "upcoming", isVerified: undefined }).kind
    ).toBe("set-max");
  });

  it("asks a signed-in unverified user to verify, before and during the sale", () => {
    expect(
      getLotCta({ ...base, phase: "upcoming", isVerified: false })
    ).toEqual({ kind: "verify", label: "Verify to bid" });
    expect(getLotCta({ ...base, phase: "live", isVerified: false }).kind).toBe(
      "verify"
    );
  });

  it("shows the next bid once live, for guests and verified users", () => {
    const live = { kind: "bid", label: `Bid ${formatRand(217_500)}` };
    expect(getLotCta({ ...base, phase: "live" })).toEqual(live);
    expect(getLotCta({ ...base, phase: "live", signedIn: false })).toEqual(
      live
    );
  });

  it("shows the result for an ended lot whoever is looking", () => {
    for (const signedIn of [true, false]) {
      expect(getLotCta({ ...base, phase: "ended", signedIn })).toEqual({
        kind: "result",
        label: "View result",
      });
    }
  });

  it("falls back to View lot when the lot is not open to bidding", () => {
    expect(getLotCta({ ...base, phase: "unavailable" })).toEqual({
      kind: "view",
      label: "View lot",
    });
  });
});
