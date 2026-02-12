// app/convex/seed.ts
import { mutation } from "./_generated/server";

export const seedEquipmentMetadata = mutation({
  args: {},
  handler: async (ctx) => {
    const items = [
      {
        make: "John Deere",
        models: ["6155R", "7R 330", "8R 410"],
        category: "Tractor",
      },
      {
        make: "John Deere",
        models: ["S780"],
        category: "Combine",
      },
      {
        make: "Case IH",
        models: ["Magnum 340", "Steiger 620"],
        category: "Tractor",
      },
      {
        make: "Case IH",
        models: ["Axial-Flow 8250"],
        category: "Combine",
      },
      {
        make: "Massey Ferguson",
        models: ["MF 7718 S", "MF 8S.265"],
        category: "Tractor",
      },
      {
        make: "New Holland",
        models: ["T7.270", "T8.435"],
        category: "Tractor",
      },
      {
        make: "New Holland",
        models: ["CR10.90"],
        category: "Combine",
      },
      {
        make: "Claas",
        models: ["Arion 660"],
        category: "Tractor",
      },
      {
        make: "Claas",
        models: ["Lexion 8900", "Jaguar 990"],
        category: "Combine",
      },
    ];

    for (const item of items) {
      const existing = await ctx.db
        .query("equipmentMetadata")
        .withIndex("by_make", (q) => q.eq("make", item.make))
        .filter((q) => q.eq(q.field("category"), item.category))
        .first();
      
      if (!existing) {
        await ctx.db.insert("equipmentMetadata", item);
      }
    }
  },
});

export const seedMockAuctions = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    // Create mock seller user for seeding (Idempotent)
    const email = "mock-seller@farm.com";
    let mockUserId;
    const existingUser = await ctx.db
      .query("user")
      .filter((q) => q.eq(q.field("email"), email))
      .first();

    if (existingUser) {
      mockUserId = existingUser._id;
    } else {
      mockUserId = await ctx.db.insert("user", {
        email,
        name: "Mock Seller",
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    const mockAuctions = [
      {
        title: "2022 John Deere 6155R",
        make: "John Deere",
        model: "6155R",
        year: 2022,
        operatingHours: 1200,
        location: "NG1 1AA",
        reservePrice: 85000,
        startingPrice: 50000,
        currentPrice: 50000,
        minIncrement: 500,
        startTime: now - oneDay,
        endTime: now + 2 * oneDay,
        sellerId: mockUserId,
        status: "active" as const,
        images: [],
      },
      {
        title: "2019 Case IH Magnum 340",
        make: "Case IH",
        model: "Magnum 340",
        year: 2019,
        operatingHours: 3500,
        location: "YO1 7HH",
        reservePrice: 120000,
        startingPrice: 80000,
        currentPrice: 85000,
        minIncrement: 1000,
        startTime: now - 2 * oneDay,
        endTime: now + 5 * oneDay,
        sellerId: mockUserId,
        status: "active" as const,
        images: [],
      },
    ];

    for (const auction of mockAuctions) {
      const existingAuction = await ctx.db
        .query("auctions")
        .filter((q) => q.eq(q.field("title"), auction.title))
        .first();
      
      if (!existingAuction) {
        await ctx.db.insert("auctions", auction);
      }
    }
  },
});
