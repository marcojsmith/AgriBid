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
    startTime: v.number(),
    endTime: v.number(),
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
    conditionReportUrl: v.optional(v.string()),
    isExtended: v.optional(v.boolean()),
    seedId: v.optional(v.string()),
    conditionChecklist: v.optional(v.object({
      engine: v.boolean(),
      hydraulics: v.boolean(),
      tires: v.boolean(),
      serviceHistory: v.boolean(),
      notes: v.optional(v.string()),
    })),
  })
    .index("by_status", ["status"])
    .index("by_seller", ["sellerId"])
    .index("by_seller_status", ["sellerId", "status"])
    .index("by_end_time", ["endTime"])
    .index("by_seedId", ["seedId"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["status"],
    })
    .searchIndex("search_make_model", {
      searchField: "make",
      filterFields: ["status", "model"],
    }),

  bids: defineTable({
    auctionId: v.id("auctions"),
    bidderId: v.string(),
    amount: v.number(),
    timestamp: v.number(),
  })
    .index("by_auction", ["auctionId", "timestamp"])
    .index("by_bidder", ["bidderId"]),

  watchlist: defineTable({
    userId: v.string(),
    auctionId: v.id("auctions"),
  })
    .index("by_user_auction", ["userId", "auctionId"])
    .index("by_user", ["userId"]),

  // Application Profiles (Links Auth User to App Metadata)
  profiles: defineTable({
    userId: v.string(),
    role: v.union(v.literal("buyer"), v.literal("seller"), v.literal("admin")),
    isVerified: v.boolean(),
    bio: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    companyName: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),
});
