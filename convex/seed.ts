// app/convex/seed.ts
import { v } from "convex/values";

import { internalMutation, mutation } from "./_generated/server";
import {
  DEFAULT_BUYER_PREMIUM_PCT,
  DEFAULT_DEPOSIT_AMOUNT,
  DEFAULT_DEPOSIT_ENABLED,
  DEFAULT_DEPOSIT_REFUND_DAYS,
  DEFAULT_MIN_PHOTOS_PER_LOT,
  DEFAULT_SELLER_COMMISSION_PCT,
  DEFAULT_SELLER_LISTING_FEE,
  DEFAULT_SELLER_PAYOUT_DAYS,
  MS_PER_DAY,
  MS_PER_HOUR,
} from "./constants";
import type { Drive, PhotoAngle, SellerType } from "./lib/lotSpecs";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getCallerRole } from "./lib/auth";
import { deleteAuctionImages, safeDelete } from "./lib/storage";
import { updateCounter, logAudit } from "./admin_utils";
import { getLotCounterKey } from "./lots/mutations/helpers";
import {
  bidCounterName,
  issueNextLotNumber,
  watcherCounterName,
} from "./lib/lotCounters";
import { ensureLegalPageDraftRows } from "./lib/legalPages";
import {
  PROVINCES,
  SELLER_RESPONSE_TIMES,
  type Province,
  type SellerResponseTime,
} from "./lib/provinces";

export type DestructiveAccessPath = "admin" | "secret" | "dev";

type SeedTableNames =
  | "auctions"
  | "lots"
  | "bids"
  | "profiles"
  | "watchlist"
  | "equipmentMetadata"
  | "equipmentCategories"
  | "counters"
  | "lotViewers"
  | "proxy_bids"
  | "reviews"
  | "conversations"
  | "messages"
  | "notifications"
  | "supportTickets"
  | "userActivity"
  | "lotFlags"
  | "profileFlags"
  | "lotFees";

const MOCK_IMAGE_URLS = {
  JD_FRONT:
    "https://www.deere.com/assets/images/region-4/products/tractors/" +
    "row-crop-tractors/8r-8rt-row-crop-tractors/" +
    "8r-410/" +
    "8r_410_r4f063847_large_" +
    "660c917945cea0af3aeb242ddf4c52b9540ef7cc.jpg",
  JD_ENGINE:
    "https://photos.machinefinder.com/06/10805006/" + "70729678_large.jpg",
  JD_CABIN:
    "https://www.deere.asia/assets/images/region-2/products/tractors/large/" +
    "8r-series/" +
    "2_8r410_joskin_slurrytank_" +
    "dsc2539_large_large_" +
    "7a4506d66221ef20112cf11f13bf7ffc898ffec6.jpg",
  CASE_FRONT:
    "https://titanmachinery.bg/media/stenik_article/article/cache/2/" +
    "image/9df78eab33525d08d6e5fb8d27136e95/1/4/14228766973.jpg",
  CASE_ENGINE:
    "https://cnhi-p-001-delivery.sitecorecontenthub.cloud/api/public/" +
    "content/a74b2445b23f440bacd99ab8eaf177cc?" +
    "v=abc51e43",
  CASE_CABIN:
    "https://www.lectura-specs.com/models/renamed/orig/" +
    "4wd-tractors-magnum-380-cvxdrive-case-ih.jpg",
  NH_FRONT:
    "https://cnhi-p-001-delivery.sitecorecontenthub.cloud/api/public/" +
    "content/8938fcb66b3a4f48abced368ef3e49ae?" +
    "v=8416d11a&t=size1100",
  NH_ENGINE:
    "https://rollinsmachinery.com/wp-content/uploads/2024/02/" +
    "Right-Side-T7.315.jpg",
  NH_CABIN:
    "https://www.worldtractors.co.uk/wp-content/uploads/2025/03/" +
    "IMG_0131-scaled.jpeg",
  MF_FRONT: "https://www.scotagri.com/media/bz5dn5hz/" + "image001-33.jpg",
  MF_ENGINE:
    "https://ik.imagekit.io/efarm/images/f1e19830-278d-4d3c-894b-18101ec963ec.jpg?" +
    "tr=w-600%2Cl-image%2Ci-%40%40website-machine-images-watermarks%40%40" +
    "watermark_DZDDMXPYs_" +
    "M9F2mQxfH.png%2Clx-6%2Cly-6%2Cw-90%2Cl-end",
  MF_CABIN:
    "https://heavyequipmentspecs.s3.amazonaws.com/tractors/" +
    "massey-ferguson-8s.305/massey-ferguson-8s.305_1.jpg",
  FENDT_FRONT:
    "https://www.fendt.com/int/images/" +
    "60cc414b69b3411a3a4b5114_1623998796_web_en.png",
  FENDT_ENGINE:
    "https://cdn.gebrauchtmaschinen.de/data/listing/img/vga/ms/97/53/" +
    "16247668-01.jpg?v=1717573999",
  FENDT_CABIN:
    "https://media.sandhills.com/img.axd?id=9026328987&" +
    "wid=4326185391&" +
    "rwl=False&p=&ext=&w=350&h=220&t=&lp=&c=True&wt=False&sz=Cover&rt=0&" +
    "checksum=42ysNVTRQ" +
    "48SZVTD4" +
    "%2BotMVL9yMULXnb" +
    "1mnh8ao7tBzk%3D",
};

/**
 * Builds a webuytractors.shop photo URL (Wix media, hot-linked, never
 * downloaded) from a media id, in the `fit` form the site's own sitemap uses.
 *
 * @param id - Wix media id without the `cd3e79_` prefix.
 * @param ext - File extension of the original upload.
 * @returns Absolute photo URL.
 */
function wixPhoto(id: string, ext: "jpg" | "jpeg"): string {
  return (
    `https://static.wixstatic.com/media/cd3e79_${id}~mv2.${ext}` +
    "/v1/fit/w_1280,h_960,q_90/file.jpg"
  );
}

/**
 * Real photo URLs from https://webuytractors.shop (the owner's own site).
 * Hot-linked as-is: refs starting with `http` are used unchanged by the app.
 */
const WBT_PHOTOS = {
  // Massey Ferguson 455 Xtra 4x4: 8 photos, in the site's gallery order.
  MF455: [
    wixPhoto("60a2bb48a7a44088bb492de43f5f758f", "jpg"),
    wixPhoto("0b27b6e45fef4b76a138ba5ce893f320", "jpg"),
    wixPhoto("a83e319f71764b1d8d0a813094634338", "jpg"),
    wixPhoto("64bcbed935a94114a8c9f0f9e3e2c934", "jpg"),
    wixPhoto("8093127c503b429caf8ad3f199256e98", "jpg"),
    wixPhoto("c81a9a09a5f04167abcf343b809ddb87", "jpg"),
    wixPhoto("6a11425891694e2fb101c0fcbe00a42b", "jpg"),
    wixPhoto("b7c48312089841d3ba9b5c502527b509", "jpg"),
  ],
  NH8030: [
    wixPhoto("2b9b110683e149bca3b3392ddd2e8c88", "jpeg"),
    wixPhoto("27a1d0d328f54751a0422828d92d06cc", "jpeg"),
    wixPhoto("48155daec99b4454a15c406ab9ff8043", "jpeg"),
  ],
  TD5_110: [wixPhoto("359af10b7a5f4972b89a919c2f828440", "jpeg")],
  MF440_4X4: [wixPhoto("4fd6c65ff22444c49c1cedf0b4fb58e7", "jpeg")],
  MF399: [wixPhoto("668641e585e246a4888f8ab626dc6ce9", "jpeg")],
  MF290: [wixPhoto("3a6cb1667c3547ae83497b06165a067a", "jpeg")],
  JD5725: [wixPhoto("1414644248b848969fcaae0383a67694", "jpeg")],
  MF165: [wixPhoto("5c069e469f504cf5b0509a0dc2ea5888", "jpeg")],
  FORD5000: [wixPhoto("e7836d58c23c49a7a393085a99ad5e7b", "jpeg")],
  FARMTRAC80: [wixPhoto("b621db6c7aca41b988ecffa1d2eefda5", "jpeg")],
  MF440: [
    wixPhoto("e9c304b460ce412f901ec7e7ec0fef39", "jpeg"),
    wixPhoto("e9e26c3018ea413283214480299e7be4", "jpeg"),
    wixPhoto("a77ab484598d48488de2a88919595123", "jpeg"),
  ],
  // New Holland T6070: the only photo the owner's auction listing
  // (auctions.webuytractors.shop, lot 36) publishes. The shop has no gallery
  // for this machine, so it is captioned "front" only, not padded with
  // unrelated photos.
  T6070:
    "https://d7c0fzax1fy4f.cloudfront.net/" +
    "eyJidWNrZXQiOiJid3BhcGVyY2xpcC1pbnRlcm5hdGlvbmFsIiwia2V5IjoiaXRlbV9pbWFnZXMv" +
    "YXNzZXRzL2NvbXBhbnlfNjQ5LzExNi8zODEvMTAwL29yaWdpbmFsL0lNRy0yMDI2MTAxOS1XQTAw" +
    "NTMuanBnIiwidiI6MTc5MjU3MDk1OSwiZWRpdHMiOnsicmVzaXplIjp7InciOjEyMDAsImgiOjc1" +
    "Nn0sImF2aWYiOnsicSI6NzAsInN0eWxlIjoibGcifSwianBlZyI6eyJxIjo4NX19fQ==" +
    "?signature=fa774adb6ce0f439b09c7ae1f54a4714d39afa186d88e3d58cd1bcdf6dc08a44",
};

/** The fixed shot list in the order a full 8-photo gallery is captioned. */
const SHOT_LIST_ORDER: readonly PhotoAngle[] = [
  "front",
  "rear",
  "left_side",
  "right_side",
  "cab_interior",
  "hour_meter",
  "engine_bay",
  "tyres",
];

/** Lot images in the stored object form, plus the per-photo angle captions. */
interface MockPhotoSet {
  images: {
    front: string;
    engine?: string;
    cabin?: string;
    additional: string[];
  };
  imageAngles: Record<string, PhotoAngle>;
}

/**
 * Turns a list of photo URLs into stored lot images plus angle captions.
 * Photos are captioned by position along the fixed shot list (the site's
 * galleries do not carry captions, so this assignment is a demo convention).
 * The first photo is the front; `engine`/`cabin` take the engine-bay and
 * cab-interior shots when present, everything else goes to `additional`.
 *
 * @param urls - Hot-linked photo URLs (at most the shot-list length).
 * @returns Stored images and their angle captions.
 */
function mockPhotoSet(urls: readonly string[]): MockPhotoSet {
  const captions = new Map<string, PhotoAngle>();
  const byAngle = new Map<PhotoAngle, string>();
  for (const [index, url] of urls.entries()) {
    const angle = SHOT_LIST_ORDER[index];
    captions.set(url, angle);
    byAngle.set(angle, url);
  }
  const imageAngles: Record<string, PhotoAngle> = Object.fromEntries(captions);
  const front = urls[0];
  const engine = byAngle.get("engine_bay");
  const cabin = byAngle.get("cab_interior");
  const additional = urls.filter(
    (url) => url !== front && url !== engine && url !== cabin
  );
  return {
    images: {
      front,
      ...(engine ? { engine } : {}),
      ...(cabin ? { cabin } : {}),
      additional,
    },
    imageAngles,
  };
}

const BATCH_SIZE = 500;

/**
 * Deletes the `lotNumber:*` and `watchers:*` counters, which are scoped to
 * lots and auctions that no longer exist after a lots/auctions clear.
 *
 * @param ctx - Mutation context.
 */
async function clearLotScopedCounters(ctx: MutationCtx): Promise<void> {
  for (const [from, to] of [
    ["lotNumber:", "lotNumber;"],
    ["watchers:", "watchers;"],
    ["views:", "views;"],
    ["anonviews:", "anonviews;"],
  ] as const) {
    let batch = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.gte("name", from).lt("name", to))
      .take(BATCH_SIZE);
    while (batch.length > 0) {
      await Promise.all(batch.map((c) => ctx.db.delete("counters", c._id)));
      batch = await ctx.db
        .query("counters")
        .withIndex("by_name", (q) => q.gte("name", from).lt("name", to))
        .take(BATCH_SIZE);
    }
  }
}

/**
 * Resets the lotFees counter to zero after clearing the table.
 * Ensures consistency between cleared lotFees rows and aggregate counters.
 *
 * @param ctx - Mutation context.
 */
async function resetLotFeeCounters(ctx: MutationCtx): Promise<void> {
  const counter = await ctx.db
    .query("counters")
    .withIndex("by_name", (q) => q.eq("name", "lotFees"))
    .unique();

  if (counter) {
    await ctx.db.patch("counters", counter._id, {
      buyerTotal: 0,
      sellerTotal: 0,
      updatedAt: Date.now(),
    });
  }
}

const MOCK_SELLER_EMAIL = "mock-seller@farm.com";
const MOCK_ADMIN_EMAIL = "admin@agribid.com";

/**
 * userId used for the synthetic mock-seller profile recreated by the weekly
 * reset. It is display-only and can never authenticate.
 */
const MOCK_SELLER_FALLBACK_USER_ID = "mock-seller";

/** Synthetic buyer identities that bid on, watch and discuss mock lots. */
const MOCK_BUYER_IDS = [
  "mock-buyer-1",
  "mock-buyer-2",
  "mock-buyer-3",
  "mock-buyer-4",
  "mock-buyer-5",
  "mock-buyer-6",
];

const MOCK_BUYER_PROFILES = [
  {
    userId: "mock-buyer-1",
    name: "Amelia Mokoena",
    email: "mock-buyer-1@agribid.demo",
    createdDaysAgo: 120,
  },
  {
    userId: "mock-buyer-2",
    name: "Thabo Nkosi",
    email: "mock-buyer-2@agribid.demo",
    createdDaysAgo: 110,
  },
  {
    userId: "mock-buyer-3",
    name: "Sarah Bennett",
    email: "mock-buyer-3@agribid.demo",
    createdDaysAgo: 95,
  },
  {
    userId: "mock-buyer-4",
    name: "Pieter van der Merwe",
    email: "mock-buyer-4@agribid.demo",
    createdDaysAgo: 80,
  },
  {
    userId: "mock-buyer-5",
    name: "Lucy Chen",
    email: "mock-buyer-5@agribid.demo",
    createdDaysAgo: 65,
  },
  {
    userId: "mock-buyer-6",
    name: "David Okafor",
    email: "mock-buyer-6@agribid.demo",
    createdDaysAgo: 50,
  },
];

