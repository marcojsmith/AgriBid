/**
 * Pure helpers for the webuytractors.shop demo import (`scripts/import-wbt.ts`,
 * `convex/wbtImport.ts`, `convex/wbtDemo.ts`). Nothing here touches the
 * database, the network or the clock, so every rule is unit-tested.
 */
import { MS_PER_DAY, MS_PER_HOUR } from "../constants";
import { PROVINCE_LABELS, type Province } from "./provinces";

/** Prefix on every `seedId` created by the import; resets only touch rows with it. */
export const WBT_SEED_PREFIX = "wbt:";

/** The user id of the synthetic seller that owns every imported lot. */
export const WBT_SELLER_USER_ID = "wbt-seller";

/** Display name of the imported seller (the real company name from the source). */
export const WBT_SELLER_NAME = "We Buy Tractors";

/** The categories imported lots map onto (all exist in the seed's category list). */
export const WBT_CATEGORIES = [
  "Tractor",
  "Combine",
  "Sprayer",
  "Planter/Seeder",
  "Tillage Equipment",
  "Hay & Forage",
  "Utility Vehicle",
  "Telehandler",
  "Loader",
  "Construction",
  "Other",
] as const;

/** A category name from {@link WBT_CATEGORIES}. */
export type WbtCategory = (typeof WBT_CATEGORIES)[number];

/** The roles a sale can play in the demo timeline. */
export type SaleRole = "live" | "upcoming" | "closed";

/** One raw lot from the scrape (only the fields the import reads). */
export interface RawLot {
  lotNumber: number | null;
  title: string;
  make: string | null;
  model: string | null;
  year: number | null;
  hours: number | null;
  category: string | null;
  town: string | null;
  province: string | null;
  price: number | null;
  priceKind?: string;
  description: string | null;
  photos: string[];
  sourceUrl: string;
  lotStatus?: string;
  openingBid?: number | null;
  highestBid?: number | null;
  bidCount?: number | null;
  reserveSet?: boolean;
  bidwranglerItemId?: number;
}

/** One raw auction from the scrape. */
export interface RawAuction {
  name: string;
  start: string;
  end: string;
  status: string;
  location?: string;
  description?: string;
  bidwranglerAuctionId: number;
  buyersPremiumPercent?: number;
  lots: RawLot[];
}

/** The scrape's top-level shape (only what the import reads). */
export interface RawData {
  auctions: RawAuction[];
  unassignedListings: RawLot[];
}

/** A sale chosen for import, with its role in the demo timeline. */
export interface SelectedSale {
  role: SaleRole;
  /** 1 = the most recent closed sale; 0 for live and upcoming. */
  closedOrder: number;
  /** Stable idempotency key (`wbt:auction:<source id>`). */
  seedId: string;
  title: string;
  description: string;
  lots: RawLot[];
}

/** Sold, or unsold, outcome of a lot in a closed sale. */
export type LotOutcome = "sold" | "unsold" | "open";

/** Lot titles that are sale notices, not equipment. */
const NON_EQUIPMENT_TITLE =
  /^\W*(terms\b|viewing\b|notice\b|important\b|welcome\b|scam\b|how to\b|banking\b|payment\b|financ|auction finance|rules of auction|conditions of)/i;

/**
 * The usable photo URLs of a lot: absolute http(s) URLs only (the source
 * lists its own "missing image" placeholder as a relative path).
 *
 * @param lot - The raw lot
 * @returns The photo URLs worth downloading, in order
 */
export function usablePhotos(lot: RawLot): string[] {
  return lot.photos.filter(
    (url) => /^https?:\/\//i.test(url) && !/missing-image/i.test(url)
  );
}

/**
 * Whether a scraped lot is real equipment (not a terms or notice image, and
 * with a usable title and at least one photo).
 *
 * @param lot - The raw lot
 * @returns True when the lot should be imported
 */
