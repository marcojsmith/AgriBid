import { describe, expect, it } from "vitest";

import { MS_PER_DAY } from "../constants";
import { PROVINCE_LABELS } from "./provinces";
import {
  WBT_SEED_PREFIX,
  assignLotNumbers,
  auctionSeedId,
  buildLotInput,
  buildLocation,
  cleanSaleTitle,
  cleanTown,
  isEquipmentLot,
  lotSeedId,
  mapCategory,
  isDemoBidder,
  minIncrementFor,
  pickDemoPositions,
  planDemoBids,
  planLot,
  provinceForTown,
  saleWindow,
  selectSales,
  usablePhotos,
  sellerSays,
  settledAtFor,
  shiftTimestamp,
  type RawAuction,
  type RawData,
  type RawLot,
} from "./wbtImport";

/**
 * Builds a raw lot with sensible defaults.
 * @param overrides - Fields to override
 * @returns A raw lot
 */
function lot(overrides: Partial<RawLot> = {}): RawLot {
  return {
    lotNumber: 3,
    title: "Massey Ferguson 290",
    make: null,
    model: null,
    year: null,
    hours: null,
    category: null,
    town: null,
    province: null,
    price: 100000,
    description: null,
    photos: ["https://example.test/a.jpg"],
    sourceUrl: "https://auctions.webuytractors.shop/ui/auctions/1",
    bidwranglerItemId: 77,
    ...overrides,
  };
}

/**
 * Builds a raw auction.
 * @param id - Source id
 * @param status - Source status
 * @param end - ISO end date
 * @returns A raw auction
 */
function auction(id: number, status: string, end: string): RawAuction {
  return {
    name: `Sale ${id.toString()} Low Reserve Commercial and Agricultural Online Auction`,
    start: end,
    end,
    status,
    bidwranglerAuctionId: id,
    lots: [lot({ bidwranglerItemId: id * 10 })],
  };
}

describe("isEquipmentLot", () => {
  it("keeps real equipment", () => {
    expect(isEquipmentLot(lot())).toBe(true);
    expect(isEquipmentLot(lot({ title: "GPS" }))).toBe(true);
  });

  it("drops terms, viewing and notice lots", () => {
    expect(isEquipmentLot(lot({ title: "TERMS & CONDITIONS." }))).toBe(false);
    expect(isEquipmentLot(lot({ title: "VIEWING & FINANCING" }))).toBe(false);
    expect(isEquipmentLot(lot({ title: "Important notice to bidders" }))).toBe(
      false
    );
  });

  it("drops lots without a real title or without photos", () => {
    expect(isEquipmentLot(lot({ title: "  " }))).toBe(false);
    expect(isEquipmentLot(lot({ title: "??" }))).toBe(false);
    expect(isEquipmentLot(lot({ title: "--- ---" }))).toBe(false);
    expect(isEquipmentLot(lot({ photos: [] }))).toBe(false);
    expect(
      isEquipmentLot(lot({ photos: ["/images/missing-image-xl.png"] }))
    ).toBe(false);
  });
});

describe("mapCategory", () => {
  it("prefers title keywords over the unreliable source category", () => {
    expect(mapCategory("3 disc plough", "Tractors")).toBe("Tillage Equipment");
    expect(mapCategory("1.8m slasher new", null)).toBe("Hay & Forage");
    expect(mapCategory("Claas combine harvester", null)).toBe("Combine");
    expect(mapCategory("Boom sprayer 800l", null)).toBe("Sprayer");
    expect(mapCategory("Maize planter", null)).toBe("Planter/Seeder");
    expect(mapCategory("JCB TLB 3CX", null)).toBe("Construction");
    expect(mapCategory("Bell wheel loader", null)).toBe("Loader");
    expect(mapCategory("Manitou telehandler", null)).toBe("Telehandler");
    expect(mapCategory("Polaris quad", null)).toBe("Utility Vehicle");
    expect(mapCategory("Massey Ferguson 290", null)).toBe("Tractor");
  });

  it("falls back to the source category, then Other", () => {
    expect(mapCategory("Widget", "Tractors")).toBe("Tractor");
    expect(mapCategory("Widget", "Rotivater")).toBe("Tillage Equipment");
    expect(mapCategory("Widget", "Trailers")).toBe("Other");
    expect(mapCategory("Widget", null)).toBe("Other");
  });
});