const MOCK_EXTRA_SELLER_PROFILES = [
  {
    userId: "mock-seller-2",
    name: "Greenfield Agri Imports",
    email: "mock-seller-2@agribid.demo",
    location: "Bloemfontein, ZA",
    bio: "Importer and reseller of quality pre-owned agricultural equipment.",
    createdDaysAgo: 200,
    sellerType: "dealer",
    vatRegistered: true,
  },
  {
    userId: "mock-seller-3",
    name: "Highveld Machinery Co",
    email: "mock-seller-3@agribid.demo",
    location: "Pretoria, ZA",
    bio: "Family-run machinery dealership serving Highveld farmers since 1994.",
    createdDaysAgo: 150,
    sellerType: "dealer",
    vatRegistered: true,
  },
  {
    // The private (non-VAT) seller of the demo: Malmesbury farmer.
    userId: "mock-seller-4",
    name: "Koos Steyn",
    email: "mock-seller-4@agribid.demo",
    location: "Malmesbury, ZA",
    bio: "Wheat and canola farmer in the Swartland selling surplus machinery.",
    createdDaysAgo: 90,
    sellerType: "private_farmer",
    vatRegistered: false,
  },
] satisfies {
  userId: string;
  name: string;
  email: string;
  location: string;
  bio: string;
  createdDaysAgo: number;
  sellerType: SellerType;
  vatRegistered: boolean;
}[];

/**
 * Seller type and VAT status for the Clerk-synced mock seller (a VAT-registered
 * farming business). Applied only while the real profile has none, so an
 * admin- or seller-set value is never overwritten.
 */
const MOCK_PRIMARY_SELLER_VAT: {
  sellerType: SellerType;
  vatRegistered: boolean;
} = { sellerType: "farming_business", vatRegistered: true };

/**
 * Default fee snapshot used for every seeded auction event. The buyer premium
 * is a fraction (0.12 = 12%), matching `DEFAULT_BUYER_PREMIUM_PCT` (12).
 */
const MOCK_DEFAULT_BUYER_PREMIUM_PCT = 0.12;
const MOCK_DEFAULT_SELLER_COMMISSION_PCT = 0.05;

/**
 * One scheduled sale container. Lots reference it via `auctionEventSeedId`.
 * Mirrors the `auctions` (container) table shape from `convex/schema.ts`.
 */
interface MockAuctionEvent {
  seedId: string;
  title: string;
  description: string;
  status: "draft" | "published" | "closed";
  startTime: number;
  endTime: number;
}

/** One piece of equipment. Mirrors the `lots` table shape. */
interface MockLot {
  seedId: string;
  title: string;
  categoryId: Id<"equipmentCategories">;
  make: string;
  model: string;
  year: number;
  operatingHours: number;
  location: string;
  description: string;
  reservePrice: number;
  startingPrice: number;
  currentPrice: number;
  minIncrement: number;
  settledAt?: number;
  winnerId?: string | null;
  sellerId: string;
  status:
    | "draft"
    | "pending_review"
    | "approved"
    | "assigned"
    | "sold"
    | "unsold"
    | "rejected";
  /** seedId of the MockAuctionEvent this lot belongs to, or undefined if unassigned. */
  auctionEventSeedId?: string;
  images: {
    front: string;
    engine?: string;
    cabin?: string;
    additional: string[];
  };
  /** Province the machine is in; defaults to a cycled province when absent. */
  province?: Province;
  powerKw?: number;
  drive?: Drive;
  transmission?: string;
  frontTyrePct?: number;
  rearTyrePct?: number;
  serialNumber?: string;
  /** Photo URL -> shot-list angle caption. */
  imageAngles?: Record<string, PhotoAngle>;
}

interface MockBidPlan {
  bids: { bidderId: string; amount: number }[];
  windowStart: number;
  windowEnd: number;
}

interface MockMessagePlan {
  sender: "buyer" | "seller";
  content: string;
  isRead: boolean;
  hoursAfterStart: number;
}

/**
 * Ascending bid amounts for every live/scheduled mock lot. The last amount of
 * each list equals that lot's `currentPrice` and every step respects the
 * lot's `minIncrement`.
 */
const ACTIVE_BID_AMOUNTS: Record<string, number[]> = {
  "mf-455-xtra-4x4": [110000, 115000, 120000],
  "nh-8030": [95000, 100000],
  "nh-t6070": [350000, 375000, 400000],
  "nh-td5-110-4x4": [180000, 185000],
  "mf-440-4x4": [90000, 95000],
  "mf-399-se-4x4": [130000, 135000, 140000],
  "mf-290": [100000, 102500],
  "jd-5725": [120000, 125000],
  "mf-165": [75000, 77500, 80000],
  "ford-5000": [40000, 42000],
  "farmtrac-80": [45000, 46000],
  "mf-440": [85000, 87500],
  "case-axial-flow-8250": [224000, 230000, 236000],
  "jd-r4038": [173500, 178500, 184000],
  "case-early-riser-2150": [97000, 100000, 103000],
  "case-ecolo-tiger-875": [41500, 43000, 44500],
  "nh-speedrower-260": [56500, 58000, 59500, 61000],
  "jcb-541-70": [72000, 75000, 78000],
  "bell-l1206e": [123500, 127000, 130500, 134000],
};

/** Winning bid sequences for sold lots; the last bid is the winner. */
const SOLD_BID_PLANS: {
  seedId: string;
  bids: { bidderId: string; amount: number }[];
}[] = [
  {
    seedId: "jd-s780",
    bids: [
      { bidderId: "mock-buyer-2", amount: 185000 },
      { bidderId: "mock-buyer-3", amount: 195000 },
      { bidderId: "mock-buyer-1", amount: 205000 },
    ],
  },
  {
    seedId: "jd-1775nt",
    bids: [
      { bidderId: "mock-buyer-3", amount: 82000 },
      { bidderId: "mock-buyer-4", amount: 88000 },
      { bidderId: "mock-buyer-5", amount: 92000 },
      { bidderId: "mock-buyer-2", amount: 96000 },
    ],
  },
  {
    seedId: "cat-320-gc",
    bids: [
      { bidderId: "mock-buyer-4", amount: 102000 },
      { bidderId: "mock-buyer-5", amount: 110000 },
      { bidderId: "mock-buyer-6", amount: 114000 },
      { bidderId: "mock-buyer-3", amount: 118000 },
    ],
  },
];

/** Reviews left by the winning buyers of sold mock lots. */
const REVIEW_PLANS: {
  seedId: string;
  reviewerId: string;
  rating: number;
  comment: string;
  daysAfterSettlement: number;
  response?: { text: string; daysAfterReview: number };
}[] = [
  {
    seedId: "jd-s780",
    reviewerId: "mock-buyer-1",
    rating: 5,
    comment:
      "Outstanding combine — ran flawlessly through the entire harvest. " +
      "The seller was transparent about the service history from the first message.",
    daysAfterSettlement: 1,
    response: {
      text:
        "Thank you! A pleasure to deal with — prompt payment and clear " +
        "communication throughout.",
      daysAfterReview: 1,
    },
  },
  {
    seedId: "jd-1775nt",
    reviewerId: "mock-buyer-2",
    rating: 4,
    comment:
      "Solid planter, exactly as described. Pickup coordination took a day " +
      "longer than planned, but the seller kept me informed throughout.",
    daysAfterSettlement: 2,
  },
  {
    seedId: "cat-320-gc",
    reviewerId: "mock-buyer-3",
    rating: 3,
    comment:
      "Machine matched the listing overall, but undercarriage wear was " +
      "higher than the photos suggested.",
    daysAfterSettlement: 1,
  },
];

/** Mock buyers watching live mock lots. */
const WATCHLIST_PLANS: { userId: string; seedId: string }[] = [
  { userId: "mock-buyer-1", seedId: "case-axial-flow-8250" },
  { userId: "mock-buyer-2", seedId: "mf-455-xtra-4x4" },
  { userId: "mock-buyer-3", seedId: "jcb-541-70" },
  { userId: "mock-buyer-4", seedId: "nh-speedrower-260" },
  { userId: "mock-buyer-5", seedId: "bell-l1206e" },
  { userId: "mock-buyer-6", seedId: "jd-r4038" },
  // Extra watchers so the watcher count shows more than 1 on popular lots.
  { userId: "mock-buyer-2", seedId: "case-axial-flow-8250" },
  { userId: "mock-buyer-3", seedId: "case-axial-flow-8250" },
  { userId: "mock-buyer-4", seedId: "case-axial-flow-8250" },
  { userId: "mock-buyer-1", seedId: "mf-455-xtra-4x4" },
  { userId: "mock-buyer-5", seedId: "mf-455-xtra-4x4" },
];

/** Response times cycled across seeded sellers so every copy variant shows. */
const MOCK_SELLER_RESPONSE_TIMES: readonly SellerResponseTime[] =
  SELLER_RESPONSE_TIMES;

/** Sentinel standing in for the live mock seller's Clerk-synced userId. */
const MOCK_SELLER_KEY = "mock-seller";

const CONVERSATION_PLANS: {
  buyerId: string;
  /** {@link MOCK_SELLER_KEY} or a synthetic seller userId. */
  sellerId: string;
  lotSeedId: string;
  startedDaysAgo: number;
  messages: MockMessagePlan[];
}[] = [
  {
    buyerId: "mock-buyer-1",
    sellerId: "mock-seller-2",
    lotSeedId: "jd-s780",
    startedDaysAgo: 2,
    messages: [
      {
        sender: "buyer",
        content: "Hi! I won the S780 — when can we arrange collection?",
        isRead: true,
        hoursAfterStart: 0,
      },
      {
        sender: "seller",
        content:
          "Congratulations! Any weekday next week works — I'll send exact directions once we pick a day.",
        isRead: true,
        hoursAfterStart: 3,
      },
      {
        sender: "buyer",
        content:
          "Tuesday morning suits me. Does the price include the header trailer?",
        isRead: true,
        hoursAfterStart: 20,
      },
      {
        sender: "seller",
        content: "Yes, the trailer is included. See you Tuesday at 9.",
        isRead: false,
        hoursAfterStart: 26,
      },
    ],
  },
  {
    buyerId: "mock-buyer-4",
    sellerId: "mock-seller-3",
    lotSeedId: "nh-speedrower-260",
    startedDaysAgo: 3,
    messages: [
      {
        sender: "buyer",
        content: "Is the Speedrower available for inspection this week?",
        isRead: true,
        hoursAfterStart: 0,
      },
      {
        sender: "seller",
        content:
          "Yes — weekday afternoons work. Bring your mechanic if you'd like.",
        isRead: true,
        hoursAfterStart: 4,
      },
      {
        sender: "buyer",
        content:
          "Great, planning Thursday. Any known wear on the knife sections?",
        isRead: false,
        hoursAfterStart: 30,
      },
    ],
  },
  {
    buyerId: "mock-buyer-6",
    sellerId: MOCK_SELLER_KEY,
    lotSeedId: "jd-r4038",
    startedDaysAgo: 1,
    messages: [
      {
        sender: "buyer",
        content:
          "What's the boom width on the R4038, and is AimCommand fitted?",
        isRead: true,
        hoursAfterStart: 0,
      },
      {
        sender: "seller",
        content:
          "120-foot carbon-fibre boom with AimCommand Flex and individual nozzle shutoffs.",
        isRead: true,
        hoursAfterStart: 2,
      },
      {
        sender: "buyer",
        content: "Nice. Any rust history on the tank?",
        isRead: false,
        hoursAfterStart: 6,
      },
      {
        sender: "seller",
        content:
          "None — stainless tank, always shedded. Happy to share close-up photos.",
        isRead: false,
        hoursAfterStart: 7,
      },
    ],
  },
];

/**
 * Enforces that destructive operations are permitted only for admin callers,
 * when a valid SEED_SECRET is provided, or in local development with an explicit opt-in.
 *
 * IMPORTANT: Preview deployments (VERCEL_ENV=preview) are NOT trusted. Admin auth or
 * SEED_SECRET is required in every environment except local dev with ALLOW_DEV_SEED=true.
 *
 * @param ctx - Mutation context used to determine the caller's role for access validation.
 * @returns The access path used ("admin" | "secret" | "dev") for audit logging.
 * @throws Error if the caller is not authorized and no valid secret or dev opt-in is present.
 */
async function checkDestructiveAccess(
  ctx: MutationCtx
): Promise<DestructiveAccessPath> {
  const nodeEnv = process.env.NODE_ENV;
  const role = await getCallerRole(ctx);
  const isAdmin = role === "admin";

  if (isAdmin) {
    return "admin";
  }

  const allowDevSeed = process.env.ALLOW_DEV_SEED === "true";
  const isDev = nodeEnv === "development";

  if (isDev && allowDevSeed) {
    return "dev";
  }

  throw new Error(
    "Unauthorized: Destructive seed operations require admin authentication, " +
      "a valid SEED_SECRET, or local development with ALLOW_DEV_SEED=true. " +
      `Current environment: NODE_ENV=${nodeEnv ?? "undefined"}, ` +
      `ALLOW_DEV_SEED=${allowDevSeed ? "true" : "false"}.`
  );
}

/**
 * Batch-deletes every row from a table using the shared batched pattern.
 *
 * @param ctx - Mutation context used for the queries and deletes.
 * @param tableName - Table to clear.
 * @returns The number of rows deleted.
 */
async function clearTable(
  ctx: MutationCtx,
  tableName: SeedTableNames
): Promise<number> {
  let deletedCount = 0;
  let batch = await ctx.db.query(tableName).take(BATCH_SIZE);
  while (batch.length > 0) {
    await Promise.all(batch.map((item) => ctx.db.delete(tableName, item._id)));
    deletedCount += batch.length;
    batch = await ctx.db.query(tableName).take(BATCH_SIZE);
  }
  return deletedCount;
}