export function isEquipmentLot(lot: RawLot): boolean {
  const title = lot.title.replace(/\s+/g, " ").trim();
  if (title.length < 3) return false;
  if (!/[a-z0-9]/i.test(title)) return false;
  if (NON_EQUIPMENT_TITLE.test(title)) return false;
  if (usablePhotos(lot).length === 0) return false;
  return true;
}

/** Keyword rules, checked in order against the lower-cased title. */
const CATEGORY_KEYWORDS: readonly [RegExp, WbtCategory][] = [
  [/telehandler|telescopic/, "Telehandler"],
  [/combine|harvester/, "Combine"],
  [/spray(er)?\b|boom spray|mist blower/, "Sprayer"],
  [/planter|seeder|\bsow/, "Planter/Seeder"],
  [
    /baler|mower|slasher|rake\b|\bhay\b|feed mixer|forage|tedder|shredder/,
    "Hay & Forage",
  ],
  [
    /plough|plow|harrow|ripper|cultivator|tiller|rotavat|rotivat|scarifier|disc\b|discs\b|chisel/,
    "Tillage Equipment",
  ],
  [
    /\btlb\b|backhoe|excavator|bulldozer|dozer|grader|roller|dumper|crane|skid.?steer|digger/,
    "Construction",
  ],
  [/loader|front end/, "Loader"],
  [
    /\bquad\b|atv|side.?by.?side|\brtv\b|utility vehicle|gator|buggy/,
    "Utility Vehicle",
  ],
  [
    /tractor|\btd\d|\bmf\s?\d|massey|john deere|\bjd\s?\d|landini|farmtrac|fiat|ford \d|new holland|case ih|belarus|zetor/,
    "Tractor",
  ],
];

/** Scraped source categories mapped onto ours, used when no keyword matched. */
const SOURCE_CATEGORY: Record<string, WbtCategory> = {
  tractors: "Tractor",
  "farming implements": "Tillage Equipment",
  implements: "Tillage Equipment",
  "farming equipment": "Other",
  rotivater: "Tillage Equipment",
  mowers: "Hay & Forage",
  harvester: "Combine",
  excavator: "Construction",
  "earthmoving yellow machinery": "Construction",
  "yellow earthmoving equipment": "Construction",
};

/**
 * Maps a lot onto one of the platform's existing categories: title keywords
 * first (the scraped category is unreliable), then the scraped category, else
 * "Other".
 *
 * @param title - The lot title
 * @param sourceCategory - The scraped category, if any
 * @returns A category name that exists in the seeded categories
 */
export function mapCategory(
  title: string,
  sourceCategory: string | null
): WbtCategory {
  const lower = title.toLowerCase();
  for (const [pattern, category] of CATEGORY_KEYWORDS) {
    if (pattern.test(lower)) return category;
  }
  if (sourceCategory) {
    const mapped = SOURCE_CATEGORY[sourceCategory.trim().toLowerCase()];
    if (mapped) return mapped;
  }
  return "Other";
}

