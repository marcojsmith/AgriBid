// app/convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import {
  driveValidator,
  imageAnglesValidator,
  sellerTypeValidator,
} from "./lib/lotSpecs";
import {
  provinceValidator,
  sellerResponseTimeValidator,
} from "./lib/provinces";

export default defineSchema({
  // AgriBid Tables
  equipmentCategories: defineTable({
    name: v.string(),
    isActive: v.boolean(),
  }).index("by_name", ["name"]),

  equipmentMetadata: defineTable({
    make: v.string(),
    models: v.array(v.string()),
    categoryId: v.optional(v.id("equipmentCategories")),
    category: v.optional(v.string()), // legacy field
    isActive: v.optional(v.boolean()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_make", ["make"])
    .index("by_category", ["categoryId"])
    .index("by_isActive", ["isActive"]),

  auctions: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    bannerImage: v.optional(v.id("_storage")),
    startTime: v.number(),
    endTime: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("closed")
    ),
    // Auction-wide defaults, inherited by lots unless a lot overrides at assignment time (see task 5 / fees rework)
    defaultBuyerPremiumPct: v.optional(v.number()),
    defaultSellerCommissionPct: v.optional(v.number()),
    createdBy: v.string(), // admin userId
    // Stable import key (`wbt:auction:<source id>`) set only by the webuytractors.shop
    // demo import; `seed:weeklyReset` re-times and resets only sales that have one.
    seedId: v.optional(v.string()),
    // Where an imported sale sits on the demo timeline (see `saleWindow`).
    demoRole: v.optional(
      v.union(v.literal("live"), v.literal("upcoming"), v.literal("closed"))
    ),
    // 1 = the newest closed imported sale; 0 for live and upcoming sales.
    demoOrder: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_seedId", ["seedId"])
    .index("by_status", ["status"])
    .index("by_startTime", ["startTime"])
    .index("by_status_startTime", ["status", "startTime"])
    .index("by_status_endTime", ["status", "endTime"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["status"],
    }),

  lots: defineTable({
    title: v.string(),
    make: v.string(),
    model: v.string(),
    year: v.number(),
    operatingHours: v.number(),
    location: v.string(),
    categoryId: v.optional(v.id("equipmentCategories")),
    reservePrice: v.number(),
    startingPrice: v.number(),
    currentPrice: v.number(),
    minIncrement: v.number(),
    settledAt: v.optional(v.number()), // When the lot was settled (sold/unsold)
    durationDays: v.optional(v.number()),
    sellerId: v.string(),
    // `live` is not stored: liveness is derived at query time from `auctionId` + the parent auction's window.
    status: v.union(
      v.literal("draft"),
      v.literal("pending_review"),
      v.literal("approved"),
      v.literal("assigned"),
      // Closed with bids but the reserve was not met: the seller has until
      // `considerationDeadline` to accept the top bid (-> sold) or decline
      // (-> unsold; also what happens when the deadline passes).
      v.literal("under_consideration"),
      v.literal("sold"),
      v.literal("unsold"),
      v.literal("rejected")
    ),
    // Deadline (ms) of the seller's decision while `under_consideration`.
    considerationDeadline: v.optional(v.number()),
    auctionId: v.optional(v.id("auctions")),
    // Sequential number within the parent sale, assigned on auction assignment
    // from a monotonic per-auction counter. Stable; cleared when `auctionId` is.
    lotNumber: v.optional(v.number()),
    // South African province the equipment is located in (seller-set, admin-editable).
    province: v.optional(provinceValidator),
    extendedEndTime: v.optional(v.number()), // effectiveLotEndTime = extendedEndTime ?? auction.endTime
    // Snapshot of the parent auction's fee defaults at assignment time, so later auction edits don't change an already-assigned lot's fees.
    resolvedBuyerPremiumPct: v.optional(v.number()),
    resolvedSellerCommissionPct: v.optional(v.number()),
    // Where `resolvedSellerCommissionPct` came from. Only "auction" exists: the
    // snapshot is the single seller commission (active seller % platformFees
    // rows are ignored). Undefined on legacy lots (their snapshot also came
    // from the auction). There is no platform commission default.
    commissionSource: v.optional(v.literal("auction")),
    // Where `resolvedBuyerPremiumPct` came from. "auction": the snapshot is the
    // single buyer premium (active buyer % platformFees rows are ignored).
    // "platform": informational only (kept for audit and as the display
    // fallback for legacy settled lots with no ledger row); live estimates and
    // settlement use active buyer % fee rows if any, else the platform default
    // read at that moment, and settlement persists it to `lotFees`. Undefined on
    // legacy lots (a legacy snapshot always came from the auction).
    premiumSource: v.optional(
      v.union(v.literal("auction"), v.literal("platform"))
    ),
    // Seller VAT status/type snapshotted from the seller profile at assignment
    // (undefined = unknown = treated as VAT-registered). Profile edits then only
    // affect future assignments; admins can correct a lot via adminSetLotSellerVat.
    sellerVatRegistered: v.optional(v.boolean()),
    sellerType: v.optional(sellerTypeValidator),
    winnerId: v.optional(v.union(v.string(), v.null())),
    images: v.union(
      v.object({
        front: v.optional(v.string()), // storageId
        engine: v.optional(v.string()), // storageId
        cabin: v.optional(v.string()), // storageId
        rear: v.optional(v.string()), // storageId
        additional: v.optional(v.array(v.string())), // array of storageIds
      }),
      v.array(v.string()) // legacy format
    ),
    // Machine specs (all optional; existing lots are grandfathered).
    powerKw: v.optional(v.number()),
    drive: v.optional(driveValidator),
    transmission: v.optional(v.string()),
    frontTyrePct: v.optional(v.number()), // tread remaining, 0-100
    rearTyrePct: v.optional(v.number()), // tread remaining, 0-100
    serialNumber: v.optional(v.string()),
    coldStartVideo: v.optional(v.id("_storage")),
    // Fixed-shot-list angle per photo, keyed by the photo's storage id / URL.
    imageAngles: v.optional(imageAnglesValidator),
    description: v.optional(v.string()),
    conditionReportUrl: v.optional(v.id("_storage")), // PDF storage ID
    isExtended: v.optional(v.boolean()),
    hiddenByFlags: v.optional(v.boolean()),
    seedId: v.optional(v.string()),
    conditionChecklist: v.optional(
      v.object({
        engine: v.boolean(),
        hydraulics: v.boolean(),
        tires: v.boolean(),
        serviceHistory: v.boolean(),
        notes: v.optional(v.string()),
      })
    ),
    createdAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_seller", ["sellerId"])
    .index("by_seller_status", ["sellerId", "status"])
    .index("by_category", ["categoryId"])
    .index("by_seedId", ["seedId"])
    .index("by_status_make", ["status", "make"])
    .index("by_status_year", ["status", "year"])
    .index("by_status_settledAt", ["status", "settledAt"])
    .index("by_auctionId", ["auctionId"])
    .index("by_auctionId_lotNumber", ["auctionId", "lotNumber"])
    .index("by_status_auctionId", ["status", "auctionId"])
    .index("by_status_considerationDeadline", [
      "status",
      "considerationDeadline",
    ])
    .index("by_seller_createdAt", ["sellerId", "createdAt"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["status"],
    })
    .searchIndex("search_title_simple", {
      searchField: "title",
    })
    .searchIndex("search_make_model", {
      searchField: "make",
      filterFields: ["status", "model"],
    }),

  // Lot flagging system for community moderation
  lotFlags: defineTable({
    lotId: v.id("lots"),
    reporterId: v.string(),
    reason: v.union(
      v.literal("misleading"),
      v.literal("inappropriate"),
      v.literal("suspicious"),
      v.literal("other")
    ),
    details: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("reviewed"),
      v.literal("dismissed")
    ),
    createdAt: v.number(),
  })
    .index("by_lot", ["lotId"])
    .index("by_reporter", ["reporterId"])
    .index("by_status", ["status"])
    .index("by_lot_status", ["lotId", "status"]),

  // Profile reporting system for community moderation
  profileFlags: defineTable({
    reportedUserId: v.string(),
    reporterId: v.string(),
    reason: v.union(
      v.literal("fake_account"),
      v.literal("fraudulent_listings"),
      v.literal("abusive_behaviour"),
      v.literal("identity_misrepresentation"),
      v.literal("other")
    ),
    details: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("reviewed"),
      v.literal("dismissed")
    ),
    adminNotes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_reported_user", ["reportedUserId"])
    .index("by_reporter", ["reporterId"])
    .index("by_status", ["status"])
    .index("by_reported_status", ["reportedUserId", "status"])
    .index("by_reporter_createdAt", ["reporterId", "createdAt"]),

  // Seller reviews left by lot winners
  reviews: defineTable({
    lotId: v.id("lots"),
    reviewerId: v.string(), // buyer userId (the auction winner)
    revieweeId: v.string(), // seller userId
    rating: v.number(), // integer 1-5, validated in the mutation handler
    comment: v.optional(v.string()),
    response: v.optional(v.object({ text: v.string(), createdAt: v.number() })), // Seller's single response to the review
    createdAt: v.number(),
  })
    .index("by_reviewee", ["revieweeId"])
    .index("by_reviewee_createdAt", ["revieweeId", "createdAt"])
    .index("by_lot_reviewer", ["lotId", "reviewerId"])
    .index("by_reviewer_createdAt", ["reviewerId", "createdAt"]),

  bids: defineTable({
    lotId: v.id("lots"),
    bidderId: v.string(),
    amount: v.number(),
    timestamp: v.number(),
    status: v.optional(v.union(v.literal("valid"), v.literal("voided"))), // Bid integrity
  })
    .index("by_lot", ["lotId", "timestamp"])
    .index("by_lot_amount", ["lotId", "amount"])
    .index("by_bidder", ["bidderId"])
    .index("by_bidder_lot", ["bidderId", "lotId"])
    .index("by_bidder_timestamp", ["bidderId", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  // Per-user bid cooldown state (issue #283). One row per user, keyed by the
  // same string userId used across the app (profile.userId / auth user id —
  // there is no "users" table; ids are strings, see convex/lib/auth.ts).
  bidCooldowns: defineTable({
    userId: v.string(),
    lastBidAt: v.number(),
  }).index("by_userId", ["userId"]),

  proxy_bids: defineTable({
    lotId: v.id("lots"),
    bidderId: v.string(),
    maxBid: v.number(),
    updatedAt: v.number(),
  })
    .index("by_lot", ["lotId"])
    .index("by_bidder_lot", ["bidderId", "lotId"])
    .index("by_lot_maxBid", ["lotId", "maxBid", "updatedAt"]),

  // Application Profiles (Links Auth User to App Metadata)
  profiles: defineTable({
    userId: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.union(v.literal("buyer"), v.literal("seller"), v.literal("admin")),
    isVerified: v.boolean(),
    kycStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("verified"),
        v.literal("rejected")
      )
    ),
    kycDocuments: v.optional(v.array(v.id("_storage"))), // storageIds
    kycRejectionReason: v.optional(v.string()),
    firstName: v.optional(v.string()), // Encrypted PII
    lastName: v.optional(v.string()), // Encrypted PII
    idNumber: v.optional(v.string()), // Encrypted PII
    kycEmail: v.optional(v.string()), // Encrypted PII
    bio: v.optional(v.string()),
    phoneNumber: v.optional(v.string()), // Encrypted PII
    companyName: v.optional(v.string()),
    location: v.optional(v.string()),
    // Seller VAT status and type (seller- or admin-set). Unset = unknown, which
    // buyers' estimates treat as VAT-registered (worst case).
    vatRegistered: v.optional(v.boolean()),
    sellerType: v.optional(sellerTypeValidator),
    // Admin-set: how quickly this seller usually replies (public copy).
    sellerResponseTime: v.optional(sellerResponseTimeValidator),
    emailVerified: v.optional(v.boolean()),
    phoneVerified: v.optional(v.boolean()),
    bankingVerified: v.optional(v.boolean()),
    taxNumberVerified: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_kycStatus", ["kycStatus"])
    .index("by_role", ["role"])
    .index("by_isVerified", ["isVerified"]),

  // New Admin Features
  auditLogs: defineTable({
    adminId: v.string(),
    action: v.string(),
    targetId: v.optional(v.string()),
    targetType: v.optional(v.string()),
    details: v.optional(v.string()),
    targetCount: v.optional(v.number()),
    timestamp: v.number(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_adminId", ["adminId"]),

  supportTickets: defineTable({
    userId: v.string(),
    lotId: v.optional(v.id("lots")),
    subject: v.string(),
    message: v.string(),
    status: v.union(
      v.literal("open"),
      v.literal("resolved"),
      v.literal("closed")
    ),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    createdAt: v.number(),
    updatedAt: v.number(),
    resolvedBy: v.optional(v.string()), // adminId
  })
    .index("by_status", ["status"])
    .index("by_user", ["userId"])
    .index("by_updatedAt", ["updatedAt"])
    .index("by_user_updatedAt", ["userId", "updatedAt"])
    .index("by_user_createdAt", ["userId", "createdAt"]),

  // Public "Request a transport quote" form (guests allowed). Admin-only reads.
  transportQuoteRequests: defineTable({
    userId: v.optional(v.string()),
    lotId: v.optional(v.id("lots")),
    lotLabel: v.optional(v.string()),
    pickup: v.string(),
    deliveryTown: v.string(),
    deliveryProvince: provinceValidator,
    name: v.string(),
    phone: v.string(), // normalised +27�, plain text (admin-only, rate-limit index)
    notes: v.optional(v.string()),
    status: v.union(v.literal("new"), v.literal("handled")),
    createdAt: v.number(),
    handledBy: v.optional(v.string()),
    handledAt: v.optional(v.number()),
  })
    .index("by_phone_and_createdAt", ["phone", "createdAt"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_createdAt", ["createdAt"])
    .index("by_status_and_createdAt", ["status", "createdAt"]),

  notifications: defineTable({
    recipientId: v.string(), // "all" for announcements
    type: v.union(
      v.literal("info"),
      v.literal("success"),
      v.literal("warning"),
      v.literal("error")
    ),
    title: v.string(),
    message: v.string(),
    link: v.optional(v.string()),
    isRead: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_recipient", ["recipientId", "isRead"])
    .index("by_recipient_createdAt", ["recipientId", "createdAt"])
    .index("by_recipient_isRead_createdAt", [
      "recipientId",
      "isRead",
      "createdAt",
    ]),

  readReceipts: defineTable({
    userId: v.string(),
    notificationId: v.id("notifications"),
    readAt: v.number(),
  })
    .index("by_user_notification", ["userId", "notificationId"])
    .index("by_notification", ["notificationId"]),

  // Per-user activity feed entries rendered in the profile "Recent Activity"
  // section (issue #220). KYC and role-change entries are private: they are
  // only returned to the profile owner (see convex/userActivity.ts).
  userActivity: defineTable({
    userId: v.string(),
    type: v.union(
      v.literal("account_created"),
      v.literal("verification_requested"),
      v.literal("verification_approved"),
      v.literal("verification_rejected"),
      v.literal("role_changed"),
      v.literal("listing_created"),
      v.literal("listing_sold"),
      v.literal("bid_placed"),
      v.literal("bid_won")
    ),
    description: v.optional(v.string()),
    relatedId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_createdAt", ["userId", "createdAt"]),

  // Two-party buyer/seller messaging (issue #231). Every conversation is
  // strictly two-party, so participants are modelled as scalar buyerId/sellerId
  // fields (each indexed) rather than an array of participant ids — Convex
  // array-field indexes cannot do a "contains this user" lookup.
  conversations: defineTable({
    buyerId: v.string(),
    sellerId: v.string(),
    lotId: v.optional(v.id("lots")),
    lastMessageAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_buyer", ["buyerId", "lastMessageAt"])
    .index("by_seller", ["sellerId", "lastMessageAt"])
    .index("by_buyer_seller", ["buyerId", "sellerId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.string(),
    content: v.string(),
    isRead: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId", "createdAt"])
    .index("by_conversation_read", ["conversationId", "isRead"])
    .index("by_sender", ["senderId", "createdAt"]),

  watchlist: defineTable({
    userId: v.string(),
    lotId: v.id("lots"),
  })
    .index("by_user", ["userId"])
    .index("by_user_lot", ["userId", "lotId"])
    .index("by_lot", ["lotId"]),

  // Dedupe + rate-limit rows for the public lot view counter. One row per
  // (lot, viewer) pair; `viewerKey` is the signed-in user id or a client
  // session id. Purged daily (see cronJobs.purgeLotViewers).
  lotViewers: defineTable({
    lotId: v.id("lots"),
    viewerKey: v.string(),
    lastViewedAt: v.number(),
  })
    .index("by_lotId_and_viewerKey", ["lotId", "viewerKey"])
    .index("by_viewerKey_and_lastViewedAt", ["viewerKey", "lastViewedAt"])
    .index("by_lastViewedAt", ["lastViewedAt"]),

  // Precomputed engagement score per assigned lot of a live auction, rebuilt
  // every 5 minutes by `engagement.refreshEngagementScores` from the lot's
  // counters. Read by `getMostEngagedLots` so views never re-trigger it.
  // score = bids * 3 + watchers * 2 + log2(1 + views). `lotNumber` is
  // denormalised for the tie-break.
  engagementScores: defineTable({
    lotId: v.id("lots"),
    auctionId: v.id("auctions"),
    lotNumber: v.optional(v.number()),
    bids: v.number(),
    watchers: v.number(),
    views: v.number(),
    score: v.number(),
    updatedAt: v.number(),
  })
    .index("by_auctionId_and_score", ["auctionId", "score"])
    .index("by_lotId", ["lotId"]),

  presence: defineTable({
    userId: v.string(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_updatedAt", ["updatedAt"]),

  userPreferences: defineTable({
    userId: v.string(),
    viewMode: v.optional(v.union(v.literal("compact"), v.literal("detailed"))),
    sidebarOpen: v.optional(v.boolean()),
    defaultStatusFilter: v.optional(
      v.union(v.literal("active"), v.literal("closed"), v.literal("all"))
    ),
    defaultMake: v.optional(v.string()),
    defaultMinYear: v.optional(v.number()),
    defaultMaxYear: v.optional(v.number()),
    defaultMaxHours: v.optional(v.number()),
    defaultMinPrice: v.optional(v.number()),
    defaultMaxPrice: v.optional(v.number()),
    biddingRequireConfirmation: v.optional(v.boolean()),
    biddingProxyBidDefault: v.optional(v.boolean()),
    notificationsBidOutbid: v.optional(v.boolean()),
    notificationsWatchlistEnding: v.optional(
      v.union(
        v.literal("disabled"),
        v.literal("1h"),
        v.literal("3h"),
        v.literal("24h")
      )
    ),
    notificationsAuctionWon: v.optional(v.boolean()),
    notificationsSellerAuctionApproved: v.optional(v.boolean()),
    notificationsEmailEnabled: v.optional(v.boolean()),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  counters: defineTable({
    // e.g., "auctions", "profiles", "support", "announcements",
    // "lotNumber:<auctionId>" (last lot number issued), "lots:<auctionId>" (`total` = buyer-visible lots in the sale),"watchers:<lotId>" (`total`),
    // "views:<lotId>" (`total`), "bids:<lotId>" (`total` = valid bids) or
    // "anonviews:<lotId>" (`active` = hour bucket, `total` = anonymous views
    // counted in it).
    name: v.string(),
    total: v.number(),
    active: v.optional(v.number()),
    pending: v.optional(v.number()),
    verified: v.optional(v.number()),
    open: v.optional(v.number()),
    resolved: v.optional(v.number()),
    draft: v.optional(v.number()), // Support for draft counter
    soldCount: v.optional(v.number()),
    salesVolume: v.optional(v.number()),
    buyerTotal: v.optional(v.number()), // Aggregate of buyer fee amounts
    sellerTotal: v.optional(v.number()), // Aggregate of seller fee amounts
    updatedAt: v.number(),
  }).index("by_name", ["name"]),

  // Application Settings (Global configuration for limits, pagination, etc.)
  settings: defineTable({
    key: v.string(), // e.g., "pagination_limit", "max_results_cap"
    value: v.union(v.string(), v.number(), v.boolean()),
    description: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  // Public FAQ items — managed by admins, visible to all visitors
  faqItems: defineTable({
    question: v.string(),
    answer: v.string(),
    order: v.number(),
    isPublished: v.boolean(),
  })
    .index("by_order", ["order"])
    .index("by_published_order", ["isPublished", "order"]),

  // Legal pages (Terms, Privacy, PAIA manual) — admin-authored markdown, one
  // row per slug. Drafts are never served publicly (see convex/legal.ts).
  legalPages: defineTable({
    slug: v.union(v.literal("terms"), v.literal("privacy"), v.literal("paia")),
    title: v.string(),
    body: v.string(), // markdown, max LEGAL_BODY_MAX_LENGTH chars
    isPublished: v.boolean(),
    publishedAt: v.optional(v.number()), // first/most recent publish time
    updatedAt: v.number(),
    updatedBy: v.string(), // admin userId, or "SYSTEM" for seeded drafts
  }).index("by_slug", ["slug"]),

  // Platform Fee Configuration
  platformFees: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    feeType: v.union(v.literal("percentage"), v.literal("fixed")),
    value: v.number(),
    appliesTo: v.union(
      v.literal("buyer"),
      v.literal("seller"),
      v.literal("both")
    ),
    isActive: v.boolean(),
    visibleToBuyer: v.boolean(),
    visibleToSeller: v.boolean(),
    sortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_name", ["name"])
    .index("by_active", ["isActive"])
    .index("by_appliesTo", ["appliesTo"])
    .index("by_sortOrder", ["sortOrder"]),

  // Lot Fee Ledger - records fees calculated per lot at settlement
  // Settlement ledger: exactly what was charged on a settled lot. Fee reads of
  // a settled lot use ONLY these rows (never live fee settings).
  // `source` says where a row came from: "fee_row" (an active `platformFees`
  // row; `feeId` set), "auction" (the lot's auction snapshot premium or
  // commission) or "platform" (the platform default premium read at
  // settlement). Auction/platform rows have no `feeId`. Rows written before
  // `source` existed have it undefined and are always fee rows.
  lotFees: defineTable({
    lotId: v.id("lots"),
    feeId: v.optional(v.id("platformFees")),
    source: v.optional(
      v.union(v.literal("auction"), v.literal("fee_row"), v.literal("platform"))
    ),
    feeName: v.string(),
    appliedTo: v.union(v.literal("buyer"), v.literal("seller")),
    feeType: v.union(v.literal("percentage"), v.literal("fixed")),
    rate: v.number(),
    salePrice: v.number(),
    calculatedAmount: v.number(),
    createdAt: v.number(),
  })
    .index("by_lot", ["lotId"])
    .index("by_appliedTo", ["appliedTo"])
    .index("by_feeId", ["feeId"])
    .index("by_lot_fee_applied", ["lotId", "feeId", "appliedTo"]),

  // Error Reports Queue (captured errors sent to GitHub)
  errorReports: defineTable({
    fingerprint: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    errorType: v.string(),
    errorMessage: v.string(),
    stackTrace: v.optional(v.string()),
    userId: v.optional(v.string()),
    userRole: v.optional(v.string()),
    additionalInfo: v.optional(
      v.record(v.string(), v.union(v.string(), v.number()))
    ),
    breadcrumbs: v.array(
      v.object({
        timestamp: v.number(),
        type: v.string(),
        description: v.string(),
        metadata: v.optional(
          v.record(v.string(), v.union(v.string(), v.number()))
        ),
      })
    ),
    metadata: v.object({
      url: v.string(),
      userAgent: v.string(),
      timestamp: v.number(),
    }),
    githubIssueUrl: v.optional(v.string()),
    githubIssueNumber: v.optional(v.number()),
    instanceCount: v.number(),
    lastOccurredAt: v.number(),
    createdAt: v.number(),
    errorMessageNormalized: v.optional(v.string()),
  })
    .index("by_fingerprint", ["fingerprint"])
    .index("by_status", ["status"])
    .index("by_github_issue", ["githubIssueNumber"])
    .index("by_createdAt", ["createdAt"]),

  // Web push endpoints of a user's browsers/devices (one row per endpoint).
  pushSubscriptions: defineTable({
    userId: v.string(),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_endpoint", ["endpoint"]),

  // "Remind me" requests for upcoming sales; sent once when the sale opens.
  saleReminders: defineTable({
    userId: v.string(),
    auctionId: v.id("auctions"),
    status: v.union(v.literal("pending"), v.literal("sent")),
    // Copy of the sale's startTime so the cron can find due reminders by index.
    startTime: v.number(),
    createdAt: v.number(),
    sentAt: v.optional(v.number()),
  })
    .index("by_userId_and_auctionId", ["userId", "auctionId"])
    .index("by_status_and_startTime", ["status", "startTime"])
    .index("by_auctionId_and_status", ["auctionId", "status"]),
});