describe("provinceForTown", () => {
  it("uses the scraped province first", () => {
    expect(provinceForTown("Pretoria", "Gauteng")).toBe("gauteng");
    expect(provinceForTown(null, "KwaZulu-Natal")).toBe("kwazulu_natal");
  });

  it("reads a province named in the text", () => {
    expect(provinceForTown("Nigel Gauteng", null)).toBe("gauteng");
    expect(provinceForTown("Villiers FS", null)).toBe("free_state");
    expect(provinceForTown("Trichardt MP", null)).toBe("mpumalanga");
    expect(provinceForTown("Shelly Beach KZN", null)).toBe("kwazulu_natal");
  });

  it("maps unambiguous towns", () => {
    expect(provinceForTown("Pretoria yard", null)).toBe("gauteng");
    expect(provinceForTown("Potch", null)).toBe("north_west");
    expect(provinceForTown("Meyerton area", null)).toBe("gauteng");
    expect(provinceForTown("Upington", null)).toBe("northern_cape");
  });

  it("leaves ambiguous or unknown towns unset", () => {
    expect(provinceForTown("Heidelberg", null)).toBeUndefined();
    expect(provinceForTown("Middelburg", null)).toBeUndefined();
    expect(provinceForTown("Richmond", null)).toBeUndefined();
    expect(provinceForTown("Nowhereville", null)).toBeUndefined();
    expect(provinceForTown(null, null)).toBeUndefined();
    expect(provinceForTown("Pretoria", "Atlantis")).toBe("gauteng");
  });
});

describe("cleanTown and buildLocation", () => {
  it("tidies free text", () => {
    expect(cleanTown("Pretoria yard")).toBe("Pretoria");
    expect(cleanTown("kempton park")).toBe("Kempton Park");
    expect(cleanTown("Moorreesburg. Western Cape")).toBe("Moorreesburg");
  });

  it("builds a location without inventing anything", () => {
    expect(buildLocation("Pretoria", "gauteng", PROVINCE_LABELS)).toBe(
      "Pretoria, Gauteng"
    );
    expect(buildLocation("Heidelberg", undefined, PROVINCE_LABELS)).toBe(
      "Heidelberg"
    );
    expect(buildLocation(null, "gauteng", PROVINCE_LABELS)).toBe("Gauteng");
    expect(buildLocation(null, undefined, PROVINCE_LABELS)).toBe(
      "South Africa"
    );
  });
});

describe("sellerSays", () => {
  it("prefixes real text and clips long text", () => {
    expect(sellerSays("good condition\r\n\n\n\npto works")).toBe(
      "Seller says: good condition\n\npto works"
    );
    expect(sellerSays("x".repeat(2000))?.endsWith("…")).toBe(true);
  });

  it("drops empty and boilerplate text", () => {
    expect(sellerSays(null)).toBeUndefined();
    expect(sellerSays("   ")).toBeUndefined();
    expect(
      sellerSays(
        "Condition description as from seller. Condition not guaranteed. Please view item"
      )
    ).toBeUndefined();
  });
});

describe("minIncrementFor", () => {
  it("follows the source ladder", () => {
    expect(minIncrementFor(5000)).toBe(500);
    expect(minIncrementFor(20000)).toBe(1000);
    expect(minIncrementFor(50000)).toBe(1500);
    expect(minIncrementFor(90000)).toBe(2000);
    expect(minIncrementFor(150000)).toBe(2500);
    expect(minIncrementFor(300000)).toBe(3500);
    expect(minIncrementFor(900000)).toBe(5000);
  });
});