/** Unambiguous South African town -> province. Ambiguous names are left out. */
const TOWN_PROVINCE: Record<string, Province> = {
  pretoria: "gauteng",
  "pretoria north": "gauteng",
  benoni: "gauteng",
  meyerton: "gauteng",
  bronkhorstspruit: "gauteng",
  hammanskraal: "gauteng",
  vereeniging: "gauteng",
  springs: "gauteng",
  nigel: "gauteng",
  "kempton park": "gauteng",
  randfontein: "gauteng",
  olifantsfontein: "gauteng",
  potch: "north_west",
  potchefstroom: "north_west",
  delareyville: "north_west",
  zeerust: "north_west",
  klerksdorp: "north_west",
  lichtenburg: "north_west",
  wolmaransstad: "north_west",
  vryburg: "north_west",
  koster: "north_west",
  brits: "north_west",
  magaliesburg: "north_west",
  sannieshof: "north_west",
  hartbeesfontein: "north_west",
  bethlehem: "free_state",
  winburg: "free_state",
  edenville: "free_state",
  oranjeville: "free_state",
  metsimaholo: "free_state",
  frankfort: "free_state",
  tweeling: "free_state",
  vrede: "free_state",
  ficksburg: "free_state",
  kestell: "free_state",
  phutaditjhaba: "free_state",
  colocolan: "free_state",
  gariepdam: "free_state",
  witbank: "mpumalanga",
  emalahleni: "mpumalanga",
  nelspruit: "mpumalanga",
  standerton: "mpumalanga",
  morgenzon: "mpumalanga",
  bushbuckridge: "mpumalanga",
  nkomazi: "mpumalanga",
  carolina: "mpumalanga",
  hazyview: "mpumalanga",
  barberton: "mpumalanga",
  bethal: "mpumalanga",
  balfour: "mpumalanga",
  lydenburg: "mpumalanga",
  "bela bela": "limpopo",
  polokwane: "limpopo",
  burgersfort: "limpopo",
  groblersdal: "limpopo",
  "marble hall": "limpopo",
  naboomspruit: "limpopo",
  hoedspruit: "limpopo",
  ellisras: "limpopo",
  lephalale: "limpopo",
  giyani: "limpopo",
  makhado: "limpopo",
  mokopane: "limpopo",
  uniondale: "western_cape",
  george: "western_cape",
  swellendam: "western_cape",
  caledon: "western_cape",
  stellenbosch: "western_cape",
  worcester: "western_cape",
  malmesbury: "western_cape",
  piketberg: "western_cape",
  stanford: "western_cape",
  capetown: "western_cape",
  "cape town": "western_cape",
  clanwilliam: "western_cape",
  mosselbay: "western_cape",
  "mossel bay": "western_cape",
  franschhoek: "western_cape",
  ladismith: "western_cape",
  calitzdorp: "western_cape",
  moorreesburg: "western_cape",
  overberg: "western_cape",
  harkerville: "western_cape",
  calvinia: "northern_cape",
  upington: "northern_cape",
  springbok: "northern_cape",
  kimberley: "northern_cape",
  postmasburg: "northern_cape",
  kakamas: "northern_cape",
  queenstown: "eastern_cape",
  mthatha: "eastern_cape",
  "east london": "eastern_cape",
  cradock: "eastern_cape",
  "port elizabeth": "eastern_cape",
  "somerset east": "eastern_cape",
  jansenville: "eastern_cape",
  qamata: "eastern_cape",
  uitenhage: "eastern_cape",
  kariega: "eastern_cape",
  durban: "kwazulu_natal",
  newcastle: "kwazulu_natal",
  howick: "kwazulu_natal",
  empangeni: "kwazulu_natal",
  umhlathuze: "kwazulu_natal",
  estcourt: "kwazulu_natal",
  winterton: "kwazulu_natal",
  "shelly beach": "kwazulu_natal",
};

/** Whole-word province hints found inside a free-text town. */
const PROVINCE_HINTS: readonly [RegExp, Province][] = [
  [/\bgauteng\b/, "gauteng"],
  [/\bfree[\s-]?state\b|\bfs\b/, "free_state"],
  [/\bwestern cape\b/, "western_cape"],
  [/\bkzn\b|\bkwazulu/, "kwazulu_natal"],
  [/\bnorth[\s-]?west\b/, "north_west"],
  [/\blimpopo\b/, "limpopo"],
  [/\bmpumalanga\b|\bmp\b/, "mpumalanga"],
  [/\bnorthern cape\b/, "northern_cape"],
  [/\beastern cape\b/, "eastern_cape"],
];

/** The scraped province names mapped onto stored province keys. */
const SOURCE_PROVINCE: Record<string, Province> = {
  gauteng: "gauteng",
  "free state": "free_state",
  "kwazulu-natal": "kwazulu_natal",
  limpopo: "limpopo",
  mpumalanga: "mpumalanga",
  "northern cape": "northern_cape",
  "north west": "north_west",
  "western cape": "western_cape",
  "eastern cape": "eastern_cape",
};

