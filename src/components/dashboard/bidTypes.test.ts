import { describe, it, expect } from "vitest";
import type { Id } from "convex/_generated/dataModel";

import { AUCTION_STATUSES, isMyBidAuction, type MyBidRow } from "./bidTypes";

const makeRow = (status: string): MyBidRow =>
  ({
    _id: "lot1" as Id<"lots">,
    status,
  }) as MyBidRow;

describe("isMyBidAuction", () => {
  it.each(AUCTION_STATUSES)("accepts the %s status", (status) => {
    expect(isMyBidAuction(makeRow(status))).toBe(true);
  });

  it("rejects an unknown status", () => {
    expect(isMyBidAuction(makeRow("archived"))).toBe(false);
  });

  it("exposes every known status", () => {
    expect(AUCTION_STATUSES).toEqual([
      "draft",
      "pending_review",
      "approved",
      "assigned",
      "sold",
      "unsold",
      "rejected",
    ]);
  });
});