describe("idempotency keys", () => {
  it("keys sales on the source id only", () => {
    expect(auctionSeedId("133268")).toBe("wbt:auction:133268");
    expect(auctionSeedId("133268").startsWith(WBT_SEED_PREFIX)).toBe(true);
  });

  it("keys auction lots on the item id, whatever the sale or number", () => {
    const a = lotSeedId(
      lot({ bidwranglerItemId: 5, lotNumber: 1 }),
      "wbt:auction:1"
    );
    const b = lotSeedId(
      lot({ bidwranglerItemId: 5, lotNumber: 9 }),
      "wbt:auction:2"
    );
    expect(a).toBe("wbt:lot:5");
    expect(b).toBe(a);
  });

  it("keys fixed-price listings on their page url", () => {
    const l = lot({
      bidwranglerItemId: undefined,
      sourceUrl: "https://www.webuytractors.shop/product-page/1-2m-slasher",
    });
    expect(lotSeedId(l, "wbt:auction:listings")).toBe(
      "wbt:lot:listings:product-page-1-2m-slasher"
    );
    const bare = lot({
      bidwranglerItemId: undefined,
      sourceUrl: "https://x.test/",
      title: "My Lot!",
    });
    expect(lotSeedId(bare, "wbt:auction:listings")).toBe(
      "wbt:lot:listings:my-lot-"
    );
  });
});

describe("selectSales", () => {
  const data: RawData = {
    auctions: [
      auction(1, "open", "2026-11-25T09:00:00.000Z"),
      auction(2, "closed", "2026-09-29T09:00:00.000Z"),
      auction(3, "closed", "2026-08-25T09:00:00.000Z"),
      auction(4, "closed", "2026-07-28T09:00:00.000Z"),
      auction(5, "closed", "2026-06-24T09:00:00.000Z"),
      auction(6, "closed", "2026-05-20T09:00:00.000Z"),
      auction(7, "closed", "2026-03-24T09:00:00.000Z"),
    ],
    unassignedListings: [lot({ bidwranglerItemId: undefined })],
  };

  it("picks the open sale, the listings and the 5 newest closed sales", () => {
    const sales = selectSales(data);
    expect(sales.map((s) => s.role)).toEqual([
      "live",
      "upcoming",
      "closed",
      "closed",
      "closed",
      "closed",
      "closed",
    ]);
    expect(
      sales.filter((s) => s.role === "closed").map((s) => s.seedId)
    ).toEqual([
      "wbt:auction:2",
      "wbt:auction:3",
      "wbt:auction:4",
      "wbt:auction:5",
      "wbt:auction:6",
    ]);
    expect(
      sales.filter((s) => s.role === "closed").map((s) => s.closedOrder)
    ).toEqual([1, 2, 3, 4, 5]);
    expect(sales[0].title).toBe("Sale 1 Auction");
  });

  it("copes with no open sale and no listings", () => {
    const sales = selectSales({
      auctions: [auction(2, "closed", "2026-09-29T09:00:00.000Z")],
      unassignedListings: [],
    });
    expect(sales.map((s) => s.role)).toEqual(["closed"]);
  });
});

describe("cleanSaleTitle", () => {
  it("shortens the source suffix", () => {
    expect(
      cleanSaleTitle(
        "20-25 November Year End 2026 Low Reserve Commercial and Agricultural Online Auction"
      )
    ).toBe("20-25 November Year End 2026 Auction");
  });
});

