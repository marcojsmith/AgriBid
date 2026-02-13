// app/convex/seed.ts
import { mutation } from "./_generated/server";

export const seedEquipmentMetadata = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.role !== "admin") {
      throw new Error("Unauthorized: Admin privileges required to seed metadata.");
    }

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
      {
        make: "Ford",
        models: ["4100"],
        category: "Tractor",
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.role !== "admin") {
      throw new Error("Unauthorized: Admin privileges required to seed mock auctions.");
    }

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    // Create mock seller user for seeding (Idempotent)
    const email = "mock-seller@farm.com";
    const mockExternalUserId = "mock-seller";
    let mockUserId = mockExternalUserId;
    
    const existingUser = await ctx.db
      .query("user")
      .filter((q) => q.eq(q.field("email"), email))
      .first();

    if (existingUser) {
      mockUserId = existingUser.userId || mockExternalUserId;
      if (!existingUser.userId) {
        await ctx.db.patch(existingUser._id, { userId: mockExternalUserId });
      }
    } else {
      await ctx.db.insert("user", {
        userId: mockExternalUserId,
        email,
        name: "Mock Seller",
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    const mockAuctions = [
      {
        title: "2022 John Deere 6155R Premium",
        make: "John Deere",
        model: "6155R",
        year: 2022,
        operatingHours: 1200,
        location: "NG1 1AA",
        reservePrice: 85000,
        startingPrice: 50000,
        currentPrice: 51000,
        minIncrement: 500,
        startTime: now - oneDay,
        endTime: now + 2 * oneDay,
        sellerId: mockUserId,
        status: "active" as const,
        images: [
          "https://images.unsplash.com/photo-1689047721832-60be780e0600?auto=format&fit=crop&w=1200&q=80",
          "https://images.unsplash.com/photo-1698656627092-d7b1a629b0a1?auto=format&fit=crop&w=1200&q=80",
        ],
      },
      {
        title: "2019 Case IH Magnum 340 High Flow",
        make: "Case IH",
        model: "Magnum 340",
        year: 2019,
        operatingHours: 3500,
        location: "YO1 7HH",
        reservePrice: 120000,
        startingPrice: 80000,
        currentPrice: 88000,
        minIncrement: 1000,
        startTime: now - 2 * oneDay,
        endTime: now + 5 * oneDay,
        sellerId: mockUserId,
        status: "active" as const,
        images: [
          "https://images.unsplash.com/photo-1711200373070-df98246ca82c?auto=format&fit=crop&w=1200&q=80",
          "https://images.unsplash.com/photo-1650361288331-5079a81f3ca5?auto=format&fit=crop&w=1200&q=80",
        ],
      },
      {
        title: "Red Combine Harvester - Ready for Season",
        make: "Claas",
        model: "Lexion 8900",
        year: 2023,
        operatingHours: 450,
        location: "PE11 2AA",
        reservePrice: 250000,
        startingPrice: 150000,
        currentPrice: 165000,
        minIncrement: 2500,
        startTime: now - oneDay,
        endTime: now + 3 * oneDay,
        sellerId: mockUserId,
        status: "active" as const,
        images: [
          "https://images.unsplash.com/photo-1692523295982-f56743c68383?auto=format&fit=crop&w=1200&q=80",
          "https://images.unsplash.com/photo-1647416345091-c24c7da87640?auto=format&fit=crop&w=1200&q=80",
        ],
      },
      {
        title: "Vintage Ford 4100 Collector Edition",
        make: "Ford",
        model: "4100",
        year: 1978,
        operatingHours: 8500,
        location: "LD1 5AA",
        reservePrice: 15000,
        startingPrice: 5000,
        currentPrice: 7200,
        minIncrement: 200,
        startTime: now - 3 * oneDay,
        endTime: now + 1 * oneDay,
        sellerId: mockUserId,
        status: "active" as const,
        images: [
          "https://images.unsplash.com/photo-1691231882200-a6a3b2b9340e?auto=format&fit=crop&w=1200&q=80",
        ],
      },
      {
        title: "Round Hay Baler & Utility Package",
        make: "Massey Ferguson",
        model: "MF 7718 S",
        year: 2021,
        operatingHours: 1800,
        location: "IV1 1AA",
        reservePrice: 45000,
        startingPrice: 30000,
        currentPrice: 32500,
        minIncrement: 500,
        startTime: now - oneDay,
        endTime: now + 4 * oneDay,
        sellerId: mockUserId,
        status: "active" as const,
        images: [
          "https://images.unsplash.com/photo-1716388433390-e5df46960411?auto=format&fit=crop&w=1200&q=80",
          "https://images.unsplash.com/photo-1626435091215-649065609337?auto=format&fit=crop&w=1200&q=80",
        ],
      },
      {
        title: "Compact Utility Tractor with Front-End Loader",
        make: "John Deere",
        model: "7R 330",
        year: 2024,
        operatingHours: 50,
        location: "CV34 4AB",
        reservePrice: 65000,
        startingPrice: 40000,
        currentPrice: 42000,
        minIncrement: 1000,
        startTime: now - oneDay,
        endTime: now + 6 * oneDay,
        sellerId: mockUserId,
        status: "active" as const,
        images: [
          "https://images.unsplash.com/photo-1684992497645-12c858548a27?auto=format&fit=crop&w=1200&q=80",
          "https://images.unsplash.com/photo-1549495676-928e08d6265e?auto=format&fit=crop&w=1200&q=80",
        ],
      }
    ];

    for (const auction of mockAuctions) {
      const existingAuction = await ctx.db
        .query("auctions")
        .filter((q) => q.eq(q.field("title"), auction.title))
        .first();
      
      if (!existingAuction) {
        await ctx.db.insert("auctions", auction);
      } else {
        // Update static metadata only; preserve currentPrice/endTime set by real bids
        await ctx.db.patch(existingAuction._id, { 
          images: auction.images,
          title: auction.title
        });
      }
    }
  },
});
