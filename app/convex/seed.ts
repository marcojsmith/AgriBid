// app/convex/seed.ts
import { mutation } from "./_generated/server";

export const seedEquipmentMetadata = mutation({
  args: {},
  handler: async (ctx) => {
    const items = [
      {
        make: "John Deere",
        models: ["6155R", "7R 330", "8R 410", "S780"],
        category: "Tractor",
      },
      {
        make: "Case IH",
        models: ["Magnum 340", "Steiger 620", "Axial-Flow 8250"],
        category: "Tractor",
      },
      {
        make: "Massey Ferguson",
        models: ["MF 7718 S", "MF 8S.265"],
        category: "Tractor",
      },
      {
        make: "New Holland",
        models: ["T7.270", "T8.435", "CR10.90"],
        category: "Tractor",
      },
      {
        make: "Claas",
        models: ["Lexion 8900", "Jaguar 990", "Arion 660"],
        category: "Combine",
      },
    ];

    for (const item of items) {
      const existing = await ctx.db
        .query("equipmentMetadata")
        .withIndex("by_make", (q) => q.eq("make", item.make))
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

    // Create mock seller user for seeding
    const mockSeller = await ctx.db.insert("user", {
      email: "mock-seller@farm.com",
      name: "Mock Seller",
      emailVerified: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const mockUserId = mockSeller;

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
      await ctx.db.insert("auctions", auction);
    }
  },
});
