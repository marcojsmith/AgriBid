// app/convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // AgriBid Tables
  equipmentMetadata: defineTable({
    make: v.string(),
    models: v.array(v.string()),
    category: v.string(),
  }).index("by_make", ["make"]),

  auctions: defineTable({
    title: v.string(),
    make: v.string(),
    model: v.string(),
    year: v.number(),
    operatingHours: v.number(),
    location: v.string(),
    reservePrice: v.number(),
    startingPrice: v.number(),
    currentPrice: v.number(),
    minIncrement: v.number(),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    durationDays: v.optional(v.number()),
    sellerId: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("pending_review"),
      v.literal("active"),
      v.literal("sold"),
      v.literal("unsold"),
      v.literal("rejected")
    ),
    winnerId: v.optional(v.string()),
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
  })
    .index("by_status", ["status"])
    .index("by_status_creationTime", ["status"])
    .index("by_seller", ["sellerId"])
    .index("by_seller_status", ["sellerId", "status"])
    .index("by_end_time", ["endTime"])
    .index("by_seedId", ["seedId"])
    .index("by_status_make", ["status", "make"])
    .index("by_status_year", ["status", "year"])
    .index("by_status_endTime", ["status", "endTime"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["status"],
    })
    .searchIndex("search_make_model", {
      searchField: "make",
      filterFields: ["status", "model"],
    }),

  // Auction flagging system for community moderation
  auctionFlags: defineTable({
    auctionId: v.id("auctions"),
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
    .index("by_auction", ["auctionId"])
    .index("by_reporter", ["reporterId"])
    .index("by_status", ["status"])
    .index("by_auction_status", ["auctionId", "status"]),

  bids: defineTable({
    auctionId: v.id("auctions"),
    bidderId: v.string(),
    amount: v.number(),
    timestamp: v.number(),
    status: v.optional(v.union(v.literal("valid"), v.literal("voided"))), // Bid integrity
  })
    .index("by_auction", ["auctionId", "timestamp"])
    .index("by_bidder", ["bidderId"])
    .index("by_timestamp", ["timestamp"]),

  proxy_bids: defineTable({
    auctionId: v.id("auctions"),
    bidderId: v.string(),
    maxBid: v.number(),
    updatedAt: v.number(),
  })
    .index("by_auction", ["auctionId"])
    .index("by_bidder_auction", ["bidderId", "auctionId"])
    .index("by_auction_maxBid", ["auctionId", "maxBid", "updatedAt"]),

  // Application Profiles (Links Auth User to App Metadata)
  profiles: defineTable({
    userId: v.string(),
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
    auctionId: v.optional(v.id("auctions")),
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
    .index("by_user_updatedAt", ["userId", "updatedAt"]),

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

  watchlist: defineTable({
    userId: v.string(),
    auctionId: v.id("auctions"),
  })
    .index("by_user", ["userId"])
    .index("by_user_auction", ["userId", "auctionId"]),

  counters: defineTable({
    name: v.string(), // e.g., "auctions", "profiles", "support", "announcements"
    total: v.number(),
    active: v.optional(v.number()),
    pending: v.optional(v.number()),
    verified: v.optional(v.number()),
    open: v.optional(v.number()),
    resolved: v.optional(v.number()),
    draft: v.optional(v.number()), // Support for draft counter
    updatedAt: v.number(),
  }).index("by_name", ["name"]),
});
