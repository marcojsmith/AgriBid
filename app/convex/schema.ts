// app/convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Better Auth Tables (Manually defined as export is missing)
  user: defineTable({
    name: v.string(),
    email: v.string(),
    emailVerified: v.boolean(),
    image: v.optional(v.union(v.null(), v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
    twoFactorEnabled: v.optional(v.union(v.null(), v.boolean())),
    isAnonymous: v.optional(v.union(v.null(), v.boolean())),
    username: v.optional(v.union(v.null(), v.string())),
    displayUsername: v.optional(v.union(v.null(), v.string())),
    phoneNumber: v.optional(v.union(v.null(), v.string())),
    phoneNumberVerified: v.optional(v.union(v.null(), v.boolean())),
    userId: v.optional(v.union(v.null(), v.string())),
    role: v.optional(v.string()), // Custom field
    isVerified: v.optional(v.boolean()), // Custom field
  })
    .index("email_name", ["email", "name"])
    .index("by_email", ["email"])
    .index("name", ["name"])
    .index("by_userId", ["userId"])
    .index("username", ["username"])
    .index("phoneNumber", ["phoneNumber"]),

  session: defineTable({
    expiresAt: v.number(),
    token: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    ipAddress: v.optional(v.union(v.null(), v.string())),
    userAgent: v.optional(v.union(v.null(), v.string())),
    userId: v.string(),
  })
    .index("expiresAt", ["expiresAt"])
    .index("expiresAt_userId", ["expiresAt", "userId"])
    .index("token", ["token"])
    .index("userId", ["userId"]),

  account: defineTable({
    accountId: v.string(),
    providerId: v.string(),
    userId: v.string(),
    accessToken: v.optional(v.union(v.null(), v.string())),
    refreshToken: v.optional(v.union(v.null(), v.string())),
    idToken: v.optional(v.union(v.null(), v.string())),
    accessTokenExpiresAt: v.optional(v.union(v.null(), v.number())),
    refreshTokenExpiresAt: v.optional(v.union(v.null(), v.number())),
    scope: v.optional(v.union(v.null(), v.string())),
    password: v.optional(v.union(v.null(), v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("accountId", ["accountId"])
    .index("accountId_providerId", ["accountId", "providerId"])
    .index("providerId_userId", ["providerId", "userId"])
    .index("userId", ["userId"]),

  verification: defineTable({
    identifier: v.string(),
    value: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("expiresAt", ["expiresAt"])
    .index("identifier", ["identifier"]),

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
    images: v.object({
      front: v.optional(v.string()), // storageId
      engine: v.optional(v.string()), // storageId
      cabin: v.optional(v.string()), // storageId
      rear: v.optional(v.string()), // storageId
      additional: v.optional(v.array(v.string())), // array of storageIds
    }),
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

  // Standard Better Auth extra tables
  jwks: defineTable({
    publicKey: v.string(),
    privateKey: v.string(),
    createdAt: v.number(),
  }),
  rateLimit: defineTable({
    id: v.string(),
    key: v.string(),
    count: v.int64(),
    lastRequest: v.int64(),
  }).index("key", ["key"]),
});