/**
 * Deletes a profile's KYC document blobs from storage, then deletes the
 * profile row itself.
 *
 * @param ctx - Mutation context used for the storage and row deletes.
 * @param profile - The profile to delete.
 */
async function deleteProfileWithKYCStorage(
  ctx: MutationCtx,
  profile: Doc<"profiles">
): Promise<void> {
  for (const documentId of profile.kycDocuments ?? []) {
    await safeDelete(ctx, documentId, "kyc document");
  }
  await ctx.db.delete("profiles", profile._id);
}

/**
 * Batch-deletes every lot, removing the storage blobs it references
 * (images and condition report) first so no orphaned files are left behind.
 *
 * @param ctx - Mutation context used for the queries and deletes.
 * @returns The number of lots deleted.
 */
async function clearLotsTableWithStorage(ctx: MutationCtx): Promise<number> {
  let deletedCount = 0;
  let batch = await ctx.db.query("lots").take(BATCH_SIZE);
  while (batch.length > 0) {
    await Promise.all(
      batch.map(async (lot) => {
        await deleteAuctionImages(ctx, lot.images);
        if (lot.conditionReportUrl) {
          await safeDelete(ctx, lot.conditionReportUrl, "condition report");
        }
        if (lot.coldStartVideo) {
          await safeDelete(ctx, lot.coldStartVideo, "cold start video");
        }
        await ctx.db.delete("lots", lot._id);
      })
    );
    deletedCount += batch.length;
    batch = await ctx.db.query("lots").take(BATCH_SIZE);
  }
  return deletedCount;
}

/**
 * Batch-deletes every auction container, removing its referenced banner-image
 * blob first so no orphaned files are left behind.
 *
 * @param ctx - Mutation context used for the queries and deletes.
 * @returns The number of auctions deleted.
 */
async function clearAuctionsTableWithStorage(
  ctx: MutationCtx
): Promise<number> {
  let deletedCount = 0;
  let batch = await ctx.db.query("auctions").take(BATCH_SIZE);
  while (batch.length > 0) {
    await Promise.all(
      batch.map(async (auction) => {
        if (auction.bannerImage) {
          await safeDelete(ctx, auction.bannerImage, "auction banner image");
        }
        await ctx.db.delete("auctions", auction._id);
      })
    );
    deletedCount += batch.length;
    batch = await ctx.db.query("auctions").take(BATCH_SIZE);
  }
  return deletedCount;
}

/**
 * Batch-deletes every profile, removing referenced KYC document blobs first
 * so no orphaned files are left behind. Admin profiles are NOT preserved —
 * use {@link deleteNonAdminProfiles} when they must be.
 *
 * @param ctx - Mutation context used for the queries and deletes.
 * @returns The number of profiles deleted.
 */
async function clearProfilesTableWithStorage(
  ctx: MutationCtx
): Promise<number> {
  let deletedCount = 0;
  let batch = await ctx.db.query("profiles").take(BATCH_SIZE);
  while (batch.length > 0) {
    await Promise.all(
      batch.map(async (profile) => deleteProfileWithKYCStorage(ctx, profile))
    );
    deletedCount += batch.length;
    batch = await ctx.db.query("profiles").take(BATCH_SIZE);
  }
  return deletedCount;
}

/**
 * Deletes every profile whose role is not "admin".
 * Each non-admin profile's KYC document blobs are removed from storage before
 * the profile row itself is deleted, so no orphaned files are left behind.
 * Admin profiles are never touched.
 *
 * @param ctx - Mutation context used for the queries and deletes.
 * @returns The number of profiles deleted.
 */
async function deleteNonAdminProfiles(ctx: MutationCtx): Promise<number> {
  const allProfiles = await ctx.db.query("profiles").collect();
  const nonAdminProfiles = allProfiles.filter(
    (profile) => profile.role !== "admin"
  );

  for (let i = 0; i < nonAdminProfiles.length; i += BATCH_SIZE) {
    const batch = nonAdminProfiles.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((profile) => deleteProfileWithKYCStorage(ctx, profile))
    );
  }

  return nonAdminProfiles.length;
}

/**
 * Ensures a profile exists for the mock seller email so `performSeed`'s
 * Clerk-dependent lookup can resolve it.
 *
 * `runSeed` still requires the profile to have been created by a real Clerk
 * sign-in (see the pr254 review fix), but the weekly cron reset deletes all
 * non-admin profiles — including the mock seller's. This recreates a
 * synthetic, display-only stand-in so consecutive resets keep working.
 *
 * @param ctx - Mutation context.
 */
