import { describe, expect, it } from "vitest";

import {
  accountBanner,
  watchedAlertsAny,
  alertsOnCount,
  notificationsSummary,
  canAskRefund,
  creditedLotLabel,
  depositDated,
  depositSummary,
  depositView,
  detailsEditable,
  hasListings,
  idEndsIn,
  listingsSummary,
  refundWithin,
  registrationSummary,
  replacePath,
  sellerDetailsSummary,
} from "./account";
import {
  makeDetails,
  makeDoc,
  makeRegistration,
} from "../pages/register/testing";
import type { Registration } from "./registrationCopy";

const NOW = Date.UTC(2026, 10, 25, 6, 30);

/**
 * Turns non-breaking spaces (used by the Rand formatter) into plain ones.
 *
 * @param text - The text
 * @returns The text with plain spaces
 */
function plain(text: string): string {
  return text.replace(/\s/g, " ");
}

/**
 * Builds a registration with overrides.
 *
 * @param over - Fields to override
 * @returns A registration
 */
function reg(over: Parameters<typeof makeRegistration>[0] = {}): Registration {
  return makeRegistration({
    eligibility: { kind: "ok" },
    details: makeDetails({ idType: "sa_id", fullName: "Thandi Naidoo" }),
    documents: [],
    deposit: null,
    depositSettings: { enabled: true, amount: 5000, refundDays: 3 },
    ...over,
  });
}

const received = {
  reference: "AB-1",
  status: "received" as const,
  amount: 5000,
  receivedAt: NOW,
  refundRequestedAt: undefined,
  refundedAt: undefined,
  refundableAmount: 5000,
};

describe("listings", () => {
  it("detects whether the user ever listed", () => {
    expect(hasListings(undefined)).toBe(false);
    expect(hasListings({ all: 0, active: 0, sold: 0 })).toBe(false);
    expect(hasListings({ all: 3, active: 2, sold: 1 })).toBe(true);
  });

  it("summarises live and sold", () => {
    expect(listingsSummary({ all: 3, active: 2, sold: 1 })).toBe(
      "2 live · 1 sold"
    );
    expect(listingsSummary({ all: 1, active: 0, sold: 1 })).toBe("1 sold");
    expect(listingsSummary({ all: 1, active: 0, sold: 0 })).toBe(
      "No live lots"
    );
  });
});

describe("sellerDetailsSummary", () => {
  it("joins the company and VAT status", () => {
    expect(
      sellerDetailsSummary({
        companyName: " Naidoo Landbou ",
        vatRegistered: true,
      })
    ).toBe("Naidoo Landbou · VAT registered");
    expect(sellerDetailsSummary({ companyName: "Naidoo" })).toBe("Naidoo");
    expect(sellerDetailsSummary({})).toBe("Add your seller details");
  });
});

describe("registrationSummary", () => {
  it.each([
    [{ kind: "ok" as const }, "You can bid"],
    [
      { kind: "incomplete" as const, step: 2 as const, totalSteps: 4 as const },
      "Step 2 of 4",
    ],
    [{ kind: "under_review" as const, depositReceived: false }, "Under review"],
    [
      { kind: "needs_replacing" as const, count: 1 },
      "One document needs replacing",
    ],
    [
      { kind: "needs_replacing" as const, count: 2 },
      "2 documents need replacing",
    ],
    [
      { kind: "deposit_due" as const, amount: 5000 },
      "Pay your R 5 000 deposit",
    ],
    [{ kind: "refund_requested" as const }, "Deposit refund requested"],
  ])("%j", (eligibility, text) => {
    expect(plain(registrationSummary(eligibility))).toBe(plain(text));
  });
});

describe("deposit", () => {
  const lot = { title: "JCB 3CX", lotNumber: 1 };

  it("labels the credited lot", () => {
    expect(creditedLotLabel(lot)).toBe("Lot 1 JCB 3CX");
    expect(creditedLotLabel({ title: "JCB" })).toBe("JCB");
  });

  it("maps every status to a view and a row", () => {
    expect(
      depositView(
        reg({ depositSettings: { enabled: false, amount: 0, refundDays: 3 } })
      )
    ).toEqual({ kind: "off" });
    expect(depositSummary({ kind: "off" })).toBeNull();
    const none = depositView(reg());
    expect(none).toEqual({ kind: "not_started", amount: 5000 });
    expect(depositSummary(none)).toContain("Not paid yet");
    const status = (
      s: "awaiting" | "paid_claimed" | "refund_requested" | "refunded"
    ) => depositView(reg({ deposit: { ...received, status: s } }));
    expect(status("awaiting").kind).toBe("awaiting");
    expect(depositSummary(status("awaiting"))).toContain("Not paid yet");
    expect(depositSummary(status("paid_claimed"))).toContain("checking");
    expect(depositSummary(status("refund_requested"))).toContain(
      "Refund requested"
    );
    expect(depositSummary(status("refunded"))).toContain("Refunded");
    const got = depositView(reg({ deposit: received }));
    expect(depositSummary(got)).toContain("received");
    const credited = depositView(reg({ deposit: received }), lot);
    expect(depositSummary(credited)).toContain("Credited to Lot 1 JCB 3CX");
  });

  it("shows the refund button only when allowed", () => {
    const got = depositView(reg({ deposit: received }));
    expect(canAskRefund(got, 5000, 0)).toBe(true);
    expect(canAskRefund(got, 0, 0)).toBe(false);
    expect(canAskRefund(got, 5000, 1)).toBe(false);
    expect(canAskRefund({ kind: "refunded", amount: 5000 }, 5000, 0)).toBe(
      false
    );
  });

  it("words the dated line and the refund window", () => {
    expect(plain(depositDated("received", 5000, undefined))).toBe(
      "R 5 000 received"
    );
    expect(depositDated("refunded", 5000, NOW)).toContain("refunded");
    expect(refundWithin(3)).toBe("Refunded within 3 working days.");
    expect(refundWithin(1)).toBe("Refunded within 1 working day.");
  });
});

