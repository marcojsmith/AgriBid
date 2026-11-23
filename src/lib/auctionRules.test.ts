import { describe, it, expect } from "vitest";

import { SOFT_CLOSE_THRESHOLD_MS } from "../../convex/constants";
import {
  COLLECTION_WINDOW_DAYS,
  PAYMENT_WINDOW_HOURS,
  SOFT_CLOSE_MINUTES,
  softCloseRule,
} from "./auctionRules";

describe("auctionRules", () => {
  it("derives the soft-close minutes from the backend constant", () => {
    expect(SOFT_CLOSE_MINUTES * 60_000).toBe(SOFT_CLOSE_THRESHOLD_MS);
    expect(SOFT_CLOSE_MINUTES).toBe(2);
  });

  it("words the soft-close rule from that constant", () => {
    expect(softCloseRule()).toBe("Bids in the last 2 minutes add 2 minutes");
  });

  it("states the payment and collection windows", () => {
    expect(PAYMENT_WINDOW_HOURS).toBe(48);
    expect(COLLECTION_WINDOW_DAYS).toBe(7);
  });
});
