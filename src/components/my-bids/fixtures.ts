import type { Id } from "convex/_generated/dataModel";

import type { MyBidRow, WatchedLot, WonLotRow } from "./types";

const HOUR = 3_600_000;
const MIN = 60_000;

/**
 * Makes a typed lot id for a fixture.
 *
 * @param name - A readable name
 * @returns An id that is only valid in fixtures
 */
export function fixtureLotId(name: string): Id<"lots"> {
  return `lot_${name}` as Id<"lots">;
}

/**
 * A Bidding or Lost row with the mockup's defaults (New Holland T6070, the
 * buyer outbid at R 414 000, closing in 2h 30m). Pass overrides for the state.
 *
 * @param now - The clock the times are relative to (ms)
 * @param overrides - Fields to replace
 * @returns The row
 */
export function makeBidRow(
  now: number,
  overrides: Partial<MyBidRow> = {}
): MyBidRow {
  return {
    _id: fixtureLotId("t6070"),
    _creationTime: now - 10 * 24 * HOUR,
    title: "New Holland T6070",
    make: "New Holland",
    model: "T6070",
    year: 2016,
    operatingHours: 4850,
    location: "Malmesbury",
    categoryName: "Tractors",
    reserveState: "applies",
    isSeller: false,
    isWinner: false,
    startingPrice: 300_000,
    currentPrice: 417_500,
    minIncrement: 3500,
    status: "assigned",
    categoryId: undefined,
    durationDays: undefined,
    considerationDeadline: undefined,
    auctionId: undefined,
    province: undefined,
    extendedEndTime: undefined,
    description: undefined,
    conditionReportUrl: undefined,
    isExtended: undefined,
    seedId: undefined,
    conditionChecklist: undefined,
    lotNumber: 3,
    auctionStartTime: now - 2 * 24 * HOUR,
    auctionEndTime: now + 2 * HOUR + 30 * MIN,
    auctionStatus: "published",
    images: {
      front: undefined,
      engine: undefined,
      cabin: undefined,
      rear: undefined,
      additional: [],
    },
    myHighestBid: 414_000,
    isWinning: false,
    isLeadingConsideration: false,
    nextMinBid: 421_000,
    sellerVatKind: "vat",
    buyerPremiumFraction: 0.12,
    buyerFixedFees: 0,
    ...overrides,
  };
}

/**
 * A won lot with its payment, the mockup's JCB 3CX (bid R 92 000, premium
 * R 11 040, VAT R 15 456, total R 118 496, deposit R 5 000, to pay R 113 496).
 *
 * @param now - The clock the times are relative to (ms)
 * @param overrides - Fields to replace
 * @returns The row
 */
export function makeWonRow(
  now: number,
  overrides: Partial<WonLotRow> = {}
): WonLotRow {
  return {
    lotId: fixtureLotId("jcb3cx"),
    title: "JCB 3CX 4x4 TLB",
    province: undefined,
    imageUrl: undefined,
    auctionTitle: undefined,
    paidClaimedAt: undefined,
    confirmedAt: undefined,
    collectBy: undefined,
    year: 1998,
    location: "Mthatha",
    lotNumber: 1,
    closedAt: now - 20 * HOUR,
    paymentId: "payment_1" as Id<"lotPayments">,
    reference: "AB-1042",
    bid: 92_000,
    premium: 11_040,
    vat: 15_456,
    total: 118_496,
    depositCredit: 5000,
    amountDue: 113_496,
    vatKind: "vat",
    status: "awaiting",
    payBy: now + 26 * HOUR,
    createdAt: now - 20 * HOUR,
    ...overrides,
  };
}

/**
 * A watched lot, open with no bids (John Deere 8370RT).
 *
 * @param now - The clock the times are relative to (ms)
 * @param overrides - Fields to replace
 * @returns The lot
 */
export function makeWatchedLot(
  now: number,
  overrides: Partial<WatchedLot> = {}
): WatchedLot {
  return makeBidRow(now, {
    _id: fixtureLotId("jd8370"),
    title: "John Deere 8370RT",
    make: "John Deere",
    model: "8370RT",
    year: 2016,
    operatingHours: 0,
    location: "Wolmaransstad",
    startingPrice: 2_000_000,
    currentPrice: 2_000_000,
    lotNumber: 1,
    ...overrides,
  });
}
