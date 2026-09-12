// app/convex/seed.ts
import { v } from "convex/values";

import { internalMutation, mutation } from "./_generated/server";
import { MS_PER_DAY, MS_PER_HOUR } from "./constants";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getCallerRole } from "./lib/auth";
import { updateCounter } from "./admin_utils";

type SeedTableNames =
  | "auctions"
  | "bids"
  | "profiles"
  | "watchlist"
  | "equipmentMetadata"
  | "equipmentCategories"
  | "counters"
  | "proxy_bids"
  | "reviews"
  | "conversations"
  | "messages"
  | "notifications"
  | "supportTickets"
  | "userActivity"
  | "auctionFlags"
  | "profileFlags"
  | "auctionFees";

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

const BATCH_SIZE = 500;

const MOCK_SELLER_EMAIL = "mock-seller@farm.com";
const MOCK_ADMIN_EMAIL = "admin@agribid.com";

/**
 * userId used for the synthetic mock-seller profile recreated by the weekly
 * reset. It is display-only and can never authenticate.
 */
const MOCK_SELLER_FALLBACK_USER_ID = "mock-seller";

/** Synthetic buyer identities that bid on, watch and discuss mock auctions. */
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
  },
  {
    userId: "mock-seller-3",
    name: "Highveld Machinery Co",
    email: "mock-seller-3@agribid.demo",
    location: "Pretoria, ZA",
    bio: "Family-run machinery dealership serving Highveld farmers since 1994.",
    createdDaysAgo: 150,
  },
];

interface MockAuction {
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
  startTime?: number;
  endTime?: number;
  settledAt?: number;
  winnerId?: string | null;
  sellerId: string;
  status: "draft" | "pending_review" | "active" | "sold" | "unsold";
  images: {
    front: string;
    engine: string;
    cabin: string;
    additional: string[];
  };
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
 * Ascending bid amounts for every active mock auction. The last amount of
 * each list equals that auction's `currentPrice` and every step respects the
 * auction's `minIncrement`.
 */
const ACTIVE_BID_AMOUNTS: Record<string, number[]> = {
  "jd-8r-410": [260000, 267500, 275000],
  "case-magnum-380": [205000, 210000, 215000],
  "nh-t7-315": [155000, 160000, 165000],
  "mf-8s-305": [141500, 143000],
  "fendt-1050": [310000, 325000],
  "case-axial-flow-8250": [224000, 230000, 236000],
  "jd-r4038": [173500, 178500, 184000],
  "case-early-riser-2150": [97000, 100000, 103000],
  "case-ecolo-tiger-875": [41500, 43000, 44500],
  "nh-speedrower-260": [56500, 58000, 59500, 61000],
  "jcb-541-70": [72000, 75000, 78000],
  "bell-l1206e": [123500, 127000, 130500, 134000],
};

/** Winning bid sequences for sold auctions; the last bid is the winner. */
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

/** Reviews left by the winning buyers of sold mock auctions. */
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

/** Mock buyers watching active mock auctions. */
const WATCHLIST_PLANS: { userId: string; seedId: string }[] = [
  { userId: "mock-buyer-1", seedId: "case-axial-flow-8250" },
  { userId: "mock-buyer-2", seedId: "jd-8r-410" },
  { userId: "mock-buyer-3", seedId: "jcb-541-70" },
  { userId: "mock-buyer-4", seedId: "nh-speedrower-260" },
  { userId: "mock-buyer-5", seedId: "bell-l1206e" },
  { userId: "mock-buyer-6", seedId: "jd-r4038" },
];

/** Sentinel standing in for the live mock seller's Clerk-synced userId. */
const MOCK_SELLER_KEY = "mock-seller";

const CONVERSATION_PLANS: {
  buyerId: string;
  /** {@link MOCK_SELLER_KEY} or a synthetic seller userId. */
  sellerId: string;
  auctionSeedId: string;
  startedDaysAgo: number;
  messages: MockMessagePlan[];
}[] = [
  {
    buyerId: "mock-buyer-1",
    sellerId: "mock-seller-2",
    auctionSeedId: "jd-s780",
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
    auctionSeedId: "nh-speedrower-260",
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
    auctionSeedId: "jd-r4038",
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
 * Enforces that destructive operations are permitted only for admin callers or when running in a safe environment.
 *
 * @param ctx - Mutation context used to determine the caller's role for access validation.
 * @throws Error if the caller is not an admin and both NODE_ENV and VERCEL_ENV are undefined.
 * @throws Error if the caller is not an admin and the current environment is neither "development" nor Vercel "preview".
 */
async function checkDestructiveAccess(ctx: MutationCtx) {
  const nodeEnv = process.env.NODE_ENV;
  const vercelEnv = process.env.VERCEL_ENV;
  const role = await getCallerRole(ctx);
  const isAdmin = role === "admin";

  // Admin bypass: Admins are always allowed to perform destructive operations
  if (isAdmin) return;

  // SECURITY: Explicitly validate environment variables to prevent silent degradation.
  // These variables must be set in the Convex dashboard or via CLI (e.g., bunx convex env set NODE_ENV development).
  if (nodeEnv === undefined && vercelEnv === undefined) {
    throw new Error(
      "Unauthorized: Deployment environment is indeterminate (NODE_ENV and VERCEL_ENV are undefined). " +
        "Destructive operations are blocked for non-admins to prevent accidental data loss in production."
    );
  }

  const isDev = nodeEnv === "development";
  const isPreview = vercelEnv === "preview";

  if (!isDev && !isPreview) {
    throw new Error(
      `Unauthorized: Destructive operations are only allowed in development or preview environments. ` +
        `Current environment: ${nodeEnv ?? vercelEnv ?? "unknown"}.`
    );
  }
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
    await Promise.all(batch.map((item) => ctx.db.delete(item._id)));
    deletedCount += batch.length;
    batch = await ctx.db.query(tableName).take(BATCH_SIZE);
  }
  return deletedCount;
}

/**
 * Deletes every profile whose role is not "admin".
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
    await Promise.all(batch.map((profile) => ctx.db.delete(profile._id)));
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
 * Inserts a realistic ascending bid history for one auction (skipped when the
 * auction already has bids, keeping reseeds idempotent). Timestamps are
 * spread evenly between `windowStart` and `windowEnd`.
 *
 * @param ctx - Mutation context.
 * @param auction - The auction to seed bids for.
 * @param plan - Bid amounts, bidders and the time window to spread over.
 */
async function seedMockBids(
  ctx: MutationCtx,
  auction: Doc<"auctions">,
  plan: MockBidPlan
): Promise<void> {
  const existingBid = await ctx.db
    .query("bids")
    .withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
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
      auctionId: auction._id,
      bidderId: bid.bidderId,
      amount: bid.amount,
      timestamp,
      status: "valid",
    });
  }
}

