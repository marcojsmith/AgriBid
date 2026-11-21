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

  it("lets a verified user watch the lot before the start", () => {
    expect(getLotCta({ ...base, phase: "upcoming" })).toEqual({
      kind: "watch",
      label: "Watch lot",
    });
    expect(getLotCta({ ...base, phase: "upcoming", isWatched: true })).toEqual({
      kind: "watch",
      label: "Watching",
    });
  });

  it("treats an unknown verification state like a verified user", () => {
    expect(
      getLotCta({ ...base, phase: "upcoming", isVerified: undefined }).kind
    ).toBe("watch");
  });

  it("shows View lot on the user's own lot, before and during the sale", () => {
    for (const phase of ["upcoming", "live"] as const) {
      expect(getLotCta({ ...base, phase, isOwnLot: true })).toEqual({
        kind: "view",
        label: "View lot",
      });
    }
  });

  it("still shows the result on the user's own ended lot", () => {
    expect(getLotCta({ ...base, phase: "ended", isOwnLot: true }).kind).toBe(
      "result"
    );
  });

  it("only offers Bid where the backend accepts a bid", () => {
    // Mirrors placeBid: the sale must have started and the bidder must not be
    // the seller. A guest's click goes to sign-in, never to a rejected bid.
    const phases = ["upcoming", "live", "ended", "unavailable"] as const;
    for (const phase of phases) {
      for (const signedIn of [true, false]) {
        for (const isVerified of [true, false, undefined]) {
          for (const isOwnLot of [true, false]) {
            const cta = getLotCta({
              ...base,
              phase,
              signedIn,
              isVerified,
              isOwnLot,
            });
            if (cta.kind === "bid") {
              expect(phase).toBe("live");
              expect(isOwnLot).toBe(false);
            }
          }
        }
      }
    }
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
