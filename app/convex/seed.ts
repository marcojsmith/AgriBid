// app/convex/seed.ts
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { components } from "./_generated/api";
import { getCallerRole } from "./users";

type TableNames = "auctions" | "bids" | "profiles" | "watchlist" | "equipmentMetadata";

async function checkDestructiveAccess(ctx: MutationCtx) {
  const nodeEnv = process.env.NODE_ENV;
  const vercelEnv = process.env.VERCEL_ENV;
  const role = await getCallerRole(ctx);
  const isAdmin = role === "admin";

  // Admin bypass: Admins are always allowed to perform destructive operations
  if (isAdmin) return;

  // SECURITY: Explicitly validate environment variables to prevent silent degradation.
  // These variables must be set in the Convex dashboard or via CLI (e.g., npx convex env set NODE_ENV development).
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
      `Current environment: ${nodeEnv || vercelEnv}.`
    );
  }
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
  handler: async (ctx, args) => {
    // --- SECURITY GUARD ---
    const seedSecret = process.env.SEED_SECRET;
    const isSecretMatch = seedSecret && args.providedSeed === seedSecret;
    
    if (!isSecretMatch) {
      await checkDestructiveAccess(ctx);
    }
    // -----------------------

    if (args.clear) {
      const BATCH_SIZE = 500;
      
      const tablesToClear: TableNames[] = ["auctions", "bids", "profiles", "watchlist"];
      for (const tableName of tablesToClear) {
        let deletedCount = 0;
        while (true) {
          const batch = await ctx.db.query(tableName).take(BATCH_SIZE);
          if (batch.length === 0) break;
          await Promise.all(batch.map(item => ctx.db.delete(item._id)));
          deletedCount += batch.length;
        }
        console.log(`Cleared ${deletedCount} records from ${tableName}.`);
      }

      // Clear Auth Component tables
      const authModels = ["user", "account", "session", "verification"] as const;
      for (const model of authModels) {
        await ctx.runMutation(components.auth.adapter.deleteMany, {
          input: {
            model,
            where: [] // Clear all
          },
          paginationOpts: { cursor: null, numItems: 100 }
        });
        console.log(`Requested wipe of auth model: ${model}`);
      }
    }

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

    // 2. Create Mock Seller User (Idempotent)
    const mockSellerEmail = "mock-seller@farm.com";
    const mockSellerId = "mock-seller";
    
    const seller = await ctx.runQuery(components.auth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", operator: "eq", value: mockSellerEmail }]
    });

    if (!seller) {
      await ctx.runMutation(components.auth.adapter.create, {
        input: {
          model: "user",
          data: {
            userId: mockSellerId,
            email: mockSellerEmail,
            name: "Mock Seller",
            emailVerified: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
        }
      });
      await ctx.db.insert("profiles", {
        userId: mockSellerId,
        role: "seller",
        isVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    // 2.5. Create Mock Admin User (Idempotent)
    const mockAdminEmail = "admin@agribid.com";
    const mockAdminId = "mock-admin";
    
    const admin = await ctx.runQuery(components.auth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", operator: "eq", value: mockAdminEmail }]
    });

    if (!admin) {
      await ctx.runMutation(components.auth.adapter.create, {
        input: {
          model: "user",
          data: {
            userId: mockAdminId,
            email: mockAdminEmail,
            name: "System Admin",
            emailVerified: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
        }
      });
      await ctx.db.insert("profiles", {
        userId: mockAdminId,
        role: "admin",
        isVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    // 3. Seed Mock Auctions
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const mockAuctions = [
      {
        seedId: "jd-8r-410",
        title: "John Deere 8R 410 — Row Crop Titan",
        make: "John Deere",
        model: "8R 410",
        year: 2023,
        operatingHours: 450,
        location: "Moline, IL",
        description: "This 2023 John Deere 8R 410 is in excellent condition with low hours. Features the Row Crop Titan package, premium cab, and advanced telemetry. Full service history available. Perfect for large-scale production.",
        reservePrice: 385000,
        startingPrice: 250000,
        currentPrice: 275000,
        minIncrement: 5000,
        startTime: now - oneDay,
        endTime: now + 3 * oneDay,
        sellerId: mockSellerId,
        status: "active" as const,
        images: {
          front: "https://www.deere.com/assets/images/region-4/products/tractors/row-crop-tractors/8r-8rt-row-crop-tractors/8r-410/8r_410_r4f063847_large_660c917945cea0af3aeb242ddf4c52b9540ef7cc.jpg",
          engine: "https://photos.machinefinder.com/06/10805006/70729678_large.jpg",
          cabin: "https://www.deere.asia/assets/images/region-2/products/tractors/large/8r-series/2_8r410_joskin_slurrytank_dsc2539_large_large_7a4506d66221ef20112cf11f13bf7ffc898ffec6.jpg",
          additional: []
        },
      },
      {
        seedId: "case-magnum-380",
        title: "Case IH Magnum 380 — Prairie Powerhouse",
        make: "Case IH",
        model: "Magnum 380",
        year: 2022,
        operatingHours: 820,
        location: "Racine, WI",
        description: "A 2022 Case IH Magnum 380, the ultimate Prairie Powerhouse. Features the CVXDrive transmission, luxury AFS Connect cab, and dual wheels for maximum traction. Exceptionally well-maintained unit.",
        reservePrice: 320000,
        startingPrice: 200000,
        currentPrice: 215000,
        minIncrement: 2500,
        startTime: now - 2 * oneDay,
        endTime: now + 4 * oneDay,
        sellerId: mockSellerId,
        status: "active" as const,
        images: {
          front: "https://titanmachinery.bg/media/stenik_article/article/cache/2/image/9df78eab33525d08d6e5fb8d27136e95/1/4/14228766973.jpg",
          engine: "https://cnhi-p-001-delivery.sitecorecontenthub.cloud/api/public/content/a74b2445b23f440bacd99ab8eaf177cc?v=abc51e43",
          cabin: "https://www.lectura-specs.com/models/renamed/orig/4wd-tractors-magnum-380-cvxdrive-case-ih.jpg",
          additional: []
        },
      },
      {
        seedId: "nh-t7-315",
        title: "New Holland T7.315 — Blue Diamond",
        make: "New Holland",
        model: "T7.315",
        year: 2023,
        operatingHours: 210,
        location: "Basildon, UK",
        description: "The 2023 New Holland T7.315 Blue Diamond edition. Low operating hours, heavy-duty rear hitch, and PLM Intelligence. Versatile machine for both tillage and transport work.",
        reservePrice: 245000,
        startingPrice: 150000,
        currentPrice: 165000,
        minIncrement: 2000,
        startTime: now - oneDay,
        endTime: now + 5 * oneDay,
        sellerId: mockSellerId,
        status: "active" as const,
        images: {
          front: "https://cnhi-p-001-delivery.sitecorecontenthub.cloud/api/public/content/8938fcb66b3a4f48abced368ef3e49ae?v=8416d11a&t=size1100",
          engine: "https://rollinsmachinery.com/wp-content/uploads/2024/02/Right-Side-T7.315.jpg",
          cabin: "https://www.worldtractors.co.uk/wp-content/uploads/2025/03/IMG_0131-scaled.jpeg",
          additional: []
        },
      },
      {
        seedId: "mf-8s-305",
        title: "Massey Ferguson 8S.305 — Crimson Legend",
        make: "Massey Ferguson",
        model: "8S.305",
        year: 2024,
        operatingHours: 15,
        location: "Beauvais, FR",
        description: "Virtually new 2024 Massey Ferguson 8S.305. The Crimson Legend features the innovative Protect-U design, Dyna-VT transmission, and exceptional visibility. Demonstration unit with only 15 delivery hours.",
        reservePrice: 210000,
        startingPrice: 140000,
        currentPrice: 142000,
        minIncrement: 1500,
        startTime: now - 3 * oneDay,
        endTime: now + 2 * oneDay,
        sellerId: mockSellerId,
        status: "active" as const,
        images: {
          front: "https://www.scotagri.com/media/bz5dn5hz/image001-33.jpg",
          engine: "https://ik.imagekit.io/efarm/images/f1e19830-278d-4d3c-894b-18101ec963ec.jpg?tr=w-600%2Cl-image%2Ci-%40%40website-machine-images-watermarks%40%40watermark_DZDDMXPYs_M9F2mQxfH.png%2Clx-6%2Cly-6%2Cw-90%2Cl-end",
          cabin: "https://heavyequipmentspecs.s3.amazonaws.com/tractors/massey-ferguson-8s.305/massey-ferguson-8s.305_1.jpg",
          additional: []
        },
      },
      {
        seedId: "fendt-1050",
        title: "Fendt 1050 Vario — German Precision",
        make: "Fendt",
        model: "1050 Vario",
        year: 2023,
        operatingHours: 580,
        location: "Marktoberdorf, DE",
        description: "2023 Fendt 1050 Vario, the peak of German Precision engineering. Fendt iD low engine speed concept, VarioDrive, and LifeCab. A powerhouse for the most demanding agricultural tasks.",
        reservePrice: 450000,
        startingPrice: 300000,
        currentPrice: 325000,
        minIncrement: 10000,
        startTime: now - oneDay,
        endTime: now + 6 * oneDay,
        sellerId: mockSellerId,
        status: "active" as const,
        images: {
          front: "https://www.fendt.com/int/images/60cc414b69b3411a3a4b5114_1623998796_web_en.png",
          engine: "https://cdn.gebrauchtmaschinen.de/data/listing/img/vga/ms/97/53/16247668-01.jpg?v=1717573999",
          cabin: "https://media.sandhills.com/img.axd?id=9026328987&wid=4326185391&rwl=False&p=&ext=&w=350&h=220&t=&lp=&c=True&wt=False&sz=Cover&rt=0&checksum=42ysNVTRQ48SZVTD4%2BotMVL9yMULXnb1mnh8ao7tBzk%3D",
          additional: []
        },
      }
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

    console.log("Seeding completed successfully.");
  },
});

export const clearAuctions = mutation({
  args: {},
  handler: async (ctx) => {
    await checkDestructiveAccess(ctx);

    const auctions = await ctx.db.query("auctions").collect();
    const auctionsCount = auctions.length;
    
    // Delete auctions and their bids in parallel
    await Promise.all(auctions.flatMap(a => [
      ctx.db.delete(a._id),
      // Also find and delete all bids for this auction
      ctx.db.query("bids")
        .withIndex("by_auction", (q) => q.eq("auctionId", a._id))
        .collect()
        .then(bids => Promise.all(bids.map(b => ctx.db.delete(b._id))))
    ]));

    return auctionsCount;
  },
});

/**
 * Wipe all user and application data.
 * USE WITH CAUTION.
 */
export const clearAllData = mutation({
  args: {},
  handler: async (ctx) => {
    await checkDestructiveAccess(ctx);

    const appTables: TableNames[] = [
      "auctions", 
      "bids", 
      "profiles", 
      "watchlist", 
    ];

    const authModels = ["user", "session", "account", "verification"] as const;

    let totalDeleted = 0;
    
    // Clear App Tables
    for (const tableName of appTables) {
      const records = await ctx.db.query(tableName).collect();
      await Promise.all(records.map(r => ctx.db.delete(r._id)));
      totalDeleted += records.length;
    }

    // Clear Auth Tables via component adapter
    for (const model of authModels) {
      const result = await ctx.runMutation(components.auth.adapter.deleteMany, {
        input: {
          model,
          where: []
        },
        paginationOpts: { cursor: null, numItems: 1000 }
      });
      totalDeleted += (result?.count ?? 0);
      console.log(`Requested wipe of auth model: ${model} (${result?.count ?? 0} deleted)`);
    }

    return totalDeleted;
  },
});