/**
 * Populates the database with the full showcase dataset: categories, equipment
 * metadata, mock users, auctions, and every related record (bids, proxy bids,
 * reviews, auction fees, watchlist, conversations, notifications, support
 * tickets, user activity and moderation flags), followed by FAQ and counters.
 *
 * Idempotent: rows with a natural unique key (categories, metadata, profiles,
 * auctions, bids, reviews, watchlist, conversations, proxy bids, auction fees)
 * are only inserted when absent. Records without one (notifications, support
 * tickets, user activity, flags) are only seeded while their table is empty.
 *
 * @param ctx - Mutation context.
 */
async function performSeed(ctx: MutationCtx): Promise<void> {
  const now = Date.now();

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
      await ctx.db.patch(existing._id, {
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
    await ctx.db.patch(sellerProfile._id, {
      role: "seller",
      isVerified: true,
      updatedAt: now,
    });
  }

  // 2.5. Promote Mock Admin User Profile (Idempotent)
  const adminProfile = await ctx.db
    .query("profiles")
    .filter((q) => q.eq(q.field("email"), MOCK_ADMIN_EMAIL))
    .first();

  if (adminProfile && adminProfile.role !== "admin") {
    await ctx.db.patch(adminProfile._id, {
      role: "admin",
      isVerified: true,
      updatedAt: now,
    });
  }

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
    if (existing) continue;

    await ctx.db.insert("profiles", {
      userId: seller.userId,
      name: seller.name,
      email: seller.email,
      role: "seller",
      isVerified: true,
      kycStatus: "verified",
      location: seller.location,
      bio: seller.bio,
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
      value: 5,
      appliesTo: "seller",
      isActive: true,
      visibleToBuyer: true,
      visibleToSeller: true,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("platformFees", {
      name: "Buyer's Premium",
      description:
        "Percentage premium added to the winning bid, paid by the buyer.",
      feeType: "percentage",
      value: 2,
      appliesTo: "buyer",
      isActive: true,
      visibleToBuyer: true,
      visibleToSeller: true,
      sortOrder: 2,
      createdAt: now,
      updatedAt: now,
    });
  }

  // 3. Seed Mock Auctions
  const mockAuctions: MockAuction[] = [
    {
      seedId: "jd-8r-410",
      title: "John Deere 8R 410 — Row Crop Titan",
      categoryId: getCategoryId("Tractor"),
      make: "John Deere",
      model: "8R 410",
      year: 2023,
      operatingHours: 450,
      location: "Moline, IL",
      description:
        "This 2023 John Deere 8R 410 is in excellent condition with low hours. Features the Row Crop Titan package, premium cab, and advanced telemetry. Full service history available. Perfect for large-scale production.",
      reservePrice: 385000,
      startingPrice: 250000,
      currentPrice: 275000,
      minIncrement: 5000,
      startTime: now - MS_PER_DAY,
      endTime: now + 3 * MS_PER_DAY,
      sellerId: sellerId,
      status: "active" as const,
      images: {
        front: MOCK_IMAGE_URLS.JD_FRONT,
        engine: MOCK_IMAGE_URLS.JD_ENGINE,
        cabin: MOCK_IMAGE_URLS.JD_CABIN,
        additional: [],
      },
    },
    {
      seedId: "case-magnum-380",
      title: "Case IH Magnum 380 — Prairie Powerhouse",
      categoryId: getCategoryId("Tractor"),
      make: "Case IH",
      model: "Magnum 380",
      year: 2022,
      operatingHours: 820,
      location: "Racine, WI",
      description:
        "A 2022 Case IH Magnum 380, the ultimate Prairie Powerhouse. Features the CVXDrive transmission, luxury AFS Connect cab, and dual wheels for maximum traction. Exceptionally well-maintained unit.",
      reservePrice: 320000,
      startingPrice: 200000,
      currentPrice: 215000,
      minIncrement: 2500,
      startTime: now - 2 * MS_PER_DAY,
      endTime: now + 4 * MS_PER_DAY,
      sellerId: sellerId,
      status: "active" as const,
      images: {
        front: MOCK_IMAGE_URLS.CASE_FRONT,
        engine: MOCK_IMAGE_URLS.CASE_ENGINE,
        cabin: MOCK_IMAGE_URLS.CASE_CABIN,
        additional: [],
      },
    },
    {
      seedId: "nh-t7-315",
      title: "New Holland T7.315 — Blue Diamond",
      categoryId: getCategoryId("Tractor"),
      make: "New Holland",
      model: "T7.315",
      year: 2023,
      operatingHours: 210,
      location: "Basildon, UK",
      description:
        "The 2023 New Holland T7.315 Blue Diamond edition. Low operating hours, heavy-duty rear hitch, and PLM Intelligence. Versatile machine for both tillage and transport work.",
      reservePrice: 245000,
      startingPrice: 150000,
      currentPrice: 165000,
      minIncrement: 2000,
      startTime: now - MS_PER_DAY,
      endTime: now + 5 * MS_PER_DAY,
      sellerId: sellerId,
      status: "active" as const,
      images: {
        front: MOCK_IMAGE_URLS.NH_FRONT,
        engine: MOCK_IMAGE_URLS.NH_ENGINE,
        cabin: MOCK_IMAGE_URLS.NH_CABIN,
        additional: [],
      },
    },
    {
      seedId: "mf-8s-305",
      title: "Massey Ferguson 8S.305 — Crimson Legend",
      categoryId: getCategoryId("Tractor"),
      make: "Massey Ferguson",
      model: "8S.305",
      year: 2024,
      operatingHours: 15,
      location: "Beauvais, FR",
      description:
        "Virtually new 2024 Massey Ferguson 8S.305. The Crimson Legend features the innovative Protect-U design, Dyna-VT transmission, and exceptional visibility. Demonstration unit with only 15 delivery hours.",
      reservePrice: 210000,
      startingPrice: 140000,
      currentPrice: 143000,
      minIncrement: 1500,
      startTime: now - 3 * MS_PER_DAY,
      endTime: now + 2 * MS_PER_DAY,
      sellerId: sellerId,
      status: "active" as const,
      images: {
        front: MOCK_IMAGE_URLS.MF_FRONT,
        engine: MOCK_IMAGE_URLS.MF_ENGINE,
        cabin: MOCK_IMAGE_URLS.MF_CABIN,
        additional: [],
      },
    },
    {
      seedId: "fendt-1050",
      title: "Fendt 1050 Vario — German Precision",
      categoryId: getCategoryId("Tractor"),
      make: "Fendt",
      model: "1050 Vario",
      year: 2023,
      operatingHours: 580,
      location: "Marktoberdorf, DE",
      description:
        "2023 Fendt 1050 Vario, the peak of German Precision engineering. Fendt iD low engine speed concept, VarioDrive, and LifeCab. A powerhouse for the most demanding agricultural tasks.",
      reservePrice: 450000,
      startingPrice: 300000,
      currentPrice: 325000,
      minIncrement: 10000,
      startTime: now - MS_PER_DAY,
      endTime: now + 6 * MS_PER_DAY,
      sellerId: sellerId,
      status: "active" as const,
      images: {
        front: MOCK_IMAGE_URLS.FENDT_FRONT,
        engine: MOCK_IMAGE_URLS.FENDT_ENGINE,
        cabin: MOCK_IMAGE_URLS.FENDT_CABIN,
        additional: [],
      },
    },
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
      startTime: now - 12 * MS_PER_DAY,
      endTime: now - 2 * MS_PER_DAY,
      settledAt: now - 2 * MS_PER_DAY,
      winnerId: "mock-buyer-1",
      sellerId: "mock-seller-2",
      status: "sold" as const,
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
      startTime: now - MS_PER_DAY,
      endTime: now + 4 * MS_PER_DAY,
      sellerId: "mock-seller-3",
      status: "active" as const,
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
      startTime: now - 2 * MS_PER_DAY,
      endTime: now + 3 * MS_PER_DAY,
      sellerId: sellerId,
      status: "active" as const,
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
      startTime: now - MS_PER_DAY,
      endTime: now + 5 * MS_PER_DAY,
      sellerId: "mock-seller-2",
      status: "active" as const,
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
      startTime: now - 13 * MS_PER_DAY,
      endTime: now - 3 * MS_PER_DAY,
      settledAt: now - 3 * MS_PER_DAY,
      winnerId: "mock-buyer-2",
      sellerId: "mock-seller-3",
      status: "sold" as const,
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
      startTime: now - 3 * MS_PER_DAY,
      endTime: now + 2 * MS_PER_DAY,
      sellerId: "mock-seller-2",
      status: "active" as const,
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
      startTime: now - 2 * MS_PER_DAY,
      endTime: now + 6 * MS_PER_DAY,
      sellerId: "mock-seller-3",
      status: "active" as const,
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
      startTime: now - 9 * MS_PER_DAY,
      endTime: now - 2 * MS_PER_DAY,
      settledAt: now - 2 * MS_PER_DAY,
      winnerId: null,
      sellerId: "mock-seller-3",
      status: "unsold" as const,
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
      startTime: now - MS_PER_DAY,
      endTime: now + 2 * MS_PER_DAY,
      sellerId: sellerId,
      status: "active" as const,
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
      startTime: now - 10 * MS_PER_DAY,
      endTime: now - MS_PER_DAY,
      settledAt: now - MS_PER_DAY,
      winnerId: null,
      sellerId: "mock-seller-2",
      status: "unsold" as const,
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
      startTime: now - 4 * MS_PER_DAY,
      endTime: now + MS_PER_DAY,
      sellerId: "mock-seller-3",
      status: "active" as const,
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
      startTime: now - 15 * MS_PER_DAY,
      endTime: now - 5 * MS_PER_DAY,
      settledAt: now - 5 * MS_PER_DAY,
      winnerId: "mock-buyer-3",
      sellerId: "mock-seller-2",
      status: "sold" as const,
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
        "2021 6120M utility tractor with CommandQuad 24/24 transmission, 440R loader-ready package and low hours. Awaiting admin approval before going live.",
      reservePrice: 95000,
      startingPrice: 65000,
      currentPrice: 65000,
      minIncrement: 1000,
      sellerId: "mock-seller-3",
      status: "pending_review" as const,
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
        "Puma 155 with CVX continuously variable transmission, AFS Pro 700 display and 4 remote hydraulics. Submitted for review — expected to list shortly.",
      reservePrice: 88000,
      startingPrice: 60000,
      currentPrice: 60000,
      minIncrement: 1000,
      sellerId: sellerId,
      status: "pending_review" as const,
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
      status: "draft" as const,
      images: {
        front: MOCK_IMAGE_URLS.MF_FRONT,
        engine: MOCK_IMAGE_URLS.MF_ENGINE,
        cabin: MOCK_IMAGE_URLS.MF_CABIN,
        additional: [],
      },
    },
  ];

  for (const auction of mockAuctions) {
    const existing = await ctx.db
      .query("auctions")
      .withIndex("by_seedId", (q) => q.eq("seedId", auction.seedId))
      .first();

    const auctionData = {
      ...auction,
      description: auction.description || "No description provided.",
    };

    if (!existing) {
      await ctx.db.insert("auctions", auctionData);
    } else {
      await ctx.db.patch(existing._id, auctionData);
    }
  }

  // 3.5. Index the seeded auctions for related-record seeding
  const auctionsBySeedId = new Map<string, Doc<"auctions">>();
  for (const auction of await ctx.db.query("auctions").collect()) {
    if (auction.seedId) {
      auctionsBySeedId.set(auction.seedId, auction);
    }
  }

  /**
   * Helper to look up a seeded auction by its seedId, throwing if not found.
   * @param seedId - The stable seed identifier of the auction.
   * @returns The auction document.
   */
  const getAuctionBySeedId = (seedId: string): Doc<"auctions"> => {
    const auction = auctionsBySeedId.get(seedId);
    if (!auction) {
      throw new Error(`Missing seeded auction "${seedId}"`);
    }
    return auction;
  };

  // 3.6. Seed bids for active auctions (skipped when bids already exist)
  for (const [idx, [seedId, amounts]] of Object.entries(
    ACTIVE_BID_AMOUNTS
  ).entries()) {
    const auction = getAuctionBySeedId(seedId);
    const buyerPool = [
      ...MOCK_BUYER_IDS.slice(idx),
      ...MOCK_BUYER_IDS.slice(0, idx),
    ];
    const bids = amounts.map((amount) => {
      const bidderId = buyerPool.shift() ?? MOCK_BUYER_IDS[0];
      return { bidderId, amount };
    });
    await seedMockBids(ctx, auction, {
      bids,
      windowStart: now - MS_PER_DAY,
      windowEnd: now - MS_PER_HOUR,
    });
  }

  // 3.7. Seed winning bid sequences for sold auctions
  for (const plan of SOLD_BID_PLANS) {
    const auction = getAuctionBySeedId(plan.seedId);
    const end = auction.endTime ?? now;
    await seedMockBids(ctx, auction, {
      bids: plan.bids,
      windowStart: end - 2 * MS_PER_DAY,
      windowEnd: end,
    });
  }

  // 3.8. Seed proxy bids for a couple of active auctions
  const proxyBidPlans: {
    seedId: string;
    bidderId: string;
    maxBid: number;
  }[] = [
    { seedId: "jd-8r-410", bidderId: "mock-buyer-6", maxBid: 290000 },
    {
      seedId: "case-axial-flow-8250",
      bidderId: "mock-buyer-1",
      maxBid: 248000,
    },
  ];
  for (const plan of proxyBidPlans) {
    const auction = getAuctionBySeedId(plan.seedId);
    const existingProxy = await ctx.db
      .query("proxy_bids")
      .withIndex("by_bidder_auction", (q) =>
        q.eq("bidderId", plan.bidderId).eq("auctionId", auction._id)
      )
      .unique();
    if (!existingProxy) {
      await ctx.db.insert("proxy_bids", {
        auctionId: auction._id,
        bidderId: plan.bidderId,
        maxBid: plan.maxBid,
        updatedAt: now,
      });
    }
  }

  // 3.9. Seed reviews from the winning buyers of sold auctions
  for (const plan of REVIEW_PLANS) {
    const auction = getAuctionBySeedId(plan.seedId);
    const existingReview = await ctx.db
      .query("reviews")
      .withIndex("by_auction_reviewer", (q) =>
        q.eq("auctionId", auction._id).eq("reviewerId", plan.reviewerId)
      )
      .unique();
    if (existingReview) continue;

    const createdAt =
      (auction.settledAt ?? now) + plan.daysAfterSettlement * MS_PER_DAY;
    await ctx.db.insert("reviews", {
      auctionId: auction._id,
      reviewerId: plan.reviewerId,
      revieweeId: auction.sellerId,
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

  // 3.10. Seed auction fee ledger rows for sold auctions
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
      const auction = getAuctionBySeedId(plan.seedId);
      const existingFeeRow = await ctx.db
        .query("auctionFees")
        .withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
        .first();
      if (existingFeeRow) continue;

      const salePrice = auction.currentPrice;
      const settledAt = auction.settledAt ?? now;
      await ctx.db.insert("auctionFees", {
        auctionId: auction._id,
        feeId: sellerFee._id,
        feeName: sellerFee.name,
        appliedTo: "seller",
        feeType: sellerFee.feeType,
        rate: sellerFee.value,
        salePrice,
        calculatedAmount: Math.round((salePrice * sellerFee.value) / 100),
        createdAt: settledAt,
      });
      await ctx.db.insert("auctionFees", {
        auctionId: auction._id,
        feeId: buyerFee._id,
        feeName: buyerFee.name,
        appliedTo: "buyer",
        feeType: buyerFee.feeType,
        rate: buyerFee.value,
        salePrice,
        calculatedAmount: Math.round((salePrice * buyerFee.value) / 100),
        createdAt: settledAt,
      });
    }
  }

  // 3.11. Seed watchlist entries on active auctions
  for (const plan of WATCHLIST_PLANS) {
    const auction = getAuctionBySeedId(plan.seedId);
    const existingEntry = await ctx.db
      .query("watchlist")
      .withIndex("by_user_auction", (q) =>
        q.eq("userId", plan.userId).eq("auctionId", auction._id)
      )
      .first();
    if (!existingEntry) {
      await ctx.db.insert("watchlist", {
        userId: plan.userId,
        auctionId: auction._id,
      });
    }
  }

  // 3.12. Seed buyer/seller conversations with message threads
  for (const plan of CONVERSATION_PLANS) {
    const auction = getAuctionBySeedId(plan.auctionSeedId);
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
      auctionId: auction._id,
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

    await ctx.db.patch(conversationId, { lastMessageAt });
  }

  // 3.13. Seed notifications (only while the table is empty)
  const existingNotification = await ctx.db.query("notifications").first();
  if (!existingNotification) {
    const jd8r = getAuctionBySeedId("jd-8r-410");
    const jdS780 = getAuctionBySeedId("jd-s780");
    const speedrower = getAuctionBySeedId("nh-speedrower-260");

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
        link: `/auctions/${jd8r._id}`,
        isRead: false,
        createdAt: now - 5 * MS_PER_HOUR,
      },
      {
        recipientId: "mock-buyer-1",
        type: "success",
        title: "Auction won",
        message: `Congratulations — you won ${jdS780.title}.`,
        link: `/auctions/${jdS780._id}`,
        isRead: true,
        createdAt: (jdS780.settledAt ?? now) + MS_PER_HOUR,
      },
      {
        recipientId: "mock-seller-3",
        type: "success",
        title: "Listing approved",
        message: `Your listing ${speedrower.title} has been approved and is now live.`,
        link: `/auctions/${speedrower._id}`,
        isRead: false,
        createdAt: now - 2 * MS_PER_DAY,
      },
    ];

    for (const plan of notificationPlans) {
      await ctx.db.insert("notifications", plan);
    }
  }

  // 3.14. Seed support tickets (only while the table is empty)
  const existingTicket = await ctx.db.query("supportTickets").first();
  if (!existingTicket) {
    const bellLoader = getAuctionBySeedId("bell-l1206e");
    const cat320 = getAuctionBySeedId("cat-320-gc");

    const ticketPlans: {
      userId: string;
      auctionId?: Id<"auctions">;
      subject: string;
      message: string;
      priority: "low" | "medium" | "high";
      status: "open" | "resolved" | "closed";
      createdDaysAgo: number;
      updatedDaysAgo: number;
    }[] = [
      {
        userId: "mock-buyer-5",
        auctionId: bellLoader._id,
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
        auctionId: cat320._id,
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
          "Can I update the reserve price while my auction is still running?",
        priority: "low",
        status: "resolved",
        createdDaysAgo: 6,
        updatedDaysAgo: 5,
      },
    ];

    for (const plan of ticketPlans) {
      await ctx.db.insert("supportTickets", {
        userId: plan.userId,
        auctionId: plan.auctionId,
        subject: plan.subject,
        message: plan.message,
        priority: plan.priority,
        status: plan.status,
        createdAt: now - plan.createdDaysAgo * MS_PER_DAY,
        updatedAt: now - plan.updatedDaysAgo * MS_PER_DAY,
      });
    }
  }

  // 3.15. Seed the per-user activity feeds (only while the table is empty)
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

    for (const auction of mockAuctions) {
      const auctionDoc = getAuctionBySeedId(auction.seedId);
      await ctx.db.insert("userActivity", {
        userId: auction.sellerId,
        type: "listing_created",
        description: `Created listing: ${auction.title}`,
        relatedId: auctionDoc._id,
        createdAt: auction.startTime ?? now - MS_PER_DAY,
      });
    }

    const allSeededBids = await ctx.db.query("bids").collect();
    const topBidByAuction = new Map<Id<"auctions">, Doc<"bids">>();
    for (const bid of allSeededBids) {
      const current = topBidByAuction.get(bid.auctionId);
      if (!current || bid.timestamp > current.timestamp) {
        topBidByAuction.set(bid.auctionId, bid);
      }
    }
    for (const [auctionId, bid] of topBidByAuction) {
      const auction = await ctx.db.get(auctionId);
      if (!auction) continue;
      await ctx.db.insert("userActivity", {
        userId: bid.bidderId,
        type: "bid_placed",
        description: `Placed a bid of $${bid.amount.toLocaleString()} on ${auction.title}`,
        relatedId: auctionId,
        createdAt: bid.timestamp,
      });
    }

    for (const plan of SOLD_BID_PLANS) {
      const auction = getAuctionBySeedId(plan.seedId);
      const winningBid = plan.bids[plan.bids.length - 1];
      if (!winningBid) continue;
      await ctx.db.insert("userActivity", {
        userId: winningBid.bidderId,
        type: "bid_won",
        description: `Won the auction for ${auction.title}`,
        relatedId: auction._id,
        createdAt: auction.settledAt ?? now,
      });
    }
  }

  // 3.16. Seed one pending auction flag (only while the table is empty)
  const existingAuctionFlag = await ctx.db.query("auctionFlags").first();
  if (!existingAuctionFlag) {
    const flaggedAuction = getAuctionBySeedId("jcb-541-70");
    await ctx.db.insert("auctionFlags", {
      auctionId: flaggedAuction._id,
      reporterId: "mock-buyer-4",
      reason: "misleading",
      details:
        "Operating hours appear inconsistent with the wear shown in the photos.",
      status: "pending",
      createdAt: now - 12 * MS_PER_HOUR,
    });
  }

  // 3.17. Seed one profile flag (only while the table is empty)
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
        "Create a free account, then complete KYC (Know Your Customer) verification under your profile. Once approved, you can bid on any active auction.",
    },
    {
      question: "How does the bidding process work?",
      answer:
        "Each auction lists a starting price and minimum bid increment. Place your bid before the countdown timer reaches zero. The highest bid when the timer expires wins — if the reserve price has been met.",
    },
    {
      question: "What is a reserve price?",
      answer:
        "A reserve price is the minimum amount the seller is willing to accept. If bidding does not reach the reserve, the auction closes as 'Unsold' and no sale is concluded.",
    },
    {
      question: "How do I list equipment for auction?",
      answer:
        "Navigate to the Sell page, complete the listing form with equipment details, photos, and pricing, then submit for admin review. Approved listings go live automatically.",
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

  // 5. Update Metrics (Counters)
  // Recalculate everything to ensure consistency after seeding

  // Auctions
  const allAuctions = await ctx.db.query("auctions").collect();
  await updateCounter(ctx, "auctions", "total", allAuctions.length, true);
  await updateCounter(
    ctx,
    "auctions",
    "active",
    allAuctions.filter((a) => a.status === "active").length,
    true
  );
  await updateCounter(
    ctx,
    "auctions",
    "draft",
    allAuctions.filter((a) => a.status === "draft").length,
    true
  );

  // Bids
  const allBids = await ctx.db.query("bids").collect();
  await updateCounter(ctx, "bids", "total", allBids.length, true);

  const salesVolume = allAuctions
    .filter((a) => a.status === "sold" && a.currentPrice)
    .reduce((sum, a) => sum + (a.currentPrice || 0), 0);
  const soldCount = allAuctions.filter((a) => a.status === "sold").length;

  await updateCounter(ctx, "auctions", "salesVolume", salesVolume, true);
  await updateCounter(ctx, "auctions", "soldCount", soldCount, true);

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

  console.log("Seeding and metric calculation completed successfully.");
}