async function ensureMockSellerProfile(ctx: MutationCtx): Promise<void> {
  const existing = await ctx.db
    .query("profiles")
    .filter((q) => q.eq(q.field("email"), MOCK_SELLER_EMAIL))
    .first();
  if (existing) return;

  const now = Date.now();
  await ctx.db.insert("profiles", {
    userId: MOCK_SELLER_FALLBACK_USER_ID,
    name: "Mock Seller",
    email: MOCK_SELLER_EMAIL,
    role: "seller",
    isVerified: true,
    kycStatus: "verified",
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Inserts a realistic ascending bid history for one lot (skipped when the
 * lot already has bids, keeping reseeds idempotent). Timestamps are
 * spread evenly between `windowStart` and `windowEnd`.
 *
 * @param ctx - Mutation context.
 * @param lot - The lot to seed bids for.
 * @param plan - Bid amounts, bidders and the time window to spread over.
 */
async function seedMockBids(
  ctx: MutationCtx,
  lot: Doc<"lots">,
  plan: MockBidPlan
): Promise<void> {
  const existingBid = await ctx.db
    .query("bids")
    .withIndex("by_lot", (q) => q.eq("lotId", lot._id))
    .first();
  if (existingBid) return;

  const count = plan.bids.length;
  let position = 0;
  for (const bid of plan.bids) {
    position += 1;
    const fraction = position / count;
    const timestamp = Math.round(
      plan.windowStart + (plan.windowEnd - plan.windowStart) * fraction
    );
    await ctx.db.insert("bids", {
      lotId: lot._id,
      bidderId: bid.bidderId,
      amount: bid.amount,
      timestamp,
      status: "valid",
    });
  }
}

/**
 * Inserts the default VAT rate when none has been set.
 *
 * Deliberately seeds nothing under `business.*`: those keys feed the public
 * footer and SEO data, and `weeklyReset` also runs against production, so a
 * seed must never invent a registration, VAT, phone or address. Admins enter
 * real company details on `/admin/business-info`.
 *
 * Never overwrites an existing value.
 *
 * @param ctx - Mutation context.
 * @param now - Timestamp for `updatedAt`.
 */
async function seedPublicSettings(
  ctx: MutationCtx,
  now: number
): Promise<void> {
  const existing = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", "vat_rate_pct"))
    .unique();
  if (!existing) {
    await ctx.db.insert("settings", {
      key: "vat_rate_pct",
      value: 15,
      description: "VAT rate (percent) shown in buyer fee estimates (0-100)",
      updatedAt: now,
    });
  }
}

/**
 * Inserts one setting row when its key is absent. Never overwrites.
 *
 * @param ctx - Mutation context.
 * @param now - Timestamp for `updatedAt`.
 * @param key - Setting key.
 * @param value - Value to store when absent.
 * @param description - Row description.
 */
async function insertSettingIfAbsent(
  ctx: MutationCtx,
  now: number,
  key: string,
  value: string | number | boolean,
  description: string
): Promise<void> {
  const existing = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (!existing) {
    await ctx.db.insert("settings", {
      key,
      value,
      description,
      updatedAt: now,
    });
  }
}

/**
 * Seeds the platform settings owned by `convex/admin/platformSettings.ts`
 * (buyer premium, registration deposit, seller costs, minimum photos) with
 * their built-in defaults, so the admin screen shows real rows. These equal
 * the values the app already falls back to, so seeding them changes no
 * behaviour. Insert-if-absent only: admin-set values are never overwritten.
 *
 * @param ctx - Mutation context.
 * @param now - Timestamp for `updatedAt`.
 */
async function seedPlatformSettingDefaults(
  ctx: MutationCtx,
  now: number
): Promise<void> {
  const rows: [string, string | number | boolean, string][] = [
    [
      "buyer_premium_pct",
      DEFAULT_BUYER_PREMIUM_PCT,
      "Default buyer's premium (percent, 0-100) for auctions without their own",
    ],
    [
      "deposit_enabled",
      DEFAULT_DEPOSIT_ENABLED,
      "Whether a registration deposit is required",
    ],
    [
      "deposit_amount",
      DEFAULT_DEPOSIT_AMOUNT,
      "Registration deposit in rand (0-1,000,000)",
    ],
    [
      "deposit_refund_days",
      DEFAULT_DEPOSIT_REFUND_DAYS,
      "Days to refund a registration deposit (1-30)",
    ],
    [
      "seller_commission_pct",
      DEFAULT_SELLER_COMMISSION_PCT,
      "Seller commission (percent, display only)",
    ],
    [
      "seller_listing_fee",
      DEFAULT_SELLER_LISTING_FEE,
      "Seller listing fee in rand",
    ],
    [
      "seller_payout_days",
      DEFAULT_SELLER_PAYOUT_DAYS,
      "Days until seller payout (1-60)",
    ],
    [
      "min_photos_per_lot",
      DEFAULT_MIN_PHOTOS_PER_LOT,
      "Minimum photos required per lot (1-30)",
    ],
  ];
  for (const [key, value, description] of rows) {
    await insertSettingIfAbsent(ctx, now, key, value, description);
  }
}

/**
 * DEMO finance contact (name, company, phone). These are invented showcase
 * values copied from the design mockups; they are NOT real company details and
 * every row is labelled "DEMO" in its description so an admin can spot and
 * replace it on the admin settings screen.
 */
const DEMO_FINANCE_CONTACT: [string, string][] = [
  ["finance_contact_name", "Lee-Anne Vermeulen"],
  ["finance_contact_company", "com-fin"],
  ["finance_contact_phone", "083 277 0178"],
];

/**
 * Seeds the DEMO finance contact, insert-if-absent. Only the demo seed
 * (`runSeed`) calls this. `weeklyReset` runs against the production showcase
 * and must never invent company or contact details, so it skips it.
 *
 * @param ctx - Mutation context.
 * @param now - Timestamp for `updatedAt`.
 */
async function seedDemoFinanceContact(
  ctx: MutationCtx,
  now: number
): Promise<void> {
  for (const [key, value] of DEMO_FINANCE_CONTACT) {
    await insertSettingIfAbsent(
      ctx,
      now,
      key,
      value,
      "DEMO value for the showcase, not a real contact. Replace in admin settings."
    );
  }
}

/**
 * Populates the database with the full showcase dataset: categories, equipment
 * metadata, mock users, auction events, lots, and every related record (bids,
 * proxy bids, reviews, lot fees, watchlist, conversations, notifications,
 * support tickets, user activity and moderation flags), followed by FAQ and
 * counters.
 *
 * Idempotent: rows with a natural unique key (categories, metadata, profiles,
 * lots, bids, reviews, watchlist, conversations, proxy bids, lot fees)
 * are only inserted when absent. Records without one (notifications, support
 * tickets, user activity, flags) are only seeded while their table is empty.
 * Auction event containers are looked up by a manual `seedId` scan (the
 * `auctions` table has no `by_seedId` index; this only runs during seeding,
 * over a handful of rows, so a `.collect()` + `.find()` is fine).
 *
 * @param ctx - Mutation context.
 * @param options - Seed options.
 * @param options.demoFinanceContact - Seed the DEMO finance contact settings.
 * True only for the explicit demo seed (`runSeed`); `weeklyReset` passes false
 * because it also runs on the production showcase, where nothing may be
 * invented about the company or its contacts.
 */
async function performSeed(
  ctx: MutationCtx,
  options: { demoFinanceContact: boolean }
): Promise<void> {
  const now = Date.now();

  await seedPublicSettings(ctx, now);
  await seedPlatformSettingDefaults(ctx, now);
  if (options.demoFinanceContact) {
    await seedDemoFinanceContact(ctx, now);
  }

  // 0. Seed Categories
  const categories = [
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
  ];

  const categoryIds = new Map<string, Id<"equipmentCategories">>();

  for (const catName of categories) {
    const existing = await ctx.db
      .query("equipmentCategories")
      .withIndex("by_name", (q) => q.eq("name", catName))
      .first();

    if (!existing) {
      const id = await ctx.db.insert("equipmentCategories", {
        name: catName,
        isActive: true,
      });
      categoryIds.set(catName, id);
    } else {
      categoryIds.set(catName, existing._id);
    }
  }

  /**
   * Helper to get a category ID by name, throwing if not found.
   * @param name - The category name.
   * @returns The category ID.
   */
  const getCategoryId = (name: string): Id<"equipmentCategories"> => {
    const id = categoryIds.get(name);
    if (!id) {
      throw new Error(`Missing category "${name}" during seeding`);
    }
    return id;
  };

  // 1. Seed Equipment Metadata (Extensive list for Southern Africa)
  const metadataItems = [
    // Tractors
    {
      make: "John Deere",
      category: "Tractor",
      models: [
        "5075E",
        "6120M",
        "6155M",
        "6155R",
        "7R 330",
        "8R 410",
        "9R 640",
      ],
    },
    {
      make: "Case IH",
      category: "Tractor",
      models: ["JX95", "Farmall 110", "Puma 155", "Magnum 340", "Steiger 620"],
    },
    {
      make: "Massey Ferguson",
      category: "Tractor",
      models: ["MF 375", "MF 4708", "MF 6713", "MF 7720 S", "MF 8S.265"],
    },
    {
      make: "New Holland",
      category: "Tractor",
      models: ["TD5.90", "T6.140", "T7.270", "T8.435"],
    },
    {
      make: "Landini",
      category: "Tractor",
      models: ["Super 8860", "Landforce 125", "7-230"],
    },
    {
      make: "McCormick",
      category: "Tractor",
      models: ["B-Max 105", "G-Max 135", "X7.660"],
    },
    {
      make: "Kubota",
      category: "Tractor",
      models: ["L45", "M7172", "M108S"],
    },
    {
      make: "Valtra",
      category: "Tractor",
      models: ["A95", "T194", "S394"],
    },
    {
      make: "Fendt",
      category: "Tractor",
      models: ["724 Vario", "1050 Vario"],
    },
    {
      make: "Deutz-Fahr",
      category: "Tractor",
      models: ["Agrolux 90", "Agrotron 6165", "9340 TTV"],
    },
    {
      make: "Ford",
      category: "Tractor",
      models: ["4100", "6610", "TW-35"],
    },

    // Combines
    {
      make: "John Deere",
      category: "Combine",
      models: ["S770", "S780", "S790"],
    },
    {
      make: "Case IH",
      category: "Combine",
      models: ["Axial-Flow 7250", "Axial-Flow 8250", "Axial-Flow 9250"],
    },
    {
      make: "Claas",
      category: "Combine",
      models: ["Lexion 760", "Lexion 8800", "Tucano 580"],
    },
    {
      make: "New Holland",
      category: "Combine",
      models: ["CR7.90", "CR10.90"],
    },

    // Sprayers
    {
      make: "John Deere",
      category: "Sprayer",
      models: ["R4030", "R4038", "R4045"],
    },
    {
      make: "Case IH",
      category: "Sprayer",
      models: ["Patriot 3230", "Patriot 4430"],
    },
    {
      make: "Apache",
      category: "Sprayer",
      models: ["AS1020", "AS1220"],
    },
    {
      make: "Jacto",
      category: "Sprayer",
      models: ["Uniport 2530", "Uniport 3030"],
    },

    // Planters
    {
      make: "Equalizer",
      category: "Planter/Seeder",
      models: ["12000 Series", "24000 Series", "C-Series"],
    },
    {
      make: "John Deere",
      category: "Planter/Seeder",
      models: ["1755", "1775NT", "DB60"],
    },
    {
      make: "Case IH",
      category: "Planter/Seeder",
      models: ["Early Riser 1255", "Early Riser 2150"],
    },

    // Telehandlers / Loaders
    {
      make: "JCB",
      category: "Telehandler",
      models: ["531-70", "541-70", "560-80"],
    },
    {
      make: "Manitou",
      category: "Telehandler",
      models: ["MLT 737", "MLT 840"],
    },
    {
      make: "Bell",
      category: "Loader",
      models: ["220G Logger", "L1206E Loader"],
    },
  ];

  for (const item of metadataItems) {
    const categoryId = getCategoryId(item.category);

    // Try to find by make AND categoryId first
    let existing = await ctx.db
      .query("equipmentMetadata")
      .withIndex("by_make", (q) => q.eq("make", item.make))
      .filter((q) => q.eq(q.field("categoryId"), categoryId))
      .first();

    // If not found, try to find by make alone (legacy cleanup)
    if (!existing) {
      const byMake = await ctx.db
        .query("equipmentMetadata")
        .withIndex("by_make", (q) => q.eq("make", item.make))
        .collect();
      existing = byMake.find((m) => !m.categoryId) ?? null;
    }

    const metadataData = {
      make: item.make,
      models: item.models,
      categoryId,
      isActive: true,
      updatedAt: now,
    };

    if (!existing) {
      await ctx.db.insert("equipmentMetadata", metadataData);
    } else {
      await ctx.db.patch("equipmentMetadata", existing._id, {
        categoryId, // Ensure it's linked to the new category
        isActive: true, // Ensure it's active
        models: Array.from(new Set([...existing.models, ...item.models])),
        updatedAt: now,
      });
    }
  }

  // 2. Resolve the Mock Seller Profile (Clerk-dependent)
  // Note: with Clerk, a profile only exists once its owner has signed in at
  // least once (syncUser creates it on first login) — this seed step only
  // promotes an already-synced profile matching the mock email, it cannot
  // provision a brand-new Clerk identity. The weekly cron reset recreates a
  // synthetic stand-in (see ensureMockSellerProfile) so this lookup keeps
  // succeeding there.
  const sellerProfile = await ctx.db
    .query("profiles")
    .filter((q) => q.eq(q.field("email"), MOCK_SELLER_EMAIL))
    .first();

  if (!sellerProfile) {
    throw new Error(
      `Mock seller profile not found. Sign in as ${MOCK_SELLER_EMAIL} via Clerk first, then re-run the seed.`
    );
  }

  const sellerId: string = sellerProfile.userId;

  if (sellerProfile.role !== "seller") {
    await ctx.db.patch("profiles", sellerProfile._id, {
      role: "seller",
      isVerified: true,
      updatedAt: now,
    });
  }

  // The mock seller is a VAT-registered farming business. Applied only while
  // the profile has no seller type, so a value set by the seller or an admin
  // is never overwritten.
  if (
    sellerProfile.sellerType === undefined ||
    sellerProfile.vatRegistered === undefined
  ) {
    await ctx.db.patch("profiles", sellerProfile._id, {
      ...(sellerProfile.sellerType === undefined && {
        sellerType: MOCK_PRIMARY_SELLER_VAT.sellerType,
      }),
      ...(sellerProfile.vatRegistered === undefined && {
        vatRegistered: MOCK_PRIMARY_SELLER_VAT.vatRegistered,
      }),
      updatedAt: now,
    });
  }

  // 2.5. Promote Mock Admin User Profile (Idempotent)
  const adminProfile = await ctx.db
    .query("profiles")
    .filter((q) => q.eq(q.field("email"), MOCK_ADMIN_EMAIL))
    .first();

  if (adminProfile && adminProfile.role !== "admin") {
    await ctx.db.patch("profiles", adminProfile._id, {
      role: "admin",
      isVerified: true,
      updatedAt: now,
    });
  }

  // The auction events created below need a `createdBy` admin userId; fall
  // back to the mock admin's email-derived id, or a system placeholder if no
  // admin profile has synced yet (mirrors the migration's `system:migration`
  // convention for system-authored rows).
  const auctionEventCreatorId = adminProfile?.userId ?? "system:seed";

  // 2.75. Insert Synthetic Mock Users (display-only, bypassing Clerk sign-in)
  for (const buyer of MOCK_BUYER_PROFILES) {
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", buyer.userId))
      .unique();
    if (existing) continue;

    await ctx.db.insert("profiles", {
      userId: buyer.userId,
      name: buyer.name,
      email: buyer.email,
      role: "buyer",
      isVerified: true,
      kycStatus: "verified",
      createdAt: now - buyer.createdDaysAgo * MS_PER_DAY,
      updatedAt: now,
    });
  }

  for (const seller of MOCK_EXTRA_SELLER_PROFILES) {
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", seller.userId))
      .unique();
    if (existing) {
      // Synthetic profile from an earlier seed: backfill the VAT fields only.
      if (
        existing.sellerType === undefined ||
        existing.vatRegistered === undefined
      ) {
        await ctx.db.patch("profiles", existing._id, {
          ...(existing.sellerType === undefined && {
            sellerType: seller.sellerType,
          }),
          ...(existing.vatRegistered === undefined && {
            vatRegistered: seller.vatRegistered,
          }),
        });
      }
      continue;
    }

    await ctx.db.insert("profiles", {
      userId: seller.userId,
      name: seller.name,
      email: seller.email,
      role: "seller",
      isVerified: true,
      kycStatus: "verified",
      location: seller.location,
      bio: seller.bio,
      sellerType: seller.sellerType,
      vatRegistered: seller.vatRegistered,
      createdAt: now - seller.createdDaysAgo * MS_PER_DAY,
      updatedAt: now,
    });
  }

  // 2.8. Seed Platform Fees (only when the table is empty)
  const existingFee = await ctx.db.query("platformFees").first();
  if (!existingFee) {
    await ctx.db.insert("platformFees", {
      name: "Seller Commission",
      description: "Percentage fee charged to sellers on successful sales.",
      feeType: "percentage",
      // Percentage fee values are fractions (0.05 = 5%).
      value: 0.05,
      appliesTo: "seller",
      isActive: true,
      visibleToBuyer: true,
      visibleToSeller: true,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
    });
    // Inserted INACTIVE on purpose. Seeded lots carry an auction-sourced 12%
    // snapshot, which is the one buyer premium; an active buyer % row would be
    // ignored for them anyway. Keeping it inactive documents the rule (one
    // premium, never both) and lets an admin switch the platform to fee-row
    // premiums deliberately. The seeded lotFees ledger still references it.
    await ctx.db.insert("platformFees", {
      name: "Buyer's Premium",
      description:
        "Percentage premium added to the winning bid, paid by the buyer.",
      feeType: "percentage",
      value: DEFAULT_BUYER_PREMIUM_PCT / 100,
      appliesTo: "buyer",
      isActive: false,
      visibleToBuyer: true,
      visibleToSeller: true,
      sortOrder: 2,
      createdAt: now,
      updatedAt: now,
    });
  }

  // 3. Seed Auction Events (scheduled sale containers)
  const mockAuctionEvents: MockAuctionEvent[] = [
    {
      seedId: "harvest-clearance-august",
      title: "Harvest Equipment — August Clearance",
      description:
        "Closed sale of combines and planters from the August clearance round.",
      status: "closed",
      startTime: now - 13 * MS_PER_DAY,
      endTime: now - 2 * MS_PER_DAY,
    },
    {
      seedId: "construction-utility-september",
      title: "Construction & Utility — September Clearance",
      description:
        "Closed sale of excavation and utility equipment from the September clearance round.",
      status: "closed",
      startTime: now - 15 * MS_PER_DAY,
      endTime: now - 2 * MS_PER_DAY,
    },
    {
      seedId: "telehandler-closeout",
      title: "Telehandler Closeout",
      description: "Closed single-lot telehandler closeout sale.",
      status: "closed",
      startTime: now - 10 * MS_PER_DAY,
      endTime: now - MS_PER_DAY,
    },
    {
      seedId: "row-crop-tractor-sale",
      title: "Year-End Tractor Sale",
      description:
        "Live sale of tractors from We Buy Tractors and farm sellers across South Africa.",
      status: "published",
      startTime: now - 3 * MS_PER_DAY,
      endTime: now + 6 * MS_PER_DAY,
    },
    {
      seedId: "harvest-field-equipment-sale",
      title: "Harvest & Field Equipment Sale",
      description:
        "Live sale featuring combines, sprayers, planters, tillage and forage equipment.",
      status: "published",
      startTime: now - 3 * MS_PER_DAY,
      endTime: now + 6 * MS_PER_DAY,
    },
    {
      seedId: "material-handling-sale",
      title: "Material Handling Sale",
      description: "Live sale featuring telehandlers and wheel loaders.",
      status: "published",
      startTime: now - 4 * MS_PER_DAY,
      // Inside the Home "Closing soon" window (24 h) with room to spare, so
      // the strip shows for a day after each reset.
      endTime: now + 20 * MS_PER_HOUR,
    },
    {
      seedId: "row-crop-tractor-sale-next-round",
      title: "Row Crop Tractor Sale — Next Round",
      description:
        "Scheduled future sale. Bidding opens once the window starts — dev fixture for issue #296 (pre-start bidding gate).",
      status: "published",
      startTime: now + 2 * MS_PER_HOUR,
      endTime: now + 2 * MS_PER_HOUR + 4 * MS_PER_DAY,
    },
  ];

  for (const event of mockAuctionEvents) {
    const existingEvents = await ctx.db.query("auctions").collect();
    const existing = existingEvents.find((a) => a.title === event.title);

    if (!existing) {
      await ctx.db.insert("auctions", {
        title: event.title,
        description: event.description,
        startTime: event.startTime,
        endTime: event.endTime,
        status: event.status,
        defaultBuyerPremiumPct: MOCK_DEFAULT_BUYER_PREMIUM_PCT,
        defaultSellerCommissionPct: MOCK_DEFAULT_SELLER_COMMISSION_PCT,
        createdBy: auctionEventCreatorId,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch("auctions", existing._id, {
        description: event.description,
        startTime: event.startTime,
        endTime: event.endTime,
        status: event.status,
        defaultBuyerPremiumPct: MOCK_DEFAULT_BUYER_PREMIUM_PCT,
        defaultSellerCommissionPct: MOCK_DEFAULT_SELLER_COMMISSION_PCT,
        updatedAt: now,
      });
    }
  }

  // 3.1. Index the seeded auction events by their (title-matched) seedId for lot assignment
  const allEvents = await ctx.db.query("auctions").collect();
  const eventsByTitle = new Map<string, Doc<"auctions">>();
  for (const event of allEvents) {
    eventsByTitle.set(event.title, event);
  }
  const eventBySeedId = new Map<string, Doc<"auctions">>();
  for (const plan of mockAuctionEvents) {
    const doc = eventsByTitle.get(plan.title);
    if (!doc) {
      throw new Error(`Missing seeded auction event "${plan.seedId}"`);
    }
    eventBySeedId.set(plan.seedId, doc);
  }

  /**
   * Helper to look up a seeded auction event by its seedId, throwing if not found.
   * @param seedId - The stable seed identifier of the auction event.
   * @returns The auction event document.
   */
  const getEventBySeedId = (seedId: string): Doc<"auctions"> => {
    const event = eventBySeedId.get(seedId);
    if (!event) {
      throw new Error(`Missing seeded auction event "${seedId}"`);
    }
    return event;
  };

  /**
   * Builds a live-sale tractor lot (approved and assigned to the main sale)
   * with photos captioned along the fixed shot list.
   * @param spec - Lot fields plus the hot-linked photo URLs.
   * @returns The mock lot.
   */
  const liveTractor = (
    spec: Omit<
      MockLot,
      "categoryId" | "status" | "auctionEventSeedId" | "images" | "imageAngles"
    > & { photos: readonly string[] }
  ): MockLot => {
    const { photos, ...fields } = spec;
    return {
      ...fields,
      ...mockPhotoSet(photos),
      categoryId: getCategoryId("Tractor"),
      status: "assigned",
      auctionEventSeedId: "row-crop-tractor-sale",
    };
  };

  // 3.2. Seed Mock Lots
  const mockLots: MockLot[] = [
    // Live sale: real stock from https://webuytractors.shop (the owner's own
    // site) and its timed auction (auctions.webuytractors.shop). Titles, order
    // and photos are real; the site publishes no year, hours or specs for most
    // machines, so those, the towns and the serial numbers are DEMO values.
    // Lot numbers follow this order (the T6070 is lot 3, as in the mockups).
    // Only the T6070 has a single photo (that is all the owner publishes for
    // it); the MF 455 Xtra has a full 8-photo shot list.
    liveTractor({
      seedId: "mf-455-xtra-4x4",
      title: "Massey Ferguson 455 Xtra 4x4",
      make: "Massey Ferguson",
      model: "455 Xtra",
      year: 2018,
      operatingHours: 3200,
      location: "Pretoria, Gauteng",
      province: "gauteng",
      description:
        "Massey Ferguson 455 Xtra 4x4 utility tractor from We Buy Tractors. Eight inspection photos cover every angle of the machine.",
      reservePrice: 170000,
      startingPrice: 110000,
      currentPrice: 120000,
      minIncrement: 5000,
      sellerId: sellerId,
      powerKw: 41,
      drive: "4wd",
      transmission: "12F/12R synchromesh",
      frontTyrePct: 60,
      rearTyrePct: 55,
      serialNumber: "MF455X-0418271",
      photos: WBT_PHOTOS.MF455,
    }),
    liveTractor({
      seedId: "nh-8030",
      title: "New Holland 8030",
      make: "New Holland",
      model: "8030",
      year: 2009,
      operatingHours: 6200,
      location: "Benoni, Gauteng",
      province: "gauteng",
      description:
        "New Holland 8030 four-wheel-drive tractor from We Buy Tractors, sold as seen.",
      reservePrice: 150000,
      startingPrice: 95000,
      currentPrice: 100000,
      minIncrement: 5000,
      sellerId: "mock-seller-2",
      powerKw: 96,
      drive: "4wd",
      transmission: "Syncro 12x12",
      frontTyrePct: 50,
      rearTyrePct: 45,
      serialNumber: "NH8030-5520913",
      photos: WBT_PHOTOS.NH8030,
    }),
    liveTractor({
      seedId: "nh-t6070",
      title: "New Holland T6070",
      make: "New Holland",
      model: "T6070",
      year: 2016,
      operatingHours: 4850,
      location: "Malmesbury, Western Cape",
      province: "western_cape",
      description:
        "New Holland T6070 four-wheel-drive tractor in good running condition. Starts, runs and drives, no known faults. Sold as is.",
      reservePrice: 480000,
      startingPrice: 350000,
      currentPrice: 400000,
      minIncrement: 5000,
      sellerId: "mock-seller-4",
      powerKw: 104,
      drive: "4wd",
      transmission: "Semi-powershift",
      frontTyrePct: 70,
      rearTyrePct: 65,
      serialNumber: "ZBJC12345",
      photos: [WBT_PHOTOS.T6070],
    }),
    liveTractor({
      seedId: "nh-td5-110-4x4",
      title: "2022 New Holland TD5.110 4x4",
      make: "New Holland",
      model: "TD5.110",
      year: 2022,
      operatingHours: 1400,
      location: "Pretoria, Gauteng",
      province: "gauteng",
      description:
        "2022 New Holland TD5.110 4x4 cab tractor from We Buy Tractors.",
      reservePrice: 260000,
      startingPrice: 180000,
      currentPrice: 185000,
      minIncrement: 5000,
      sellerId: "mock-seller-2",
      powerKw: 81,
      drive: "4wd",
      transmission: "12x12 synchromesh",
      frontTyrePct: 85,
      rearTyrePct: 80,
      serialNumber: "NHTD5-2204417",
      photos: WBT_PHOTOS.TD5_110,
    }),
    liveTractor({
      seedId: "mf-440-4x4",
      title: "Massey Ferguson 440 4x4",
      make: "Massey Ferguson",
      model: "440",
      year: 2012,
      operatingHours: 5400,
      location: "Bloemfontein, Free State",
      province: "free_state",
      description: "Massey Ferguson 440 4x4 tractor from We Buy Tractors.",
      reservePrice: 140000,
      startingPrice: 90000,
      currentPrice: 95000,
      minIncrement: 2500,
      sellerId: sellerId,
      powerKw: 56,
      drive: "4wd",
      transmission: "8F/2R synchromesh",
      frontTyrePct: 55,
      rearTyrePct: 50,
      serialNumber: "MF440-4X-3381",
      photos: WBT_PHOTOS.MF440_4X4,
    }),
    liveTractor({
      seedId: "mf-399-se-4x4",
      title: "Massey Ferguson 399 SE 4x4",
      make: "Massey Ferguson",
      model: "399 SE",
      year: 2014,
      operatingHours: 4100,
      location: "Potchefstroom, North West",
      province: "north_west",
      description: "Massey Ferguson 399 SE 4x4 tractor from We Buy Tractors.",
      reservePrice: 190000,
      startingPrice: 130000,
      currentPrice: 140000,
      minIncrement: 5000,
      sellerId: "mock-seller-3",
      powerKw: 74,
      drive: "4wd",
      transmission: "12F/12R synchromesh",
      frontTyrePct: 65,
      rearTyrePct: 60,
      serialNumber: "MF399-SE-7712",
      photos: WBT_PHOTOS.MF399,
    }),
    liveTractor({
      seedId: "mf-290",
      title: "Massey Ferguson 290",
      make: "Massey Ferguson",
      model: "290",
      year: 2005,
      operatingHours: 7300,
      location: "Malmesbury, Western Cape",
      province: "western_cape",
      description:
        "Massey Ferguson 290 two-wheel-drive tractor from a Swartland farm.",
      reservePrice: 140000,
      startingPrice: 100000,
      currentPrice: 102500,
      minIncrement: 2500,
      sellerId: "mock-seller-4",
      powerKw: 52,
      drive: "2wd",
      transmission: "8F/2R synchromesh",
      frontTyrePct: 40,
      rearTyrePct: 45,
      serialNumber: "MF290-2W-0915",
      photos: WBT_PHOTOS.MF290,
    }),
    liveTractor({
      seedId: "jd-5725",
      title: "John Deere 5725",
      make: "John Deere",
      model: "5725",
      year: 2011,
      operatingHours: 5900,
      location: "Polokwane, Limpopo",
      province: "limpopo",
      description: "John Deere 5725 tractor from We Buy Tractors.",
      reservePrice: 180000,
      startingPrice: 120000,
      currentPrice: 125000,
      minIncrement: 5000,
      sellerId: sellerId,
      powerKw: 70,
      drive: "4wd",
      transmission: "12F/12R PowrReverser",
      frontTyrePct: 60,
      rearTyrePct: 55,
      serialNumber: "JD5725-1PY5725",
      photos: WBT_PHOTOS.JD5725,
    }),
    liveTractor({
      seedId: "mf-165",
      title: "Massey Ferguson 165",
      make: "Massey Ferguson",
      model: "165",
      year: 1978,
      operatingHours: 9800,
      location: "Bethlehem, Free State",
      province: "free_state",
      description:
        "Massey Ferguson 165 two-wheel-drive tractor, a farm classic.",
      reservePrice: 105000,
      startingPrice: 75000,
      currentPrice: 80000,
      minIncrement: 2500,
      sellerId: "mock-seller-3",
      powerKw: 35,
      drive: "2wd",
      transmission: "6F/2R",
      frontTyrePct: 45,
      rearTyrePct: 40,
      serialNumber: "MF165-76-2204",
      photos: WBT_PHOTOS.MF165,
    }),
    liveTractor({
      seedId: "ford-5000",
      title: "Ford 5000",
      make: "Ford",
      model: "5000",
      year: 1980,
      operatingHours: 8800,
      location: "Piketberg, Western Cape",
      province: "western_cape",
      description: "Ford 5000 two-wheel-drive tractor, sold as seen.",
      reservePrice: 60000,
      startingPrice: 40000,
      currentPrice: 42000,
      minIncrement: 1000,
      sellerId: "mock-seller-4",
      powerKw: 37,
      drive: "2wd",
      transmission: "8F/2R",
      frontTyrePct: 35,
      rearTyrePct: 40,
      serialNumber: "FORD5000-B1187",
      photos: WBT_PHOTOS.FORD5000,
    }),
    liveTractor({
      seedId: "farmtrac-80",
      title: "Farmtrac 80",
      make: "Farmtrac",
      model: "80",
      year: 2015,
      operatingHours: 3600,
      location: "Ermelo, Mpumalanga",
      province: "mpumalanga",
      description: "Farmtrac 80 tractor from We Buy Tractors.",
      reservePrice: 65000,
      startingPrice: 45000,
      currentPrice: 46000,
      minIncrement: 1000,
      sellerId: "mock-seller-2",
      powerKw: 59,
      drive: "4wd",
      transmission: "12F/12R synchromesh",
      frontTyrePct: 60,
      rearTyrePct: 55,
      serialNumber: "FT80-15-6023",
      photos: WBT_PHOTOS.FARMTRAC80,
    }),
    liveTractor({
      seedId: "mf-440",
      title: "Massey Ferguson 440",
      make: "Massey Ferguson",
      model: "440",
      year: 2010,
      operatingHours: 6100,
      location: "Pretoria, Gauteng",
      province: "gauteng",
      description:
        "Massey Ferguson 440 two-wheel-drive tractor from We Buy Tractors.",
      reservePrice: 120000,
      startingPrice: 85000,
      currentPrice: 87500,
      minIncrement: 2500,
      sellerId: sellerId,
      powerKw: 56,
      drive: "2wd",
      transmission: "8F/2R synchromesh",
      frontTyrePct: 50,
      rearTyrePct: 50,
      serialNumber: "MF440-2W-1184",
      photos: WBT_PHOTOS.MF440,
    }),
    {
      seedId: "jd-s780",
      title: "John Deere S780 — Combine Harvester",
      categoryId: getCategoryId("Combine"),
      make: "John Deere",
      model: "S780",
      year: 2021,
      operatingHours: 1250,
      location: "Des Moines, IA",
      description:
        "A 2021 John Deere S780 combine with JDLink telemetry and a recently serviced clean grain handling system. Sold at auction with a full condition report available to the winning bidder.",
      reservePrice: 280000,
      startingPrice: 180000,
      currentPrice: 205000,
      minIncrement: 2500,
      settledAt: now - 2 * MS_PER_DAY,
      winnerId: "mock-buyer-1",
      sellerId: "mock-seller-2",
      status: "sold",
      auctionEventSeedId: "harvest-clearance-august",
      images: {
        front: MOCK_IMAGE_URLS.JD_FRONT,
        engine: MOCK_IMAGE_URLS.JD_ENGINE,
        cabin: MOCK_IMAGE_URLS.JD_CABIN,
        additional: [],
      },
    },
    {
      seedId: "case-axial-flow-8250",
      title: "Case IH Axial-Flow 8250 — Combine",
      categoryId: getCategoryId("Combine"),
      make: "Case IH",
      model: "Axial-Flow 8250",
      year: 2022,
      operatingHours: 620,
      location: "Grand Island, NE",
      description:
        "Low-hours 2022 Axial-Flow 8250 with the AFS Connect command center, dual rotor setup and 45-foot draper head. Shed-kept and field-ready for the coming harvest.",
      reservePrice: 330000,
      startingPrice: 220000,
      currentPrice: 236000,
      minIncrement: 4000,
      sellerId: "mock-seller-3",
      status: "assigned",
      auctionEventSeedId: "harvest-field-equipment-sale",
      images: {
        front: MOCK_IMAGE_URLS.CASE_FRONT,
        engine: MOCK_IMAGE_URLS.CASE_ENGINE,
        cabin: MOCK_IMAGE_URLS.CASE_CABIN,
        additional: [],
      },
    },
    {
      seedId: "jd-r4038",
      title: "John Deere R4038 — Self-Propelled Sprayer",
      categoryId: getCategoryId("Sprayer"),
      make: "John Deere",
      model: "R4038",
      year: 2021,
      operatingHours: 850,
      location: "Little Rock, AR",
      description:
        "2021 R4038 with a 1,200-gallon stainless tank, 120-foot carbon-fibre boom and AimCommand Flex with individual nozzle shutoffs. Precision-ready with a JDStarFire 6000 receiver included.",
      reservePrice: 260000,
      startingPrice: 170000,
      currentPrice: 184000,
      minIncrement: 3500,
      sellerId: sellerId,
      status: "assigned",
      auctionEventSeedId: "harvest-field-equipment-sale",
      images: {
        front: MOCK_IMAGE_URLS.JD_FRONT,
        engine: MOCK_IMAGE_URLS.JD_ENGINE,
        cabin: MOCK_IMAGE_URLS.JD_CABIN,
        additional: [],
      },
    },
    {
      seedId: "case-early-riser-2150",
      title: "Case IH Early Riser 2150 — 16-Row Planter",
      categoryId: getCategoryId("Planter/Seeder"),
      make: "Case IH",
      model: "Early Riser 2150",
      year: 2021,
      operatingHours: 480,
      location: "Decatur, IL",
      description:
        "16-row 30-inch Early Riser 2150 with pole-hinge row units, CleanSight seed cameras and hydraulically driven variable-rate population control. Only 480 planting hours.",
      reservePrice: 145000,
      startingPrice: 95000,
      currentPrice: 103000,
      minIncrement: 2000,
      sellerId: "mock-seller-2",
      status: "assigned",
      auctionEventSeedId: "harvest-field-equipment-sale",
      images: {
        front: MOCK_IMAGE_URLS.CASE_FRONT,
        engine: MOCK_IMAGE_URLS.CASE_ENGINE,
        cabin: MOCK_IMAGE_URLS.CASE_CABIN,
        additional: [],
      },
    },
    {
      seedId: "jd-1775nt",
      title: "John Deere 1775NT — 16-Row Planter",
      categoryId: getCategoryId("Planter/Seeder"),
      make: "John Deere",
      model: "1775NT",
      year: 2020,
      operatingHours: 900,
      location: "Champaign, IL",
      description:
        "Proven 1775NT 16-row planter with ExactEmerge row units, pneumatic downforce and row-by-row population monitoring. Sold at auction to a repeat AgriBid buyer.",
      reservePrice: 120000,
      startingPrice: 80000,
      currentPrice: 96000,
      minIncrement: 2000,
      settledAt: now - 3 * MS_PER_DAY,
      winnerId: "mock-buyer-2",
      sellerId: "mock-seller-3",
      status: "sold",
      auctionEventSeedId: "harvest-clearance-august",
      images: {
        front: MOCK_IMAGE_URLS.JD_FRONT,
        engine: MOCK_IMAGE_URLS.JD_ENGINE,
        cabin: MOCK_IMAGE_URLS.JD_CABIN,
        additional: [],
      },
    },
    {
      seedId: "case-ecolo-tiger-875",
      title: "Case IH Ecolo-Tiger 875 — Deep Ripper",
      categoryId: getCategoryId("Tillage Equipment"),
      make: "Case IH",
      model: "Ecolo-Tiger 875",
      year: 2018,
      operatingHours: 1500,
      location: "Wichita, KS",
      description:
        "Ecolo-Tiger 875 disc ripper with seven shanks, adjustable depth control and rear cage roller. Bushings and points replaced last season with invoices available.",
      reservePrice: 62000,
      startingPrice: 40000,
      currentPrice: 44500,
      minIncrement: 1500,
      sellerId: "mock-seller-2",
      status: "assigned",
      auctionEventSeedId: "harvest-field-equipment-sale",
      images: {
        front: MOCK_IMAGE_URLS.CASE_FRONT,
        engine: MOCK_IMAGE_URLS.CASE_ENGINE,
        cabin: MOCK_IMAGE_URLS.CASE_CABIN,
        additional: [],
      },
    },
    {
      seedId: "nh-speedrower-260",
      title: "New Holland Speedrower 260 — Windrower",
      categoryId: getCategoryId("Hay & Forage"),
      make: "New Holland",
      model: "Speedrower 260",
      year: 2020,
      operatingHours: 900,
      location: "Huron, SD",
      description:
        "Speedrower 260 with a 36-foot rotary draper header, TerraTrac rubber tracks and IntelliCruise ground-speed control. Strong, straight machine ready for hay season.",
      reservePrice: 88000,
      startingPrice: 55000,
      currentPrice: 61000,
      minIncrement: 1500,
      sellerId: "mock-seller-3",
      status: "assigned",
      auctionEventSeedId: "harvest-field-equipment-sale",
      images: {
        front: MOCK_IMAGE_URLS.NH_FRONT,
        engine: MOCK_IMAGE_URLS.NH_ENGINE,
        cabin: MOCK_IMAGE_URLS.NH_CABIN,
        additional: [],
      },
    },
    {
      seedId: "kubota-rtv-x1140",
      title: "Kubota RTV-X1140 — Utility Vehicle",
      categoryId: getCategoryId("Utility Vehicle"),
      make: "Kubota",
      model: "RTV-X1140",
      year: 2022,
      operatingHours: 400,
      location: "Christchurch, NZ",
      description:
        "Four-seat Kubota RTV-X1140 with hydraulic power steering, tilting cargo bed and a 24.8 hp diesel engine. Bidding closed without meeting the reserve price.",
      reservePrice: 28000,
      startingPrice: 18000,
      currentPrice: 18000,
      minIncrement: 500,
      settledAt: now - 2 * MS_PER_DAY,
      winnerId: null,
      sellerId: "mock-seller-3",
      status: "unsold",
      auctionEventSeedId: "construction-utility-september",
      images: {
        front: MOCK_IMAGE_URLS.MF_FRONT,
        engine: MOCK_IMAGE_URLS.MF_ENGINE,
        cabin: MOCK_IMAGE_URLS.MF_CABIN,
        additional: [],
      },
    },
    {
      seedId: "jcb-541-70",
      title: "JCB 541-70 — Loadall Telehandler",
      categoryId: getCategoryId("Telehandler"),
      make: "JCB",
      model: "541-70",
      year: 2021,
      operatingHours: 1100,
      location: "Rocester, UK",
      description:
        "JCB 541-70 Agri Loadall with 4,100 kg lift capacity, 7-meter lift height and twin boom extension. Air-conditioned cab and ready for yard and bale work.",
      reservePrice: 105000,
      startingPrice: 70000,
      currentPrice: 78000,
      minIncrement: 2000,
      sellerId: sellerId,
      status: "assigned",
      auctionEventSeedId: "material-handling-sale",
      images: {
        front: MOCK_IMAGE_URLS.FENDT_FRONT,
        engine: MOCK_IMAGE_URLS.FENDT_ENGINE,
        cabin: MOCK_IMAGE_URLS.FENDT_CABIN,
        additional: [],
      },
    },
    {
      seedId: "manitou-mlt-840",
      title: "Manitou MLT 840 — Telehandler",
      categoryId: getCategoryId("Telehandler"),
      make: "Manitou",
      model: "MLT 840",
      year: 2020,
      operatingHours: 1600,
      location: "Bordeaux, FR",
      description:
        "Manitou MLT 840 agri telehandler with 4-tonne lift capacity and 13.7-meter reach. Bidding closed without meeting the reserve — available for relisting.",
      reservePrice: 95000,
      startingPrice: 60000,
      currentPrice: 60000,
      minIncrement: 1500,
      settledAt: now - MS_PER_DAY,
      winnerId: null,
      sellerId: "mock-seller-2",
      status: "unsold",
      auctionEventSeedId: "telehandler-closeout",
      images: {
        front: MOCK_IMAGE_URLS.NH_FRONT,
        engine: MOCK_IMAGE_URLS.NH_ENGINE,
        cabin: MOCK_IMAGE_URLS.NH_CABIN,
        additional: [],
      },
    },
    {
      seedId: "bell-l1206e",
      title: "Bell L1206E — Front-End Loader",
      categoryId: getCategoryId("Loader"),
      make: "Bell",
      model: "L1206E",
      year: 2017,
      operatingHours: 5200,
      location: "Johannesburg, ZA",
      description:
        "Bell L1206E wheel loader with 6 cubic meter bucket, articulated steering and timber grapple attachment. Major service completed at 5,000 hours with invoices available.",
      reservePrice: 190000,
      startingPrice: 120000,
      currentPrice: 134000,
      minIncrement: 3500,
      sellerId: "mock-seller-3",
      status: "assigned",
      auctionEventSeedId: "material-handling-sale",
      images: {
        front: MOCK_IMAGE_URLS.CASE_FRONT,
        engine: MOCK_IMAGE_URLS.CASE_ENGINE,
        cabin: MOCK_IMAGE_URLS.CASE_CABIN,
        additional: [],
      },
    },
    {
      seedId: "cat-320-gc",
      title: "Caterpillar 320 GC — Hydraulic Excavator",
      categoryId: getCategoryId("Construction"),
      make: "Caterpillar",
      model: "320 GC",
      year: 2019,
      operatingHours: 3400,
      location: "Perth, AU",
      description:
        "Caterpillar 320 GC excavator with reduced-swing configuration, auxiliary hydraulics and a 1.19 cubic meter bucket. Sold at auction with undercarriage at approximately 60 percent.",
      reservePrice: 150000,
      startingPrice: 100000,
      currentPrice: 118000,
      minIncrement: 2000,
      settledAt: now - 5 * MS_PER_DAY,
      winnerId: "mock-buyer-3",
      sellerId: "mock-seller-2",
      status: "sold",
      auctionEventSeedId: "construction-utility-september",
      images: {
        front: MOCK_IMAGE_URLS.CASE_FRONT,
        engine: MOCK_IMAGE_URLS.CASE_ENGINE,
        cabin: MOCK_IMAGE_URLS.CASE_CABIN,
        additional: [],
      },
    },
    {
      seedId: "jd-6120m",
      title: "John Deere 6120M — Utility Tractor",
      categoryId: getCategoryId("Tractor"),
      make: "John Deere",
      model: "6120M",
      year: 2021,
      operatingHours: 700,
      location: "Ames, IA",
      description:
        "2021 6120M utility tractor with CommandQuad 24/24 transmission, 440R loader-ready package and low hours. Awaiting admin approval before being assigned to a sale.",
      reservePrice: 95000,
      startingPrice: 65000,
      currentPrice: 65000,
      minIncrement: 1000,
      sellerId: "mock-seller-3",
      status: "pending_review",
      images: {
        front: MOCK_IMAGE_URLS.JD_FRONT,
        engine: MOCK_IMAGE_URLS.JD_ENGINE,
        cabin: MOCK_IMAGE_URLS.JD_CABIN,
        additional: [],
      },
    },
    {
      seedId: "case-puma-155",
      title: "Case IH Puma 155 — Row Crop Tractor",
      categoryId: getCategoryId("Tractor"),
      make: "Case IH",
      model: "Puma 155",
      year: 2019,
      operatingHours: 2100,
      location: "Springfield, OH",
      description:
        "Puma 155 with CVX continuously variable transmission, AFS Pro 700 display and 4 remote hydraulics. Submitted for review — expected to be assigned to a sale shortly.",
      reservePrice: 88000,
      startingPrice: 60000,
      currentPrice: 60000,
      minIncrement: 1000,
      sellerId: sellerId,
      status: "pending_review",
      images: {
        front: MOCK_IMAGE_URLS.CASE_FRONT,
        engine: MOCK_IMAGE_URLS.CASE_ENGINE,
        cabin: MOCK_IMAGE_URLS.CASE_CABIN,
        additional: [],
      },
    },
    {
      seedId: "deutz-agrotron-6165",
      title: "Deutz-Fahr Agrotron 6165 — Tractor (Draft)",
      categoryId: getCategoryId("Tractor"),
      make: "Deutz-Fahr",
      model: "Agrotron 6165",
      year: 2018,
      operatingHours: 2600,
      location: "Cologne, DE",
      description:
        "Draft listing for an Agrotron 6165 TTV. Photos and the condition checklist are still being prepared before submission for review.",
      reservePrice: 75000,
      startingPrice: 50000,
      currentPrice: 50000,
      minIncrement: 1000,
      sellerId: sellerId,
      status: "draft",
      images: {
        front: MOCK_IMAGE_URLS.MF_FRONT,
        engine: MOCK_IMAGE_URLS.MF_ENGINE,
        cabin: MOCK_IMAGE_URLS.MF_CABIN,
        additional: [],
      },
    },
    {
      seedId: "jd-8r-410-scheduled-soon",
      title: "John Deere 8R 410 — Scheduled Start (Soon)",
      categoryId: getCategoryId("Tractor"),
      make: "John Deere",
      model: "8R 410",
      year: 2023,
      operatingHours: 450,
      location: "Moline, IL",
      description:
        "Approved and assigned to a future sale window. Bidding opens shortly — dev fixture for issue #296 (pre-start bidding gate).",
      reservePrice: 385000,
      startingPrice: 250000,
      currentPrice: 250000,
      minIncrement: 5000,
      sellerId: sellerId,
      status: "assigned",
      auctionEventSeedId: "row-crop-tractor-sale-next-round",
      images: {
        front: MOCK_IMAGE_URLS.JD_FRONT,
        engine: MOCK_IMAGE_URLS.JD_ENGINE,
        cabin: MOCK_IMAGE_URLS.JD_CABIN,
        additional: [],
      },
    },
    {
      seedId: "case-magnum-380-scheduled-later",
      title: "Case IH Magnum 380 — Scheduled Start (Tomorrow)",
      categoryId: getCategoryId("Tractor"),
      make: "Case IH",
      model: "Magnum 380",
      year: 2022,
      operatingHours: 820,
      location: "Racine, WI",
      description:
        "Approved and assigned to a future sale window. Bidding opens once the sale starts — dev fixture for issue #296 (pre-start bidding gate).",
      reservePrice: 320000,
      startingPrice: 200000,
      currentPrice: 200000,
      minIncrement: 2500,
      sellerId: sellerId,
      status: "assigned",
      auctionEventSeedId: "row-crop-tractor-sale-next-round",
      images: {
        front: MOCK_IMAGE_URLS.CASE_FRONT,
        engine: MOCK_IMAGE_URLS.CASE_ENGINE,
        cabin: MOCK_IMAGE_URLS.CASE_CABIN,
        additional: [],
      },
    },
  ];

  // Lots that are in a sale and have no number yet are numbered through the
  // sale's counter (mockLots order). Existing numbers are never overwritten, so
  // re-seeding alongside real assignments cannot create duplicates.
  for (const [lotIndex, lot] of mockLots.entries()) {
    const existing = await ctx.db
      .query("lots")
      .withIndex("by_seedId", (q) => q.eq("seedId", lot.seedId))
      .first();

    const { auctionEventSeedId, ...lotFields } = lot;
    const event = auctionEventSeedId
      ? getEventBySeedId(auctionEventSeedId)
      : undefined;

    // Snapshot the parent event's fee defaults onto the lot, mirroring the
    // lot-assignment mutation's behavior (issue #318): once assigned, later
    // edits to the event's defaults must not change this lot's fees.
    const needsNumber =
      event !== undefined &&
      (existing?.lotNumber === undefined || existing.auctionId !== event._id);
    const lotNumber =
      event && needsNumber
        ? await issueNextLotNumber(ctx, event._id)
        : existing?.lotNumber;

    // Snapshot the seller's VAT status/type like the assignment mutation does.
    const lotSellerProfile = event
      ? await ctx.db
          .query("profiles")
          .withIndex("by_userId", (q) => q.eq("userId", lot.sellerId))
          .unique()
      : null;

    const lotData = {
      ...lotFields,
      description: lot.description || "No description provided.",
      auctionId: event?._id,
      lotNumber: event ? lotNumber : undefined,
      province: lot.province ?? PROVINCES[lotIndex % PROVINCES.length],
      resolvedBuyerPremiumPct: event
        ? MOCK_DEFAULT_BUYER_PREMIUM_PCT
        : undefined,
      premiumSource: event ? ("auction" as const) : undefined,
      sellerVatRegistered: lotSellerProfile?.vatRegistered,
      sellerType: lotSellerProfile?.sellerType,
      resolvedSellerCommissionPct: event
        ? MOCK_DEFAULT_SELLER_COMMISSION_PCT
        : undefined,
    };

    if (!existing) {
      await ctx.db.insert("lots", lotData);
    } else {
      await ctx.db.patch("lots", existing._id, lotData);
    }
  }

  // 3.2b. Admin-set seller response times (cycled so every variant shows)
  const responseTimeSellerIds = [
    sellerId,
    ...MOCK_EXTRA_SELLER_PROFILES.map((seller) => seller.userId),
  ];
  for (const [index, userId] of responseTimeSellerIds.entries()) {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) continue;
    await ctx.db.patch("profiles", profile._id, {
      sellerResponseTime:
        MOCK_SELLER_RESPONSE_TIMES[index % MOCK_SELLER_RESPONSE_TIMES.length],
    });
  }

  // 3.3. Index the seeded lots for related-record seeding
  const lotsBySeedId = new Map<string, Doc<"lots">>();
  for (const lot of await ctx.db.query("lots").collect()) {
    if (lot.seedId) {
      lotsBySeedId.set(lot.seedId, lot);
    }
  }

  /**
   * Helper to look up a seeded lot by its seedId, throwing if not found.
   * @param seedId - The stable seed identifier of the lot.
   * @returns The lot document.
   */
  const getLotBySeedId = (seedId: string): Doc<"lots"> => {
    const lot = lotsBySeedId.get(seedId);
    if (!lot) {
      throw new Error(`Missing seeded lot "${seedId}"`);
    }
    return lot;
  };

  // 3.4. Seed bids for live/scheduled lots (skipped when bids already exist)
  for (const [idx, [seedId, amounts]] of Object.entries(
    ACTIVE_BID_AMOUNTS
  ).entries()) {
    const lot = getLotBySeedId(seedId);
    const buyerPool = [
      ...MOCK_BUYER_IDS.slice(idx),
      ...MOCK_BUYER_IDS.slice(0, idx),
    ];
    const bids = amounts.map((amount) => {
      const bidderId = buyerPool.shift() ?? MOCK_BUYER_IDS[0];
      return { bidderId, amount };
    });
    await seedMockBids(ctx, lot, {
      bids,
      windowStart: now - MS_PER_DAY,
      windowEnd: now - MS_PER_HOUR,
    });
  }

  // 3.5. Seed winning bid sequences for sold lots
  for (const plan of SOLD_BID_PLANS) {
    const lot = getLotBySeedId(plan.seedId);
    const end = lot.settledAt ?? now;
    await seedMockBids(ctx, lot, {
      bids: plan.bids,
      windowStart: end - 2 * MS_PER_DAY,
      windowEnd: end,
    });
  }

  // 3.6. Seed proxy bids for a couple of live lots
  const proxyBidPlans: {
    seedId: string;
    bidderId: string;
    maxBid: number;
  }[] = [
    { seedId: "mf-455-xtra-4x4", bidderId: "mock-buyer-6", maxBid: 140000 },
    {
      seedId: "case-axial-flow-8250",
      bidderId: "mock-buyer-1",
      maxBid: 248000,
    },
  ];
  for (const plan of proxyBidPlans) {
    const lot = getLotBySeedId(plan.seedId);
    const existingProxy = await ctx.db
      .query("proxy_bids")
      .withIndex("by_bidder_lot", (q) =>
        q.eq("bidderId", plan.bidderId).eq("lotId", lot._id)
      )
      .unique();
    if (!existingProxy) {
      await ctx.db.insert("proxy_bids", {
        lotId: lot._id,
        bidderId: plan.bidderId,
        maxBid: plan.maxBid,
        updatedAt: now,
      });
    }
  }

  // 3.7. Seed reviews from the winning buyers of sold lots
  for (const plan of REVIEW_PLANS) {
    const lot = getLotBySeedId(plan.seedId);
    const existingReview = await ctx.db
      .query("reviews")
      .withIndex("by_lot_reviewer", (q) =>
        q.eq("lotId", lot._id).eq("reviewerId", plan.reviewerId)
      )
      .unique();
    if (existingReview) continue;

    const createdAt =
      (lot.settledAt ?? now) + plan.daysAfterSettlement * MS_PER_DAY;
    await ctx.db.insert("reviews", {
      lotId: lot._id,
      reviewerId: plan.reviewerId,
      revieweeId: lot.sellerId,
      rating: plan.rating,
      comment: plan.comment,
      ...(plan.response
        ? {
            response: {
              text: plan.response.text,
              createdAt: createdAt + plan.response.daysAfterReview * MS_PER_DAY,
            },
          }
        : {}),
      createdAt,
    });
  }

  // 3.8. Seed lot fee ledger rows for sold lots
  const sellerFee = await ctx.db
    .query("platformFees")
    .withIndex("by_appliesTo", (q) => q.eq("appliesTo", "seller"))
    .first();
  const buyerFee = await ctx.db
    .query("platformFees")
    .withIndex("by_appliesTo", (q) => q.eq("appliesTo", "buyer"))
    .first();

  if (sellerFee && buyerFee) {
    for (const plan of SOLD_BID_PLANS) {
      const lot = getLotBySeedId(plan.seedId);
      const existingFeeRow = await ctx.db
        .query("lotFees")
        .withIndex("by_lot", (q) => q.eq("lotId", lot._id))
        .first();
      if (existingFeeRow) continue;

      const salePrice = lot.currentPrice;
      const settledAt = lot.settledAt ?? now;
      await ctx.db.insert("lotFees", {
        lotId: lot._id,
        feeId: sellerFee._id,
        feeName: sellerFee.name,
        appliedTo: "seller",
        feeType: sellerFee.feeType,
        rate: sellerFee.value,
        salePrice,
        calculatedAmount: Math.round(salePrice * sellerFee.value * 100) / 100,
        createdAt: settledAt,
      });
      await ctx.db.insert("lotFees", {
        lotId: lot._id,
        feeId: buyerFee._id,
        feeName: buyerFee.name,
        appliedTo: "buyer",
        feeType: buyerFee.feeType,
        rate: buyerFee.value,
        salePrice,
        calculatedAmount: Math.round(salePrice * buyerFee.value * 100) / 100,
        createdAt: settledAt,
      });
    }
  }

  // 3.9. Seed watchlist entries on live lots
  for (const plan of WATCHLIST_PLANS) {
    const lot = getLotBySeedId(plan.seedId);
    const existingEntry = await ctx.db
      .query("watchlist")
      .withIndex("by_user_lot", (q) =>
        q.eq("userId", plan.userId).eq("lotId", lot._id)
      )
      .first();
    if (!existingEntry) {
      await ctx.db.insert("watchlist", {
        userId: plan.userId,
        lotId: lot._id,
      });
    }
  }

  // Watcher counters mirror the watchlist rows (absolute, so reseeds stay exact).
  for (const lotId of new Set(
    WATCHLIST_PLANS.map((plan) => getLotBySeedId(plan.seedId)._id)
  )) {
    const watchers = await ctx.db
      .query("watchlist")
      .withIndex("by_lot", (q) => q.eq("lotId", lotId))
      .collect();
    await updateCounter(
      ctx,
      watcherCounterName(lotId),
      "total",
      watchers.length,
      true
    );
  }

  // 3.10. Seed buyer/seller conversations with message threads
  for (const plan of CONVERSATION_PLANS) {
    const lot = getLotBySeedId(plan.lotSeedId);
    const sellerIdForConversation =
      plan.sellerId === MOCK_SELLER_KEY ? sellerId : plan.sellerId;

    const existingConversation = await ctx.db
      .query("conversations")
      .withIndex("by_buyer_seller", (q) =>
        q.eq("buyerId", plan.buyerId).eq("sellerId", sellerIdForConversation)
      )
      .unique();
    if (existingConversation) continue;

    const startedAt = now - plan.startedDaysAgo * MS_PER_DAY;
    const conversationId = await ctx.db.insert("conversations", {
      buyerId: plan.buyerId,
      sellerId: sellerIdForConversation,
      lotId: lot._id,
      lastMessageAt: startedAt,
      createdAt: startedAt,
    });

    let lastMessageAt = startedAt;
    for (const message of plan.messages) {
      const createdAt = startedAt + message.hoursAfterStart * MS_PER_HOUR;
      lastMessageAt = Math.max(lastMessageAt, createdAt);
      await ctx.db.insert("messages", {
        conversationId,
        senderId:
          message.sender === "buyer" ? plan.buyerId : sellerIdForConversation,
        content: message.content,
        isRead: message.isRead,
        createdAt,
      });
    }

    await ctx.db.patch("conversations", conversationId, { lastMessageAt });
  }

  // 3.11. Seed notifications (only while the table is empty)
  const existingNotification = await ctx.db.query("notifications").first();
  if (!existingNotification) {
    const jd8r = getLotBySeedId("mf-455-xtra-4x4");
    const jdS780 = getLotBySeedId("jd-s780");
    const speedrower = getLotBySeedId("nh-speedrower-260");

    const notificationPlans: {
      recipientId: string;
      type: "info" | "success" | "warning" | "error";
      title: string;
      message: string;
      link?: string;
      isRead: boolean;
      createdAt: number;
    }[] = [
      {
        recipientId: "all",
        type: "info",
        title: "Welcome to the AgriBid showcase",
        message:
          "This deployment runs on seeded mock data for demonstration purposes and resets weekly.",
        isRead: false,
        createdAt: now - 2 * MS_PER_DAY,
      },
      {
        recipientId: "mock-buyer-2",
        type: "warning",
        title: "You've been outbid",
        message: `Someone outbid you on ${jd8r.title}. Place a higher bid to stay in the running.`,
        link: `/auction/${jd8r._id}`,
        isRead: false,
        createdAt: now - 5 * MS_PER_HOUR,
      },
      {
        recipientId: "mock-buyer-1",
        type: "success",
        title: "Auction won",
        message: `Congratulations — you won ${jdS780.title}.`,
        link: `/auction/${jdS780._id}`,
        isRead: true,
        createdAt: (jdS780.settledAt ?? now) + MS_PER_HOUR,
      },
      {
        recipientId: "mock-seller-3",
        type: "success",
        title: "Listing approved",
        message: `Your listing ${speedrower.title} has been approved and assigned to a sale.`,
        link: `/auction/${speedrower._id}`,
        isRead: false,
        createdAt: now - 2 * MS_PER_DAY,
      },
    ];

    for (const plan of notificationPlans) {
      await ctx.db.insert("notifications", plan);
    }
  }

  // 3.12. Seed support tickets (only while the table is empty)
  const existingTicket = await ctx.db.query("supportTickets").first();
  if (!existingTicket) {
    const bellLoader = getLotBySeedId("bell-l1206e");
    const cat320 = getLotBySeedId("cat-320-gc");

    const ticketPlans: {
      userId: string;
      lotId?: Id<"lots">;
      subject: string;
      message: string;
      priority: "low" | "medium" | "high";
      status: "open" | "resolved" | "closed";
      createdDaysAgo: number;
      updatedDaysAgo: number;
    }[] = [
      {
        userId: "mock-buyer-5",
        lotId: bellLoader._id,
        subject: "Payment details for Bell L1206E",
        message:
          "I won the loader auction yesterday but haven't received payment or collection details from the seller yet.",
        priority: "medium",
        status: "open",
        createdDaysAgo: 1,
        updatedDaysAgo: 1,
      },
      {
        userId: "mock-buyer-3",
        lotId: cat320._id,
        subject: "Incorrect hours listed on Cat 320 GC",
        message:
          "The listing showed 3,400 operating hours, but the hour meter reads closer to 4,100 on inspection.",
        priority: "high",
        status: "resolved",
        createdDaysAgo: 5,
        updatedDaysAgo: 4,
      },
      {
        userId: "mock-seller-2",
        subject: "Editing a live listing",
        message:
          "Can I update the reserve price while my lot is still awaiting review?",
        priority: "low",
        status: "resolved",
        createdDaysAgo: 6,
        updatedDaysAgo: 5,
      },
    ];

    for (const plan of ticketPlans) {
      await ctx.db.insert("supportTickets", {
        userId: plan.userId,
        lotId: plan.lotId,
        subject: plan.subject,
        message: plan.message,
        priority: plan.priority,
        status: plan.status,
        createdAt: now - plan.createdDaysAgo * MS_PER_DAY,
        updatedAt: now - plan.updatedDaysAgo * MS_PER_DAY,
      });
    }
  }

  // 3.13. Seed the per-user activity feeds (only while the table is empty)
  const existingActivity = await ctx.db.query("userActivity").first();
  if (!existingActivity) {
    const mockUsers: { userId: string; createdDaysAgo: number }[] = [
      ...MOCK_BUYER_PROFILES.map((buyer) => ({
        userId: buyer.userId,
        createdDaysAgo: buyer.createdDaysAgo,
      })),
      ...MOCK_EXTRA_SELLER_PROFILES.map((seller) => ({
        userId: seller.userId,
        createdDaysAgo: seller.createdDaysAgo,
      })),
      { userId: sellerId, createdDaysAgo: 180 }, // Clerk-synced mock seller
    ];

    for (const user of mockUsers) {
      const createdAt = now - user.createdDaysAgo * MS_PER_DAY;
      await ctx.db.insert("userActivity", {
        userId: user.userId,
        type: "account_created",
        description: "Joined AgriBid",
        createdAt,
      });
      await ctx.db.insert("userActivity", {
        userId: user.userId,
        type: "verification_approved",
        description: "Verification approved",
        createdAt: createdAt + 2 * MS_PER_DAY,
      });
    }

    for (const lot of mockLots) {
      const lotDoc = getLotBySeedId(lot.seedId);
      const parentEvent = lot.auctionEventSeedId
        ? getEventBySeedId(lot.auctionEventSeedId)
        : undefined;
      await ctx.db.insert("userActivity", {
        userId: lot.sellerId,
        type: "listing_created",
        description: `Created listing: ${lot.title}`,
        relatedId: lotDoc._id,
        createdAt: parentEvent?.startTime ?? now - MS_PER_DAY,
      });
    }

    const allSeededBids = await ctx.db.query("bids").collect();
    const topBidByLot = new Map<Id<"lots">, Doc<"bids">>();
    for (const bid of allSeededBids) {
      const current = topBidByLot.get(bid.lotId);
      if (!current || bid.timestamp > current.timestamp) {
        topBidByLot.set(bid.lotId, bid);
      }
    }
    for (const [lotId, bid] of topBidByLot) {
      const lot = await ctx.db.get("lots", lotId);
      if (!lot) continue;
      await ctx.db.insert("userActivity", {
        userId: bid.bidderId,
        type: "bid_placed",
        description: `Placed a bid of $${bid.amount.toLocaleString()} on ${lot.title}`,
        relatedId: lotId,
        createdAt: bid.timestamp,
      });
    }

    for (const plan of SOLD_BID_PLANS) {
      const lot = getLotBySeedId(plan.seedId);
      const winningBid = plan.bids[plan.bids.length - 1];
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- guards against an empty SOLD_BID_PLANS.bids entry, which TS can't see without noUncheckedIndexedAccess
      if (winningBid === undefined) continue;
      await ctx.db.insert("userActivity", {
        userId: winningBid.bidderId,
        type: "bid_won",
        description: `Won the auction for ${lot.title}`,
        relatedId: lot._id,
        createdAt: lot.settledAt ?? now,
      });
    }
  }

  // 3.14. Seed one pending lot flag (only while the table is empty)
  const existingLotFlag = await ctx.db.query("lotFlags").first();
  if (!existingLotFlag) {
    const flaggedLot = getLotBySeedId("jcb-541-70");
    await ctx.db.insert("lotFlags", {
      lotId: flaggedLot._id,
      reporterId: "mock-buyer-4",
      reason: "misleading",
      details:
        "Operating hours appear inconsistent with the wear shown in the photos.",
      status: "pending",
      createdAt: now - 12 * MS_PER_HOUR,
    });
  }

  // 3.15. Seed one profile flag (only while the table is empty)
  const existingProfileFlag = await ctx.db.query("profileFlags").first();
  if (!existingProfileFlag) {
    await ctx.db.insert("profileFlags", {
      reportedUserId: "mock-seller-3",
      reporterId: "mock-buyer-5",
      reason: "fraudulent_listings",
      details:
        "Listed a telehandler with photos taken from another dealer's website.",
      status: "pending",
      createdAt: now - 8 * MS_PER_HOUR,
    });
  }

  // 4. Seed Default FAQ Items
  const defaultFaqItems = [
    {
      question: "How do I register to bid on AgriBid?",
      answer:
        "Create a free account, then complete KYC (Know Your Customer) verification under your profile. Once approved, you can bid on any live auction.",
    },
    {
      question: "How does the bidding process work?",
      answer:
        "Each lot lists a starting price and minimum bid increment. Place your bid before the auction's countdown timer reaches zero. The highest bid when the timer expires wins — if the reserve price has been met.",
    },
    {
      question: "What is a reserve price?",
      answer:
        "A reserve price is the minimum amount the seller is willing to accept. If bidding does not reach the reserve, the lot closes as 'Unsold' and no sale is concluded.",
    },
    {
      question: "How do I list equipment for auction?",
      answer:
        "Navigate to the Sell page, complete the listing form with equipment details, photos, and pricing, then submit for admin review. Approved listings are assigned to an upcoming sale by an admin.",
    },
    {
      question: "What payment methods are accepted?",
      answer:
        "Payment terms are agreed directly between buyer and seller after a successful auction. AgriBid facilitates the auction process; payment and collection logistics are handled between the two parties.",
    },
    {
      question: "How long does KYC verification take?",
      answer:
        "KYC verification is typically completed within one business day. You will receive a notification once your identity has been confirmed.",
    },
  ];

  const existingFaq = await ctx.db.query("faqItems").first();
  if (!existingFaq) {
    await Promise.all(
      defaultFaqItems.map((item, index) =>
        ctx.db.insert("faqItems", {
          ...item,
          order: index,
          isPublished: true,
        })
      )
    );
    console.log(
      `Seeded ${defaultFaqItems.length.toString()} default FAQ items.`
    );
  }

  // 4.5. Seed the legal page drafts. Idempotent: existing rows (body, title and
  // publish state) are never touched, and new rows are always unpublished, so
  // `weeklyReset` on production cannot overwrite or publish legal text.
  const createdLegalPages = await ensureLegalPageDraftRows(ctx);
  if (createdLegalPages.length > 0) {
    console.log(
      `Seeded unpublished legal page drafts: ${createdLegalPages.join(", ")}.`
    );
  }

  // 5. Update Metrics (Counters)
  // Recalculate everything to ensure consistency after seeding, mirroring
  // convex/lots/mutations/helpers.ts's getLotCounterKey mapping exactly.

  // Lots
  const allLots = await ctx.db.query("lots").collect();
  await updateCounter(ctx, "lots", "total", allLots.length, true);
  await updateCounter(
    ctx,
    "lots",
    "active",
    allLots.filter((l) => getLotCounterKey(l.status) === "active").length,
    true
  );
  await updateCounter(
    ctx,
    "lots",
    "pending",
    allLots.filter((l) => getLotCounterKey(l.status) === "pending").length,
    true
  );
  await updateCounter(
    ctx,
    "lots",
    "draft",
    allLots.filter((l) => getLotCounterKey(l.status) === "draft").length,
    true
  );

  // Bids
  const allBids = await ctx.db.query("bids").collect();
  await updateCounter(ctx, "bids", "total", allBids.length, true);
  // Per-lot valid-bid counters feed the engagement ranking.
  const validBidsByLot = new Map<Id<"lots">, number>();
  for (const bid of allBids) {
    if (bid.status === "voided") continue;
    validBidsByLot.set(bid.lotId, (validBidsByLot.get(bid.lotId) ?? 0) + 1);
  }
  for (const [lotId, count] of validBidsByLot) {
    await updateCounter(ctx, bidCounterName(lotId), "total", count, true);
  }

  const soldLots = allLots.filter((l) => l.status === "sold");
  const salesVolume = soldLots.reduce(
    (sum, l) => sum + (l.currentPrice || 0),
    0
  );

  await updateCounter(ctx, "lots", "salesVolume", salesVolume, true);
  await updateCounter(ctx, "lots", "soldCount", soldLots.length, true);

  // Profiles
  const allProfiles = await ctx.db.query("profiles").collect();
  await updateCounter(ctx, "profiles", "total", allProfiles.length, true);
  await updateCounter(
    ctx,
    "profiles",
    "verified",
    allProfiles.filter((p) => p.isVerified).length,
    true
  );
  await updateCounter(
    ctx,
    "profiles",
    "pending",
    allProfiles.filter((p) => p.kycStatus === "pending").length,
    true
  );

  // Support
  const allTickets = await ctx.db.query("supportTickets").collect();
  await updateCounter(ctx, "support", "total", allTickets.length, true);
  await updateCounter(
    ctx,
    "support",
    "open",
    allTickets.filter((t) => t.status === "open").length,
    true
  );
  await updateCounter(
    ctx,
    "support",
    "resolved",
    allTickets.filter((t) => t.status === "resolved").length,
    true
  );

  // Audit Logs
  const allAuditLogs = await ctx.db.query("auditLogs").collect();
  await updateCounter(ctx, "auditLogs", "total", allAuditLogs.length, true);

  // Lot Fees
  const allLotFees = await ctx.db.query("lotFees").collect();
  const buyerFeesTotal = allLotFees
    .filter((f) => f.appliedTo === "buyer")
    .reduce((sum, f) => sum + f.calculatedAmount, 0);
  const sellerFeesTotal = allLotFees
    .filter((f) => f.appliedTo === "seller")
    .reduce((sum, f) => sum + f.calculatedAmount, 0);
  await updateCounter(ctx, "lotFees", "buyerTotal", buyerFeesTotal, true);
  await updateCounter(ctx, "lotFees", "sellerTotal", sellerFeesTotal, true);

  console.log("Seeding and metric calculation completed successfully.");
}

/**
 * Shared seeding logic for both local development and Vercel Previews.
 * This is idempotent: it checks for existing records before inserting.
 *
 * SECURITY: This mutation is protected by admin authentication, a valid
 * SEED_SECRET, or local development with ALLOW_DEV_SEED=true opt-in.
 */
export const runSeed = mutation({
  args: {
    providedSeed: v.optional(v.string()),
    clear: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const seedSecret = process.env.SEED_SECRET;
    const isSecretMatch = !!seedSecret && args.providedSeed === seedSecret;

    let accessPath: DestructiveAccessPath;

    if (isSecretMatch) {
      accessPath = "secret";
    } else {
      accessPath = await checkDestructiveAccess(ctx);
    }

    console.warn(
      `[seed] Destructive operation invoked via ${accessPath} access path`
    );

    if (accessPath === "admin") {
      const role = await getCallerRole(ctx);
      if (role === "admin") {
        await logAudit(ctx, {
          action: "run_seed",
          targetType: "database",
          details: JSON.stringify({ clear: args.clear ?? false }),
        });
      }
    }

    if (args.clear) {
      const tablesToClear: SeedTableNames[] = [
        "bids",
        "proxy_bids",
        "watchlist",
        "reviews",
        "conversations",
        "messages",
        "notifications",
        "supportTickets",
        "userActivity",
        "lotFlags",
        "profileFlags",
        "lotFees",
        "counters",
        "lotViewers",
        "equipmentMetadata",
        "equipmentCategories",
      ];

      const auctionsCount = await clearAuctionsTableWithStorage(ctx);
      const lotsCount = await clearLotsTableWithStorage(ctx);
      console.log(
        `Cleared ${auctionsCount.toString()} records from auctions with storage.`
      );
      console.log(
        `Cleared ${lotsCount.toString()} records from lots with storage.`
      );

      for (const tableName of tablesToClear) {
        const deletedCount = await clearTable(ctx, tableName);
        console.log(
          `Cleared ${deletedCount.toString()} records from ${tableName}.`
        );
      }
    }

    await performSeed(ctx, { demoFinanceContact: true });

    return null;
  },
});

export const clearAuctions = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const accessPath = await checkDestructiveAccess(ctx);

    console.warn(`[seed] clearAuctions invoked via ${accessPath} access path`);

    if (accessPath === "admin") {
      const role = await getCallerRole(ctx);
      if (role === "admin") {
        await logAudit(ctx, {
          action: "clear_auctions",
          targetType: "database",
        });
      }
    }

    const totalBidsDeleted = await clearTable(ctx, "bids");
    const lotsCount = await clearLotsTableWithStorage(ctx);
    // Watch rows and per-lot / per-sale counters belong to the lots just deleted.
    await clearTable(ctx, "watchlist");
    await clearTable(ctx, "lotViewers");
    await clearLotScopedCounters(ctx);
    const auctionsCount = await clearAuctionsTableWithStorage(ctx);
    const lotFeesCount = await clearTable(ctx, "lotFees");

    await resetLotFeeCounters(ctx);

    console.log(
      `Cleared ${auctionsCount.toString()} auction events, ${lotsCount.toString()} lots, ${totalBidsDeleted.toString()} bids and ${lotFeesCount.toString()} lot fees.`
    );
    return auctionsCount + lotsCount;
  },
});

/**
 * Wipe all user and application data.
 * USE WITH CAUTION.
 */
export const clearAllData = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const accessPath = await checkDestructiveAccess(ctx);

    console.warn(`[seed] clearAllData invoked via ${accessPath} access path`);

    if (accessPath === "admin") {
      const role = await getCallerRole(ctx);
      if (role === "admin") {
        await logAudit(ctx, {
          action: "clear_all_data",
          targetType: "database",
        });
      }
    }

    const appTables: SeedTableNames[] = [
      "bids",
      "watchlist",
      "counters",
      "lotViewers",
      "equipmentMetadata",
      "lotFees",
    ];

    let totalDeleted = 0;

    totalDeleted += await clearAuctionsTableWithStorage(ctx);
    totalDeleted += await clearLotsTableWithStorage(ctx);

    for (const tableName of appTables) {
      totalDeleted += await clearTable(ctx, tableName);
    }

    totalDeleted += await clearProfilesTableWithStorage(ctx);

    await resetLotFeeCounters(ctx);

    return totalDeleted;
  },
});