describe("planLot", () => {
  it("opens live lots at the opening bid with the source increment", () => {
    const plan = planLot(
      lot({ price: 100000, openingBid: 100000, reserveSet: true }),
      "live"
    );
    expect(plan).toMatchObject({
      status: "assigned",
      startingPrice: 100000,
      currentPrice: 100000,
      reservePrice: 100000,
      minIncrement: 2500,
      hasWinningBid: false,
      bidCount: 0,
    });
    expect(
      planLot(lot({ openingBid: 0, price: null }), "live").startingPrice
    ).toBe(1);
    expect(planLot(lot({ reserveSet: false }), "live").reservePrice).toBe(0);
  });

  it("opens fixed-price listings at the asking price", () => {
    const plan = planLot(
      lot({ price: 15500, openingBid: undefined }),
      "upcoming"
    );
    expect(plan.startingPrice).toBe(15500);
    expect(plan.reservePrice).toBe(15500);
  });

  it("records real sold prices with one winning bid", () => {
    const plan = planLot(
      lot({
        lotStatus: "sold",
        price: 265000,
        openingBid: 220000,
        bidCount: 4,
        reserveSet: true,
      }),
      "closed"
    );
    expect(plan).toMatchObject({
      status: "sold",
      currentPrice: 265000,
      startingPrice: 220000,
      reservePrice: 220000,
      hasWinningBid: true,
      bidCount: 4,
    });
    expect(
      planLot(
        lot({ lotStatus: "sold", price: 5000, openingBid: 7500, bidCount: 0 }),
        "closed"
      ).currentPrice
    ).toBe(7500);
  });

  it("records no-sale lots as unsold with the reserve above the best bid", () => {
    const bid = planLot(
      lot({
        lotStatus: "no_sale",
        price: 30000,
        openingBid: 30000,
        highestBid: 60000,
        bidCount: 11,
        reserveSet: true,
      }),
      "closed"
    );
    expect(bid).toMatchObject({
      status: "unsold",
      currentPrice: 60000,
      reservePrice: 61500,
      hasWinningBid: false,
      bidCount: 11,
    });
    const none = planLot(
      lot({
        lotStatus: "no_sale",
        price: 9000,
        openingBid: 9000,
        highestBid: null,
        reserveSet: true,
      }),
      "closed"
    );
    expect(none).toMatchObject({
      status: "unsold",
      currentPrice: 9000,
      reservePrice: 9000,
      bidCount: 0,
    });
    const noReserve = planLot(
      lot({
        lotStatus: "no_sale",
        price: 9000,
        openingBid: 9000,
        reserveSet: false,
      }),
      "closed"
    );
    expect(noReserve.reservePrice).toBe(0);
    const stray = planLot(
      lot({
        lotStatus: "no_sale",
        price: 9000,
        openingBid: undefined,
        highestBid: 4000,
        bidCount: undefined,
      }),
      "closed"
    );
    expect(stray.currentPrice).toBe(9000);
    expect(stray.bidCount).toBe(1);
  });
});

describe("re-timing", () => {
  const now = Date.UTC(2026, 10, 23, 12, 0, 0);

  it("keeps the live sale live and the upcoming sale ahead", () => {
    const live = saleWindow("live", 0, now);
    expect(live.status).toBe("published");
    expect(live.startTime).toBeLessThan(now);
    expect(live.endTime - now).toBe(6 * MS_PER_DAY);
    const upcoming = saleWindow("upcoming", 0, now);
    expect(upcoming.startTime).toBeGreaterThan(now);
    expect(upcoming.endTime).toBeGreaterThan(upcoming.startTime);
  });

  it("spaces closed sales in the past, newest first", () => {
    const first = saleWindow("closed", 1, now);
    const second = saleWindow("closed", 2, now);
    expect(first.status).toBe("closed");
    expect(first.endTime).toBeLessThan(now);
    expect(second.endTime).toBeLessThan(first.startTime);
    expect(saleWindow("closed", 0, now).endTime).toBe(first.endTime);
  });

  it("is idempotent for a fixed now and shifts timestamps consistently", () => {
    expect(saleWindow("live", 0, now)).toEqual(saleWindow("live", 0, now));
    expect(shiftTimestamp(1000, 500)).toBe(1500);
    expect(shiftTimestamp(undefined, 500)).toBeUndefined();
  });

  it("staggers settle times before the close", () => {
    const end = 1_000_000_000;
    expect(settledAtFor(end, 0, 1)).toBe(end);
    expect(settledAtFor(end, 4, 5)).toBe(end);
    expect(settledAtFor(end, 0, 5)).toBeLessThan(settledAtFor(end, 1, 5));
  });
});