/**
 * Shared seeding logic for both local development and Vercel Previews.
 * This is idempotent: it checks for existing records before inserting.
 *
 * SECURITY: This mutation is protected by environment checks, admin status,
 * or a valid providedSeed matching process.env.SEED_SECRET.
 */
export const runSeed = mutation({
  args: {
    providedSeed: v.optional(v.string()),
    clear: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // --- SECURITY GUARD ---
    const seedSecret = process.env.SEED_SECRET;
    const isSecretMatch = !!seedSecret && args.providedSeed === seedSecret;

    if (!isSecretMatch) {
      await checkDestructiveAccess(ctx);
    }
    // -----------------------

    if (args.clear) {
      const tablesToClear: SeedTableNames[] = [
        "auctions",
        "bids",
        "proxy_bids",
        "watchlist",
        "reviews",
        "conversations",
        "messages",
        "notifications",
        "supportTickets",
        "userActivity",
        "auctionFlags",
        "profileFlags",
        "auctionFees",
        "counters",
        "equipmentMetadata",
        "equipmentCategories",
      ];
      for (const tableName of tablesToClear) {
        const deletedCount = await clearTable(ctx, tableName);
        console.log(
          `Cleared ${deletedCount.toString()} records from ${tableName}.`
        );
      }

      // Note: Clerk manages user/session/account data externally — there is
      // no Convex-side auth table to wipe here anymore.
    }

    await performSeed(ctx);

    return null;
  },
});

