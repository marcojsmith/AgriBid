import { describe, expect, it } from "vitest";

import {
  MY_BIDS_TABS,
  bidRowBadge,
  defaultTab,
  formatShortDay,
  lotMeta,
  panelId,
  paymentBanner,
  parseTab,
  registrationBanner,
  rowClosesAt,
  spokenRemaining,
  tabCount,
  tabId,
  tabLabel,
  watchedCardState,
} from "./myBids";

/**
 * `formatRand` uses no-break spaces; tests compare with plain ones.
 *
 * @param text - Text from the UI
 * @returns The text with plain spaces
 */
const plain = (text: string | undefined) => text?.replaceAll(" ", " ");

const NOW = Date.UTC(2026, 10, 25, 6, 30); // Wed 25 Nov 2026, 08:30 SAST
const HOUR = 3_600_000;

describe("parseTab", () => {
  it("accepts the four tabs", () => {
    expect(parseTab("bidding")).toBe("bidding");
    expect(parseTab("won")).toBe("won");
    expect(parseTab("lost")).toBe("lost");
    expect(parseTab("watching")).toBe("watching");
  });

  it("returns null for anything else", () => {
    expect(parseTab(null)).toBeNull();
    expect(parseTab("")).toBeNull();
    expect(parseTab("Won")).toBeNull();
    expect(parseTab("settings")).toBeNull();
  });
});

describe("defaultTab", () => {
  it("opens Bidding when there are lots to bid on", () => {
    expect(defaultTab({ biddingCount: 2, awaitingPayment: true })).toBe(
      "bidding"
    );
  });

  it("opens Won when Bidding is empty and a lot awaits payment", () => {
    expect(defaultTab({ biddingCount: 0, awaitingPayment: true })).toBe("won");
  });

  it("stays on Bidding when nothing awaits payment", () => {
    expect(defaultTab({ biddingCount: 0, awaitingPayment: false })).toBe(
      "bidding"
    );
  });
});

describe("bidRowBadge", () => {
  const base = {
    status: "assigned",
    isWinning: false,
    isLeadingConsideration: false,
  };

  it("shows Outbid when the buyer does not lead", () => {
    expect(bidRowBadge(base, NOW)).toBe("outbid");
  });

  it("shows Leading when the buyer leads", () => {
    expect(bidRowBadge({ ...base, isWinning: true }, NOW)).toBe("leading");
  });

  it("shows Extended while the soft close is running", () => {
    expect(
      bidRowBadge(
        { ...base, isExtended: true, extendedEndTime: NOW + 60_000 },
        NOW
      )
    ).toBe("extended");
  });

  it("ignores an extension that has passed", () => {
    expect(
      bidRowBadge({ ...base, isExtended: true, extendedEndTime: NOW - 1 }, NOW)
    ).toBe("outbid");
  });

  it("shows the consideration pill for a lot with the seller", () => {
    expect(bidRowBadge({ ...base, status: "under_consideration" }, NOW)).toBe(
      "consideration"
    );
  });
});

describe("registrationBanner", () => {
  it("is null when the buyer can bid", () => {
    expect(registrationBanner({ kind: "ok" })).toBeNull();
  });

  it("asks an unfinished buyer to continue", () => {
    expect(
      registrationBanner({ kind: "incomplete", step: 2, totalSteps: 4 })
    ).toEqual({
      kind: "warn",
      text: "Finish registration to bid. Step 2 of 4.",
      label: "Continue registration",
      to: "/register",
      variant: "default",
    });
  });

  it("says documents are under review", () => {
    expect(
      registrationBanner({ kind: "under_review", depositReceived: false })
    ).toMatchObject({
      kind: "info",
      text: "Documents under review. We check them within 2 business days.",
      to: "/register/status",
      variant: "outline",
    });
  });

  it("counts documents that need replacing", () => {
    expect(
      registrationBanner({ kind: "needs_replacing", count: 1 })?.text
    ).toBe("One document needs replacing.");
    expect(
      registrationBanner({ kind: "needs_replacing", count: 2 })?.text
    ).toBe("2 documents need replacing.");
  });

  it("names the deposit amount", () => {
    expect(
      registrationBanner({ kind: "deposit_due", amount: 5000 })
    ).toMatchObject({ kind: "warn", label: "Pay deposit" });
    expect(
      plain(registrationBanner({ kind: "deposit_due", amount: 5000 })?.text)
    ).toBe("Pay your R 5 000 deposit to bid.");
  });

  it("handles a requested refund", () => {
    expect(registrationBanner({ kind: "refund_requested" })).toMatchObject({
      kind: "info",
      label: "Manage deposit",
    });
  });
});

