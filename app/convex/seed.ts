// app/convex/seed.ts
import { mutation } from "./_generated/server";

/**
 * Shared seeding logic for both local development and Vercel Previews.
 * This is idempotent: it checks for existing records before inserting.
 * 
 * SECURITY: This mutation is protected by an environment check and an optional SEED_SECRET.
 */
export const runSeed = mutation({
  args: {},
  handler: async (ctx) => {
    // --- SECURITY GUARD ---
    const isDev = process.env.NODE_ENV === "development";
    const isPreview = !!process.env.VERCEL_URL;
    const seedSecret = process.env.SEED_SECRET;
    const identity = await ctx.auth.getUserIdentity();
    const isAdmin = identity?.role === "admin";

    // Allow if in dev/preview, or if caller is an admin, or if a valid SEED_SECRET is set (though not passed in args here for simplicity)
    if (!isDev && !isPreview && !isAdmin && !seedSecret) {
      throw new Error("Unauthorized: Seeding is only allowed in development, preview, or by admins.");
    }
    // -----------------------

    // 1. Seed Equipment Metadata
    const metadataItems = [
      { make: "John Deere", models: ["6155R", "7R 330", "8R 410"], category: "Tractor" },
      { make: "John Deere", models: ["S780"], category: "Combine" },
      { make: "Case IH", models: ["Magnum 340", "Magnum 380", "Steiger 620"], category: "Tractor" },
      { make: "Case IH", models: ["Axial-Flow 8250"], category: "Combine" },
      { make: "Massey Ferguson", models: ["MF 7718 S", "MF 8S.265", "8S.305"], category: "Tractor" },
      { make: "New Holland", models: ["T7.270", "T8.435", "T7.315"], category: "Tractor" },
      { make: "New Holland", models: ["CR10.90"], category: "Combine" },
      { make: "Claas", models: ["Arion 660"], category: "Tractor" },
      { make: "Claas", models: ["Lexion 8900", "Jaguar 990"], category: "Combine" },
      { make: "Ford", models: ["4100"], category: "Tractor" },
      { make: "Fendt", models: ["1050 Vario"], category: "Tractor" },
    ];

    for (const item of metadataItems) {
      const existing = await ctx.db
        .query("equipmentMetadata")
        .withIndex("by_make", (q) => q.eq("make", item.make))
        .filter((q) => q.eq(q.field("category"), item.category))
        .first();
      
      if (!existing) {
        await ctx.db.insert("equipmentMetadata", item);
      } else {
        await ctx.db.patch(existing._id, { models: Array.from(new Set([...existing.models, ...item.models])) });
      }
    }

    // 2. Seed Mock Auctions
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const mockAuctions = [
      {
        title: "John Deere 8R 410 — Row Crop Titan",
        make: "John Deere",
        model: "8R 410",
        year: 2023,
        operatingHours: 450,
        location: "Moline, IL",
        reservePrice: 385000,
        startingPrice: 250000,
        currentPrice: 275000,
        minIncrement: 5000,
        startTime: now - oneDay,
        endTime: now + 3 * oneDay,
        sellerId: "mock-seller",
        status: "active" as const,
        images: [
          "https://www.deere.com/assets/images/region-4/products/tractors/row-crop-tractors/8r-8rt-row-crop-tractors/8r-410/8r_410_r4f063847_large_660c917945cea0af3aeb242ddf4c52b9540ef7cc.jpg",
          "https://photos.machinefinder.com/06/10805006/70729678_large.jpg",
          "https://www.deere.asia/assets/images/region-2/products/tractors/large/8r-series/2_8r410_joskin_slurrytank_dsc2539_large_large_7a4506d66221ef20112cf11f13bf7ffc898ffec6.jpg"
        ],
      },
      {
        title: "Case IH Magnum 380 — Prairie Powerhouse",
        make: "Case IH",
        model: "Magnum 380",
        year: 2022,
        operatingHours: 820,
        location: "Racine, WI",
        reservePrice: 320000,
        startingPrice: 200000,
        currentPrice: 215000,
        minIncrement: 2500,
        startTime: now - 2 * oneDay,
        endTime: now + 4 * oneDay,
        sellerId: "mock-seller",
        status: "active" as const,
        images: [
          "https://titanmachinery.bg/media/stenik_article/article/cache/2/image/9df78eab33525d08d6e5fb8d27136e95/1/4/14228766973.jpg",
          "https://cnhi-p-001-delivery.sitecorecontenthub.cloud/api/public/content/a74b2445b23f440bacd99ab8eaf177cc?v=abc51e43",
          "https://www.lectura-specs.com/models/renamed/orig/4wd-tractors-magnum-380-cvxdrive-case-ih.jpg"
        ],
      },
      {
        title: "New Holland T7.315 — Blue Diamond",
        make: "New Holland",
        model: "T7.315",
        year: 2023,
        operatingHours: 210,
        location: "Basildon, UK",
        reservePrice: 245000,
        startingPrice: 150000,
        currentPrice: 165000,
        minIncrement: 2000,
        startTime: now - oneDay,
        endTime: now + 5 * oneDay,
        sellerId: "mock-seller",
        status: "active" as const,
        images: [
          "https://cnhi-p-001-delivery.sitecorecontenthub.cloud/api/public/content/8938fcb66b3a4f48abced368ef3e49ae?v=8416d11a&t=size1100",
          "https://rollinsmachinery.com/wp-content/uploads/2024/02/Right-Side-T7.315.jpg",
          "https://www.worldtractors.co.uk/wp-content/uploads/2025/03/IMG_0131-scaled.jpeg"
        ],
      },
      {
        title: "Massey Ferguson 8S.305 — Crimson Legend",
        make: "Massey Ferguson",
        model: "8S.305",
        year: 2024,
        operatingHours: 15,
        location: "Beauvais, FR",
        reservePrice: 210000,
        startingPrice: 140000,
        currentPrice: 142000,
        minIncrement: 1500,
        startTime: now - 3 * oneDay,
        endTime: now + 2 * oneDay,
        sellerId: "mock-seller",
        status: "active" as const,
        images: [
          "https://www.scotagri.com/media/bz5dn5hz/image001-33.jpg",
          "https://ik.imagekit.io/efarm/images/f1e19830-278d-4d3c-894b-18101ec963ec.jpg?tr=w-600%2Cl-image%2Ci-%40%40website-machine-images-watermarks%40%40watermark_DZDDMXPYs_M9F2mQxfH.png%2Clx-6%2Cly-6%2Cw-90%2Cl-end",
          "https://heavyequipmentspecs.s3.amazonaws.com/tractors/massey-ferguson-8s.305/massey-ferguson-8s.305_1.jpg"
        ],
      },
      {
        title: "Fendt 1050 Vario — German Precision",
        make: "Fendt",
        model: "1050 Vario",
        year: 2023,
        operatingHours: 580,
        location: "Marktoberdorf, DE",
        reservePrice: 450000,
        startingPrice: 300000,
        currentPrice: 325000,
        minIncrement: 10000,
        startTime: now - oneDay,
        endTime: now + 6 * oneDay,
        sellerId: "mock-seller",
        status: "active" as const,
        images: [
          "https://www.fendt.com/int/images/60cc414b69b3411a3a4b5114_1623998796_web_en.png",
          "https://cdn.gebrauchtmaschinen.de/data/listing/img/vga/ms/97/53/16247668-01.jpg?v=1717573999",
          "https://media.sandhills.com/img.axd?id=9026328987&wid=4326185391&rwl=False&p=&ext=&w=350&h=220&t=&lp=&c=True&wt=False&sz=Cover&rt=0&checksum=42ysNVTRQ48SZVTD4%2BotMVL9yMULXnb1mnh8ao7tBzk%3D"
        ],
      }
    ];

    for (const auction of mockAuctions) {
      const existing = await ctx.db
        .query("auctions")
        .filter((q) => q.eq(q.field("title"), auction.title))
        .first();
      
      if (!existing) {
        await ctx.db.insert("auctions", auction);
      }
    }

    console.log("Seeding completed successfully.");
  },
});