export const clearAuctions = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await checkDestructiveAccess(ctx);

    // 1. Sweep and delete all bids first to avoid nested loops/long mutations
    const totalBidsDeleted = await clearTable(ctx, "bids");

    // 2. Delete auctions in batches
    const auctionsCount = await clearTable(ctx, "auctions");

    console.log(
      `Cleared ${auctionsCount.toString()} auctions and ${totalBidsDeleted.toString()} bids.`
    );
    return auctionsCount;
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
    await checkDestructiveAccess(ctx);

    const appTables: SeedTableNames[] = [
      "auctions",
      "bids",
      "profiles",
      "watchlist",
      "equipmentMetadata",
    ];

    let totalDeleted = 0;

    // Clear App Tables
    for (const tableName of appTables) {
      totalDeleted += await clearTable(ctx, tableName);
    }

    // Note: Clerk manages user/session/account data externally — there is no
    // Convex-side auth table to wipe here anymore.

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
    const tablesToClear: SeedTableNames[] = [
      "auctions",
      "bids",
      "proxy_bids",
      "watchlist",
      "reviews",
      "conversations",
      "messages",
      "notifications",
      "supportTickets",
      "userActivity",
      "auctionFlags",
      "profileFlags",
      "auctionFees",
      "counters",
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

    // performSeed requires the mock seller profile to exist, and its
    // Clerk-synced profile was just removed above — recreate the synthetic
    // stand-in so the reseed can resolve it.
    await ensureMockSellerProfile(ctx);

    await performSeed(ctx);

    return null;
  },
});