describe("paymentBanner", () => {
  const awaiting = {
    status: "awaiting" as const,
    amountDue: 113_496,
    payBy: Date.UTC(2026, 10, 26, 9, 0),
  };

  it("asks for the one unpaid lot", () => {
    const banner = paymentBanner([awaiting], NOW);
    expect(banner?.kind).toBe("warn");
    expect(plain(banner?.text)).toBe("Pay R 113 496 by Thu 26 Nov, 11:00");
  });

  it("counts several unpaid lots and names the first deadline", () => {
    const later = { ...awaiting, payBy: awaiting.payBy + 24 * HOUR };
    expect(paymentBanner([later, awaiting], NOW)).toEqual({
      kind: "warn",
      text: "2 lots to pay. First due Thu 26 Nov, 11:00",
    });
  });

  it("says a claimed payment is being checked", () => {
    expect(
      paymentBanner([{ ...awaiting, status: "paid_claimed" }], NOW)
    ).toEqual({ kind: "info", text: "We're checking your payment." });
  });

  it("gives the collection date of a confirmed payment", () => {
    expect(
      paymentBanner(
        [
          {
            ...awaiting,
            status: "confirmed",
            collectBy: Date.UTC(2026, 11, 1, 9, 0),
          },
        ],
        NOW
      )
    ).toEqual({
      kind: "ok",
      text: "Payment received. Collect by Tue 1 Dec.",
    });
  });

  it("says nothing once the collection date has passed or there are no rows", () => {
    expect(paymentBanner([], NOW)).toBeNull();
    expect(
      paymentBanner(
        [{ ...awaiting, status: "confirmed", collectBy: NOW - HOUR }],
        NOW
      )
    ).toBeNull();
    expect(
      paymentBanner([{ ...awaiting, status: "confirmed" }], NOW)
    ).toBeNull();
  });
});

describe("formatShortDay", () => {
  it("formats in South African time without a time of day", () => {
    expect(formatShortDay(Date.UTC(2026, 10, 24, 22, 30))).toBe("Wed 25 Nov");
  });
});

describe("spokenRemaining", () => {
  it("says the two largest units in words", () => {
    expect(spokenRemaining(2 * HOUR + 30 * 60_000)).toBe("2 hours 30 minutes");
    expect(spokenRemaining(112_000)).toBe("1 minute 52 seconds");
    expect(spokenRemaining(3 * 24 * HOUR + HOUR)).toBe("3 days 1 hour");
    expect(spokenRemaining(500)).toBe("0 seconds");
  });
});

describe("tab helpers", () => {
  const counts = { bidding: 5, won: 1, lost: 2, watching: 4 };

  it("names tabs, panels, labels and counts", () => {
    expect(tabId("won")).toBe("my-bids-tab-won");
    expect(panelId("won")).toBe("my-bids-panel-won");
    expect(MY_BIDS_TABS.map((tab) => tabLabel(tab))).toEqual([
      "Bidding",
      "Won",
      "Lost",
      "Watching",
    ]);
    expect(MY_BIDS_TABS.map((tab) => tabCount(counts, tab))).toEqual([
      5, 1, 2, 4,
    ]);
  });
});

describe("rowClosesAt", () => {
  it("prefers the soft-close extension", () => {
    expect(rowClosesAt({ extendedEndTime: 2, auctionEndTime: 1 })).toBe(2);
    expect(rowClosesAt({ auctionEndTime: 1 })).toBe(1);
    expect(rowClosesAt({})).toBeUndefined();
  });
});

describe("lotMeta", () => {
  it("joins what is known and drops zeros and blanks", () => {
    expect(
      lotMeta({
        _id: "a",
        title: "T",
        year: 2016,
        operatingHours: 4850,
        location: "Malmesbury",
      })
    ).toBe("2016 · 4 850 hrs · Malmesbury");
    expect(
      lotMeta({
        _id: "a",
        title: "T",
        year: 0,
        operatingHours: 0,
        location: " ",
      })
    ).toBe("");
  });
});

describe("watchedCardState", () => {
  const base = { currentPrice: 100, startingPrice: 100 };

  it("maps closed lots to their outcome", () => {
    expect(watchedCardState({ ...base, status: "sold" }).state).toBe("sold");
    expect(watchedCardState({ ...base, status: "unsold" }).state).toBe(
      "not-sold"
    );
    expect(
      watchedCardState({ ...base, status: "under_consideration" }).state
    ).toBe("under-consideration");
  });

  it("tells an opening price from a current bid", () => {
    expect(watchedCardState({ ...base, status: "assigned" })).toEqual({
      state: "open",
      price: 100,
    });
    expect(
      watchedCardState({ ...base, currentPrice: 150, status: "assigned" })
    ).toEqual({ state: "current-bid", price: 150 });
  });
});