describe("accountBanner", () => {
  const summary = {
    awaitingCount: 1,
    claimedCount: 0,
    nextPayBy: NOW + 86_400_000,
    nextAmountDue: 113_496,
  };
  const rejected = reg({
    eligibility: { kind: "needs_replacing", count: 1 },
    documents: [makeDoc("id_front", "rejected")],
  });

  it("puts a payment first", () => {
    const banner = accountBanner({ summary, registration: rejected, now: NOW });
    expect(banner?.label).toBe("Pay now");
    expect(banner?.to).toBe("/dashboard/bids?tab=won");
    expect(banner?.text).toContain("Pay");
  });

  it("falls back to registration actions", () => {
    const quiet = { ...summary, awaitingCount: 0 };
    const replace = accountBanner({
      summary: quiet,
      registration: rejected,
      now: NOW,
    });
    expect(replace?.label).toBe("Replace document");
    expect(replace?.to).toBe("/register/id?callbackUrl=%2Faccount&replace=1");
    expect(
      accountBanner({
        summary: undefined,
        registration: reg({
          eligibility: { kind: "incomplete", step: 1, totalSteps: 4 },
        }),
        now: NOW,
      })?.label
    ).toBe("Continue registration");
    expect(
      accountBanner({
        summary: undefined,
        registration: reg({
          eligibility: { kind: "deposit_due", amount: 5000 },
        }),
        now: NOW,
      })?.to
    ).toBe("/register/deposit?callbackUrl=%2Faccount");
  });

  it("is empty when all is well or nothing has loaded", () => {
    expect(
      accountBanner({ summary: undefined, registration: reg(), now: NOW })
    ).toBeNull();
    expect(
      accountBanner({ summary: undefined, registration: null, now: NOW })
    ).toBeNull();
    expect(
      accountBanner({
        summary: { ...summary, nextPayBy: null },
        registration: undefined,
        now: NOW,
      })
    ).toBeNull();
    expect(
      accountBanner({
        summary: undefined,
        registration: reg({
          eligibility: { kind: "under_review", depositReceived: false },
        }),
        now: NOW,
      })
    ).toBeNull();
  });

  it("replacePath falls back to the status page without a rejected document", () => {
    expect(replacePath(reg())).toBeNull();
    expect(
      accountBanner({
        summary: undefined,
        registration: reg({
          eligibility: { kind: "needs_replacing", count: 1 },
        }),
        now: NOW,
      })?.to
    ).toBe("/register/status");
  });
});

describe("details", () => {
  it("is editable only while registration is unfinished", () => {
    expect(
      detailsEditable({ kind: "incomplete", step: 1, totalSteps: 4 })
    ).toBe(true);
    expect(detailsEditable({ kind: "ok" })).toBe(false);
    expect(detailsEditable(undefined)).toBe(false);
  });

  it("words the ID line", () => {
    expect(idEndsIn("084")).toBe("Ends in 084");
    expect(idEndsIn(undefined)).toBe("Not added");
  });
});

describe("notifications", () => {
  it("counts switches that are on (unset is on)", () => {
    expect(alertsOnCount(null)).toBe(3);
    expect(alertsOnCount({ notificationsLotsWon: false })).toBe(2);
    expect(
      alertsOnCount({
        notificationsWatchedLots: false,
        notificationsLotsWon: false,
        notificationsSalesOpening: false,
      })
    ).toBe(0);
  });

  it("keeps the switch on while either watched-lot alert still gets through", () => {
    expect(watchedAlertsAny(null)).toBe(true);
    expect(watchedAlertsAny({ notificationsWatchedLots: false })).toBe(false);
    expect(watchedAlertsAny({ notificationsBidOutbid: false })).toBe(true);
    expect(
      watchedAlertsAny({
        notificationsBidOutbid: false,
        notificationsWatchlistEnding: "24h",
      })
    ).toBe(false);
    expect(watchedAlertsAny({ notificationsWatchlistEnding: "24h" })).toBe(
      true
    );
    expect(watchedAlertsAny({ notificationsWatchlistEnding: "1h" })).toBe(true);
    expect(alertsOnCount({ notificationsBidOutbid: false })).toBe(3);
  });

  it("words every state", () => {
    expect(notificationsSummary("on", null)).toBe("On · 3 alerts");
    expect(
      notificationsSummary("on", {
        notificationsLotsWon: false,
        notificationsSalesOpening: false,
      })
    ).toBe("On · 1 alert");
    expect(notificationsSummary("loading", null)).toBe("Checking…");
    expect(notificationsSummary("off", null)).toBe("Off");
    expect(notificationsSummary("blocked", null)).toContain("Blocked");
    expect(notificationsSummary("install", null)).toContain("Home Screen");
    expect(notificationsSummary("unsupported", null)).toContain(
      "Not available"
    );
  });
});