describe("demo bidders", () => {
  it("recognises demo ids only", () => {
    expect(isDemoBidder("mock-buyer-3")).toBe(true);
    expect(isDemoBidder("user_2abc")).toBe(false);
  });

  it("plans ascending bids by rotating bidders", () => {
    const bids = planDemoBids(100000, 2500, 1);
    expect(bids.length).toBeGreaterThanOrEqual(2);
    expect(bids.length).toBeLessThanOrEqual(4);
    expect(bids.map((b) => b.amount)).toEqual(
      [...bids.map((b) => b.amount)].sort((a, b) => a - b)
    );
    expect(bids[0].amount).toBe(102500);
    expect(new Set(bids.map((b) => b.bidderId)).size).toBe(bids.length);
    expect(bids[0].agoMs).toBeGreaterThan(bids[bids.length - 1].agoMs);
  });

  it("spreads demo positions across the sale", () => {
    expect(pickDemoPositions(0, 12)).toEqual([]);
    expect(pickDemoPositions(5, 12)).toEqual([0, 1, 2, 3, 4]);
    const picks = pickDemoPositions(85, 12);
    expect(picks).toHaveLength(12);
    expect(picks[0]).toBe(0);
    expect(picks[picks.length - 1]).toBeLessThan(60);
  });
});

describe("buildLotInput", () => {
  const sale = { role: "closed" as const, seedId: "wbt:auction:2" };

  it("builds a full input from a sparse scraped lot", () => {
    const input = buildLotInput(
      lot({
        title: "  New  holland 8030 ",
        make: "New Holland",
        model: "8030",
        town: "Pretoria yard",
        description: "great condition",
        lotStatus: "sold",
        price: 265000,
        openingBid: 220000,
        bidCount: 4,
      }),
      sale,
      0,
      10,
      4,
      ["s1", "s2"]
    );
    expect(input).toMatchObject({
      seedId: "wbt:lot:77",
      title: "New holland 8030",
      make: "New Holland",
      year: 0,
      operatingHours: 0,
      location: "Pretoria, Gauteng",
      province: "gauteng",
      category: "Tractor",
      description: "Seller says: great condition",
      lotNumber: 4,
      status: "sold",
      photos: ["s1", "s2"],
    });
  });

  it("uses neutral values and omits what is unknown", () => {
    const input = buildLotInput(
      lot({ make: null, model: null, town: null, description: null }),
      sale,
      1,
      10,
      5,
      []
    );
    expect(input.make).toBe("");
    expect(input.model).toBe("");
    expect(input.location).toBe("South Africa");
    expect("province" in input).toBe(false);
    expect("description" in input).toBe(false);
  });

  it("caps the photos", () => {
    const many = Array.from({ length: 14 }, (_, i) => `s${i.toString()}`);
    expect(buildLotInput(lot(), sale, 0, 1, 1, many).photos).toHaveLength(10);
  });
});

describe("assignLotNumbers", () => {
  it("keeps source numbers and fills gaps for duplicates and nulls", () => {
    const numbers = assignLotNumbers([
      lot({ lotNumber: 3 }),
      lot({ lotNumber: 3 }),
      lot({ lotNumber: null }),
      lot({ lotNumber: 7 }),
    ]);
    expect(numbers).toEqual([3, 8, 9, 7]);
    expect(new Set(numbers).size).toBe(4);
    expect(assignLotNumbers([])).toEqual([]);
  });
});

describe("usablePhotos", () => {
  it("keeps absolute urls and drops placeholders", () => {
    expect(
      usablePhotos(
        lot({
          photos: [
            "https://a.test/1.jpg",
            "/images/missing-image-xl.png",
            "https://a.test/missing-image.png",
          ],
        })
      )
    ).toEqual(["https://a.test/1.jpg"]);
  });
});