/**
 * Infers a province only when it is unambiguous: the scraped province, else a
 * province named in the text ("Nigel Gauteng"), else a town on the allow-list.
 * Towns that exist in several provinces (Middelburg, Heidelberg, Richmond...)
 * return undefined.
 *
 * @param town - The scraped town text
 * @param sourceProvince - The scraped province name, if any
 * @returns The province key, or undefined when unsure
 */
export function provinceForTown(
  town: string | null,
  sourceProvince: string | null
): Province | undefined {
  if (sourceProvince) {
    const fromSource = SOURCE_PROVINCE[sourceProvince.trim().toLowerCase()];
    if (fromSource) return fromSource;
  }
  if (!town) return undefined;
  const lower = town.toLowerCase();
  for (const [pattern, province] of PROVINCE_HINTS) {
    if (pattern.test(lower)) return province;
  }
  const cleaned = cleanTown(town).toLowerCase();
  return TOWN_PROVINCE[cleaned];
}

/**
 * Tidies a scraped town: drops "yard"/"area"/"farm" suffixes and trailing
 * province words, collapses spaces and title-cases it.
 *
 * @param town - The scraped town text
 * @returns The cleaned town name ("" when nothing usable remains)
 */
export function cleanTown(town: string): string {
  const stripped = town
    .replace(/\b(yard|area|boerdery|around|between)\b/gi, " ")
    .replace(
      /\b(gauteng|free[\s-]?state|western cape|kzn|fs|mp|north[\s-]?west|limpopo|mpumalanga|northern cape|eastern cape)\b\.?/gi,
      " "
    )
    .split(/[,.]/)[0]
    .replace(/\s+/g, " ")
    .trim();
  return stripped
    .split(" ")
    .map((word) =>
      word.length === 0 ? word : word[0].toUpperCase() + word.slice(1)
    )
    .join(" ");
}

/**
 * Builds the `location` text of a lot: "Town, Province" when both are known,
 * else the town, else a neutral "South Africa" (nothing invented).
 *
 * @param town - The scraped town
 * @param province - The inferred province key, if any
 * @param labels - Province key -> label lookup
 * @returns The location string
 */
export function buildLocation(
  town: string | null,
  province: Province | undefined,
  labels: Record<Province, string>
): string {
  const clean = town ? cleanTown(town) : "";
  const provinceLabel = province ? labels[province] : "";
  if (clean && provinceLabel) return `${clean}, ${provinceLabel}`;
  if (clean) return clean;
  if (provinceLabel) return provinceLabel;
  return "South Africa";
}

/** Placeholder copy the source repeats on lots whose seller wrote nothing. */
const BOILERPLATE_DESCRIPTION =
  /^condition description as from seller\.?\s*condition not guaranteed\.?\s*please view item\.?$/i;

/** The longest description kept (characters). */
export const MAX_DESCRIPTION_CHARS = 900;

/**
 * Turns the scraped description into "Seller says: ..." text, or undefined
 * when there is nothing worth showing.
 *
 * @param description - The scraped description
 * @returns The description to store, if any
 */
export function sellerSays(description: string | null): string | undefined {
  if (!description) return undefined;
  const text = description
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length === 0 || BOILERPLATE_DESCRIPTION.test(text)) return undefined;
  const clipped =
    text.length > MAX_DESCRIPTION_CHARS
      ? `${text.slice(0, MAX_DESCRIPTION_CHARS).trimEnd()}…`
      : text;
  return `Seller says: ${clipped}`;
}

/**
 * The bidding increment for a price, following the source sale's published
 * ladder (R500 to R10k, R1k to R40k, R1.5k to R80k, R2k to R100k, R2.5k to
 * R250k, R3.5k to R500k, then R5k).
 *
 * @param price - The current or opening price in rand
 * @returns The minimum increment in rand
 */