/**
 * Weekly showcase reset: wipes all mock application data and repopulates it
 * via `performSeed` so the demo deployment never goes stale.
 *
 * Deliberately does NOT call `checkDestructiveAccess`: this is an internal
 * mutation, unreachable from the public API or client, and the cron scheduler
 * invokes it with no caller identity — the admin/environment guard (designed
 * for the public `runSeed`/`clearAuctions`/`clearAllData` mutations) would
 * incorrectly reject it.
 *
 * Admin profiles are preserved, and static reference data
 * (`equipmentCategories`, `equipmentMetadata`, `faqItems`, `platformFees`)
 * is left in place — `performSeed` is idempotent against it anyway.
 */
export const weeklyReset = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.warn(
      "[seed] weeklyReset invoked via system cron (internal mutation)"
    );

    await logAudit(ctx, {
      action: "weekly_reset",
      targetType: "database",
      system: true,
    });

    const auctionsDeleted = await clearAuctionsTableWithStorage(ctx);
    console.log(
      `Cleared ${auctionsDeleted.toString()} records from auctions with storage.`
    );

    const lotsDeleted = await clearLotsTableWithStorage(ctx);
    console.log(
      `Cleared ${lotsDeleted.toString()} records from lots with storage.`
    );

    const tablesToClear: SeedTableNames[] = [
      "bids",
      "proxy_bids",
      "watchlist",
      "reviews",
      "conversations",
      "messages",
      "notifications",
      "supportTickets",
      "userActivity",
      "lotFlags",
      "profileFlags",
      "lotFees",
      "counters",
      "lotViewers",
    ];
    for (const tableName of tablesToClear) {
      const deletedCount = await clearTable(ctx, tableName);
      console.log(
        `Cleared ${deletedCount.toString()} records from ${tableName}.`
      );
    }

    const deletedProfiles = await deleteNonAdminProfiles(ctx);
    console.log(
      `Cleared ${deletedProfiles.toString()} non-admin profiles (admin profiles preserved).`
    );

    await ensureMockSellerProfile(ctx);

    // Production-safe: no demo finance contact (see performSeed).
    await performSeed(ctx, { demoFinanceContact: false });

    return null;
  },
});