export function minIncrementFor(price: number): number {
  if (price < 10_000) return 500;
  if (price < 40_000) return 1_000;
  if (price < 80_000) return 1_500;
  if (price < 100_000) return 2_000;
  if (price < 250_000) return 2_500;
  if (price < 500_000) return 3_500;
  return 5_000;
}

/** The auction-level premium every imported lot snapshots (percent). */
export const WBT_BUYER_PREMIUM_PCT = 12;

/** The auction-level seller commission snapshotted on imported lots (percent). */
export const WBT_SELLER_COMMISSION_PCT = 5;

/**
 * Picks the sales to import: the open sale, the N most recent closed sales and
 * the fixed-price listings (as the upcoming sale).
 *
 * @param data - The parsed scrape
 * @param closedCount - How many recent closed sales to take
 * @returns The sales in timeline order (live, upcoming, closed newest first)
 */
export function selectSales(data: RawData, closedCount = 5): SelectedSale[] {
  const sales: SelectedSale[] = [];
  const open = data.auctions.find((a) => a.status === "open");
  if (open) {
    sales.push({
      role: "live",
      closedOrder: 0,
      seedId: auctionSeedId(String(open.bidwranglerAuctionId)),
      title: cleanSaleTitle(open.name),
      description: saleDescription(open),
      lots: open.lots,
    });
  }
  if (data.unassignedListings.length > 0) {
    sales.push({
      role: "upcoming",
      closedOrder: 0,
      seedId: auctionSeedId("listings"),
      title: "Showroom stock: fixed-price tractors and implements",
      description:
        "Tractors and implements from We Buy Tractors that were listed at a fixed price. Bidding opens at the listed price.",
      lots: data.unassignedListings,
    });
  }
  const closed = data.auctions
    .filter((a) => a.status === "closed")
    .sort((a, b) => b.end.localeCompare(a.end))
    .slice(0, closedCount);
  closed.forEach((auction, index) => {
    sales.push({
      role: "closed",
      closedOrder: index + 1,
      seedId: auctionSeedId(String(auction.bidwranglerAuctionId)),
      title: cleanSaleTitle(auction.name),
      description: saleDescription(auction),
      lots: auction.lots,
    });
  });
  return sales;
}

/**
 * Shortens the source sale name ("20-25 November Year End 2026 Low Reserve
 * Commercial and Agricultural Online Auction") to what fits a card.
 *
 * @param name - The source sale name
 * @returns The display title
 */
export function cleanSaleTitle(name: string): string {
  return name
    .replace(/\s+/g, " ")
    .replace(
      /\s*Low Reserve Commercial and Agricultural Online Auction\s*$/i,
      " Auction"
    )
    .trim();
}

/**
 * A short description for a sale (the source's long terms text is not copied).
 *
 * @param auction - The raw sale
 * @returns A one-sentence description
 */
function saleDescription(auction: RawAuction): string {
  return `Online auction of commercial and agricultural equipment from We Buy Tractors. ${auction.lots.length.toString()} lots in the source sale.`;
}

/**
 * Builds a sale's idempotency key. It depends only on the source sale, never on
 * its timeline role, so a sale that moves from live to closed is updated in
 * place instead of duplicated.
 *
 * @param sourceId - The source auction id, or "listings" for fixed-price stock
 * @returns `wbt:auction:<id>`
 */
export function auctionSeedId(sourceId: string): string {
  return `${WBT_SEED_PREFIX}auction:${sourceId}`;
}

/**
 * A lot's idempotency key: stable per source item, independent of the lot
 * number or the sale's timeline role.
 *
 * @param lot - The raw lot
 * @param saleSeedId - The parent sale's seed id
 * @returns `wbt:lot:<item id or url+number>`
 */
export function lotSeedId(lot: RawLot, saleSeedId: string): string {
  if (lot.bidwranglerItemId !== undefined) {
    return `${WBT_SEED_PREFIX}lot:${lot.bidwranglerItemId.toString()}`;
  }
  const slug = lot.sourceUrl
    .replace(/^https?:\/\/[^/]+\//, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const tail = saleSeedId.split(":").pop() ?? "x";
  return `${WBT_SEED_PREFIX}lot:${tail}:${slug || lot.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

/** The planned stored state of a lot. */
export interface LotPlan {
  status: "assigned" | "sold" | "unsold";
  startingPrice: number;
  currentPrice: number;
  reservePrice: number;
  minIncrement: number;
  /** True when a single winning bid row should back a sold lot. */
  hasWinningBid: boolean;
  /** The real number of bids the source recorded (drives the bid counter). */
  bidCount: number;
}

/**
 * Decides the stored prices and outcome of a lot from the source data.
 *
 * - live / upcoming: assigned, current = starting = opening (or asking) price.
 * - closed + sold: sold at the real winning bid; reserve = opening bid.
 * - closed + no sale: unsold; current = the best unmet bid else the opening
 *   bid; reserve sits one increment above the best bid so "reserve not met" is
 *   true.
 *
 * @param lot - The raw lot
 * @param role - The sale's timeline role
 * @returns The plan
 */
export function planLot(lot: RawLot, role: SaleRole): LotPlan {
  const opening = Math.max(1, Math.round(lot.openingBid ?? lot.price ?? 1));
  if (role !== "closed") {
    return {
      status: "assigned",
      startingPrice: opening,
      currentPrice: opening,
      reservePrice:
        role === "upcoming" ? opening : lot.reserveSet ? opening : 0,
      minIncrement: minIncrementFor(opening),
      hasWinningBid: false,
      bidCount: 0,
    };
  }
  const bidCount = Math.max(0, Math.round(lot.bidCount ?? 0));
  if (lot.lotStatus === "sold" && lot.price !== null) {
    const price = Math.max(opening, Math.round(lot.price));
    return {
      status: "sold",
      startingPrice: opening,
      currentPrice: price,
      reservePrice: lot.reserveSet ? opening : 0,
      minIncrement: minIncrementFor(price),
      hasWinningBid: true,
      bidCount: Math.max(1, bidCount),
    };
  }
  const best = lot.highestBid ?? null;
  const current = best !== null ? Math.max(opening, Math.round(best)) : opening;
  const increment = minIncrementFor(current);
  const hasBid = best !== null && best > 0;
  return {
    status: "unsold",
    startingPrice: opening,
    currentPrice: current,
    reservePrice: hasBid ? current + increment : lot.reserveSet ? opening : 0,
    minIncrement: increment,
    hasWinningBid: false,
    bidCount: hasBid ? Math.max(1, bidCount) : 0,
  };
}

/** A sale's target window, relative to "now". */
export interface SaleWindow {
  startTime: number;
  endTime: number;
  status: "published" | "closed";
}

/** How far apart the re-timed closed sales are (days). */
const CLOSED_SPACING_DAYS = 28;

/** Days until the live sale closes: after the 7-day weekly reset. */
const LIVE_CLOSES_IN_DAYS = 8;

/** Days until the upcoming sale closes: after the 7-day weekly reset. */
const UPCOMING_CLOSES_IN_DAYS = 9;

/**
 * Where each sale sits on the demo timeline, relative to `now`:
 * live opened 2 days ago and closes in 8; upcoming opens in 1 day and closes
 * in 9; closed sale N (1 = newest) ended 3 + 28 x (N - 1) days ago after a
 * 4-day run. Open sales end AFTER the next weekly reset (7 days), so the
 * settle cron never settles (and detaches) their lots before the reset
 * re-times them.
 *
 * @param role - The sale's timeline role
 * @param closedOrder - 1 = newest closed sale (ignored for other roles)
 * @param now - Current time (ms)
 * @returns The target window
 */
export function saleWindow(
  role: SaleRole,
  closedOrder: number,
  now: number
): SaleWindow {
  if (role === "live") {
    return {
      startTime: now - 2 * MS_PER_DAY,
      endTime: now + LIVE_CLOSES_IN_DAYS * MS_PER_DAY,
      status: "published",
    };
  }
  if (role === "upcoming") {
    return {
      startTime: now + MS_PER_DAY,
      endTime: now + UPCOMING_CLOSES_IN_DAYS * MS_PER_DAY,
      status: "published",
    };
  }
  const end =
    now -
    3 * MS_PER_DAY -
    CLOSED_SPACING_DAYS * (Math.max(1, closedOrder) - 1) * MS_PER_DAY;
  return {
    startTime: end - 4 * MS_PER_DAY,
    endTime: end,
    status: "closed",
  };
}

/**
 * Shifts a timestamp by the amount a sale moved, so lot settle times keep
 * their position relative to the sale's close.
 *
 * @param value - The stored timestamp, if any
 * @param delta - Target end minus current end (ms)
 * @returns The shifted timestamp, or undefined when none was stored
 */
export function shiftTimestamp(
  value: number | undefined,
  delta: number
): number | undefined {
  return value === undefined ? undefined : value + delta;
}

/** Hours a closed lot's settle time is spread across ahead of the sale end. */
export const SETTLE_SPREAD_HOURS = 2;

/**
 * A closed lot's settle time: staggered backwards from the sale's close in the
 * source's lot order, within {@link SETTLE_SPREAD_HOURS}.
 *
 * @param endTime - The sale's close
 * @param index - The lot's position (0-based) in the sale
 * @param total - The number of lots in the sale
 * @returns The settle timestamp
 */
export function settledAtFor(
  endTime: number,
  index: number,
  total: number
): number {
  if (total <= 1) return endTime;
  const spread = SETTLE_SPREAD_HOURS * MS_PER_HOUR;
  return endTime - Math.round(spread * (1 - index / (total - 1)));
}

/** Prefix of the synthetic demo bidders; bids and watches by them are seed data. */
export const DEMO_BIDDER_PREFIX = "mock-";

/** The synthetic demo bidders that win closed lots and bid on live ones. */
export const DEMO_BIDDER_IDS: readonly string[] = [
  "mock-buyer-1",
  "mock-buyer-2",
  "mock-buyer-3",
  "mock-buyer-4",
  "mock-buyer-5",
  "mock-buyer-6",
];

/**
 * Whether a bidder or watcher id belongs to the synthetic demo users (so a
 * reset may delete its rows without touching a real person's).
 *
 * @param userId - A bidder or watcher id
 * @returns True for demo ids
 */
export function isDemoBidder(userId: string): boolean {
  return userId.startsWith(DEMO_BIDDER_PREFIX);
}

/** A planned demo bid on a live lot. */
export interface DemoBid {
  bidderId: string;
  amount: number;
  /** Milliseconds before "now" the bid was placed. */
  agoMs: number;
}

/**
 * Plans a short ascending bid history for a live demo lot: 2 to 4 bids from
 * rotating demo bidders, each one increment above the last, spread over the
 * last two days.
 *
 * @param startingPrice - The lot's opening price
 * @param minIncrement - The lot's increment
 * @param seed - Any stable number (e.g. the lot's position) to vary the plan
 * @returns The bids, oldest first
 */
export function planDemoBids(
  startingPrice: number,
  minIncrement: number,
  seed: number
): DemoBid[] {
  const count = 2 + (seed % 3);
  const bids: DemoBid[] = [];
  for (let i = 0; i < count; i++) {
    bids.push({
      bidderId: DEMO_BIDDER_IDS[(seed + i) % DEMO_BIDDER_IDS.length],
      amount: startingPrice + minIncrement * (i + 1),
      agoMs: Math.round(((count - i) * 2 * MS_PER_DAY) / (count + 1)),
    });
  }
  return bids;
}

/**
 * Picks which positions in a sale get demo bids and watchers: `count` lots
 * spread evenly across the first `window` lots.
 *
 * @param total - Lots in the sale
 * @param count - How many lots to decorate
 * @param window - How far into the sale to look
 * @returns Sorted, distinct 0-based positions
 */
export function pickDemoPositions(
  total: number,
  count: number,
  window = 60
): number[] {
  const span = Math.min(total, window);
  if (span <= 0) return [];
  const picks = Math.min(count, span);
  const positions = new Set<number>();
  for (let i = 0; i < picks; i++) {
    positions.add(Math.floor((i * span) / picks));
  }
  return [...positions].sort((a, b) => a - b);
}

/** The most photos kept per lot. */
export const MAX_PHOTOS_PER_LOT = 10;

/** A lot as `wbtImport:upsertLots` expects it. */
export interface LotInput {
  seedId: string;
  title: string;
  make: string;
  model: string;
  year: number;
  operatingHours: number;
  location: string;
  province?: Province;
  category: WbtCategory;
  description?: string;
  lotNumber: number;
  photos: string[];
  status: "assigned" | "sold" | "unsold";
  startingPrice: number;
  currentPrice: number;
  reservePrice: number;
  minIncrement: number;
  hasWinningBid: boolean;
  bidCount: number;
  index: number;
  total: number;
}

/**
 * Builds the `upsertLots` input for one scraped lot. Unknown year and hours
 * are stored as 0 (the app hides 0), an unknown make as an empty string (the title is shown instead and the make is left out of filters), and the
 * province only when it can be inferred without guessing.
 *
 * @param raw - The scraped lot
 * @param sale - The sale the lot belongs to
 * @param index - The lot's position (0-based) among the sale's imported lots
 * @param total - How many lots the sale imports
 * @param lotNumber - The lot number to store (unique within the sale)
 * @param photos - Convex storage ids of the uploaded photos, lead first
 * @returns The input object
 */
export function buildLotInput(
  raw: RawLot,
  sale: Pick<SelectedSale, "role" | "seedId">,
  index: number,
  total: number,
  lotNumber: number,
  photos: string[]
): LotInput {
  const plan = planLot(raw, sale.role);
  const province = provinceForTown(raw.town, raw.province);
  const title = raw.title.replace(/\s+/g, " ").trim();
  return {
    seedId: lotSeedId(raw, sale.seedId),
    title,
    make: raw.make?.trim() ?? "",
    model: raw.model?.trim() ?? "",
    year: raw.year ?? 0,
    operatingHours: raw.hours ?? 0,
    location: buildLocation(raw.town, province, PROVINCE_LABELS),
    ...(province ? { province } : {}),
    category: mapCategory(title, raw.category),
    ...(sellerSays(raw.description)
      ? { description: sellerSays(raw.description) }
      : {}),
    lotNumber,
    photos: photos.slice(0, MAX_PHOTOS_PER_LOT),
    status: plan.status,
    startingPrice: plan.startingPrice,
    currentPrice: plan.currentPrice,
    reservePrice: plan.reservePrice,
    minIncrement: plan.minIncrement,
    hasWinningBid: plan.hasWinningBid,
    bidCount: plan.bidCount,
    index,
    total,
  };
}

/**
 * Assigns unique lot numbers within a sale: the source number when it is
 * unused, otherwise the next free one (fixed-price listings have none).
 *
 * @param lots - The sale's imported lots in order
 * @returns One lot number per lot, in the same order
 */
export function assignLotNumbers(lots: readonly RawLot[]): number[] {
  const used = new Set<number>();
  for (const l of lots) {
    if (l.lotNumber !== null && !used.has(l.lotNumber)) used.add(l.lotNumber);
  }
  const taken = new Set<number>();
  let next = Math.max(0, ...used) + 1;
  return lots.map((l) => {
    if (l.lotNumber !== null && !taken.has(l.lotNumber)) {
      taken.add(l.lotNumber);
      return l.lotNumber;
    }
    const n = next++;
    taken.add(n);
    return n;
  });
}
