/// <reference types="vite/client" />

/**
 * Integration coverage (real in-memory Convex backend) for WP3c: the VAT rate
 * setting, the company details on Business Info and clearing a lot's province.
 */

import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api } from "./_generated/api";
import { DEFAULT_VAT_RATE_PCT } from "./constants";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

const ADMIN = "user_admin";
const BUYER = "user_buyer";

const createTestContext = () => convexTest(schema, modules);
type TestContext = ReturnType<typeof createTestContext>;

/**
 * Inserts an admin and a buyer profile.
 *
 * @param t - The convex-test context.
 */
async function seedUsers(t: TestContext): Promise<void> {
  await t.run(async (ctx) => {
    const now = Date.now();
    for (const [userId, role] of [
      [ADMIN, "admin"],
      [BUYER, "buyer"],
    ] as const) {
      await ctx.db.insert("profiles", {
        userId,
        name: userId,
        role,
        isVerified: true,
        kycStatus: "verified",
        createdAt: now,
        updatedAt: now,
      });
    }
  });
}

const asAdmin = (t: TestContext) => t.withIdentity({ subject: ADMIN });
const asBuyer = (t: TestContext) => t.withIdentity({ subject: BUYER });

/**
 * Counts audit log rows for a target.
 *
 * @param t - The convex-test context.
 * @param targetId - The audit `targetId` to match.
 * @returns The number of matching rows.
 */
async function auditCount(t: TestContext, targetId: string): Promise<number> {
  return await t.run(async (ctx) => {
    const rows = await ctx.db.query("auditLogs").collect();
    return rows.filter((row) => row.targetId === targetId).length;
  });
}

describe("VAT rate setting", () => {
  it("defaults to 15 when unset and is readable by anonymous visitors", async () => {
    const t = createTestContext();
    expect(DEFAULT_VAT_RATE_PCT).toBe(15);
    expect(await t.query(api.admin.getVatRate, {})).toEqual({
      vatRatePct: 15,
    });
  });

  it("lets an admin update the rate, writes an audit entry and exposes it publicly", async () => {
    const t = createTestContext();
    await seedUsers(t);

    await asAdmin(t).mutation(api.admin.updateVatRate, { vatRatePct: 7.5 });

    expect(await t.query(api.admin.getVatRate, {})).toEqual({
      vatRatePct: 7.5,
    });
    expect(await auditCount(t, "vat-rate")).toBe(1);

    // A second save updates the same row instead of inserting another.
    await asAdmin(t).mutation(api.admin.updateVatRate, { vatRatePct: 0 });
    expect(await t.query(api.admin.getVatRate, {})).toEqual({ vatRatePct: 0 });
    const rows = await t.run(async (ctx) =>
      (await ctx.db.query("settings").collect()).filter(
        (row) => row.key === "vat_rate_pct"
      )
    );
    expect(rows).toHaveLength(1);
  });

  it("rejects non-admins and anonymous callers without writing", async () => {
    const t = createTestContext();
    await seedUsers(t);

    await expect(
      asBuyer(t).mutation(api.admin.updateVatRate, { vatRatePct: 10 })
    ).rejects.toThrow();
    await expect(
      t.mutation(api.admin.updateVatRate, { vatRatePct: 10 })
    ).rejects.toThrow();

    expect(await t.query(api.admin.getVatRate, {})).toEqual({
      vatRatePct: 15,
    });
    expect(await auditCount(t, "vat-rate")).toBe(0);
  });

  it.each([-1, 100.01, 101, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects out-of-range or non-finite rate %s",
    async (vatRatePct) => {
      const t = createTestContext();
      await seedUsers(t);
      await expect(
        asAdmin(t).mutation(api.admin.updateVatRate, { vatRatePct })
      ).rejects.toThrow();
      expect(await t.query(api.admin.getVatRate, {})).toEqual({
        vatRatePct: 15,
      });
    }
  );

  it("accepts the boundaries 0 and 100", async () => {
    const t = createTestContext();
    await seedUsers(t);
    await asAdmin(t).mutation(api.admin.updateVatRate, { vatRatePct: 100 });
    expect(await t.query(api.admin.getVatRate, {})).toEqual({
      vatRatePct: 100,
    });
    await asAdmin(t).mutation(api.admin.updateVatRate, { vatRatePct: 0 });
    expect(await t.query(api.admin.getVatRate, {})).toEqual({ vatRatePct: 0 });
  });

  it("falls back to the default when the stored value is not a number", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      await ctx.db.insert("settings", {
        key: "vat_rate_pct",
        value: "fifteen",
        updatedAt: Date.now(),
      });
    });
    expect(await t.query(api.admin.getVatRate, {})).toEqual({
      vatRatePct: 15,
    });
  });

  it("falls back to the default when the stored value is out of range", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      await ctx.db.insert("settings", {
        key: "vat_rate_pct",
        value: 250,
        updatedAt: Date.now(),
      });
    });
    expect(await t.query(api.admin.getVatRate, {})).toEqual({
      vatRatePct: 15,
    });
  });

  it("cannot be set through the generic updateSystemConfig mutation", async () => {
    const t = createTestContext();
    await seedUsers(t);
    await expect(
      asAdmin(t).mutation(api.admin.updateSystemConfig, {
        key: "vat_rate_pct",
        value: 20,
      })
    ).rejects.toThrow();
  });
});

describe("company details on Business Info", () => {
  it("returns null for every company field when unset", async () => {
    const t = createTestContext();
    const info = await t.query(api.admin.getBusinessInfo, {});
    expect(info.registrationNo).toBeNull();
    expect(info.vatNo).toBeNull();
    expect(info.whatsapp).toBeNull();
  });

  it("stores registration no., VAT no. and WhatsApp and reads them back", async () => {
    const t = createTestContext();
    await seedUsers(t);

    await asAdmin(t).mutation(api.admin.updateBusinessInfo, {
      registrationNo: "2019/123456/07",
      vatNo: "4123456789",
      whatsapp: "+27 82 555 0100",
    });

    const info = await t.query(api.admin.getBusinessInfo, {});
    expect(info.registrationNo).toBe("2019/123456/07");
    expect(info.vatNo).toBe("4123456789");
    expect(info.whatsapp).toBe("+27 82 555 0100");
    expect(await auditCount(t, "business-info")).toBe(1);
  });

  it("rejects non-admins", async () => {
    const t = createTestContext();
    await seedUsers(t);
    await expect(
      asBuyer(t).mutation(api.admin.updateBusinessInfo, { vatNo: "1" })
    ).rejects.toThrow();
  });

  it("exposes only public fields: no admin-only settings leak through the public read", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      const now = Date.now();
      for (const [key, value] of [
        ["github_api_token", "secret-token"],
        ["vat_rate_pct", 15],
        ["demo_mode_enabled", true],
        ["business.vatNo", "4123456789"],
      ] as const) {
        await ctx.db.insert("settings", { key, value, updatedAt: now });
      }
    });

    const info = await t.query(api.admin.getBusinessInfo, {});
    expect(Object.keys(info).sort()).toEqual(
      [
        "addressCountry",
        "addressLocality",
        "businessDescription",
        "businessName",
        "email",
        "logoUrl",
        "postalCode",
        "registrationNo",
        "sameAs",
        "streetAddress",
        "telephone",
        "vatNo",
        "website",
        "whatsapp",
      ].sort()
    );
    expect(JSON.stringify(info)).not.toContain("secret-token");

    const vat = await t.query(api.admin.getVatRate, {});
    expect(Object.keys(vat)).toEqual(["vatRatePct"]);
  });
});

describe("clearing a lot's province", () => {
  /**
   * Inserts an approved lot with a province.
   *
   * @param t - The convex-test context.
   * @returns The lot id.
   */
  async function insertLotWithProvince(t: TestContext): Promise<Id<"lots">> {
    return await t.run(async (ctx) => {
      const categoryId = await ctx.db.insert("equipmentCategories", {
        name: "Tractors",
        isActive: true,
      });
      return await ctx.db.insert("lots", {
        title: "Tractor",
        make: "John Deere",
        model: "8R",
        year: 2020,
        operatingHours: 10,
        location: "Pretoria",
        province: "gauteng",
        categoryId,
        reservePrice: 100,
        startingPrice: 100,
        currentPrice: 100,
        minIncrement: 10,
        sellerId: "user_seller",
        status: "approved",
        images: { front: "https://example.com/a.jpg", additional: [] },
        createdAt: Date.now(),
      });
    });
  }

  // `t.run` serialises results, turning `undefined` into `null`.
  const provinceOf = async (t: TestContext, lotId: Id<"lots">) =>
    (await t.run(async (ctx) => (await ctx.db.get("lots", lotId))?.province)) ??
    undefined;

  it("removes the province when an admin sets clearProvince", async () => {
    const t = createTestContext();
    await seedUsers(t);
    const lotId = await insertLotWithProvince(t);

    await asAdmin(t).mutation(api.auctions.adminUpdateLot, {
      lotId,
      updates: { clearProvince: true },
    });

    expect(await provinceOf(t, lotId)).toBeUndefined();
    // The flag itself is never persisted on the lot.
    const lot = await t.run(async (ctx) => await ctx.db.get("lots", lotId));
    expect(lot).not.toHaveProperty("clearProvince");
    expect(lot).not.toHaveProperty("province");
  });

  it("still sets a province and leaves it alone when untouched", async () => {
    const t = createTestContext();
    await seedUsers(t);
    const lotId = await insertLotWithProvince(t);

    await asAdmin(t).mutation(api.auctions.adminUpdateLot, {
      lotId,
      updates: { title: "Renamed" },
    });
    expect(await provinceOf(t, lotId)).toBe("gauteng");

    await asAdmin(t).mutation(api.auctions.adminUpdateLot, {
      lotId,
      updates: { province: "limpopo" },
    });
    expect(await provinceOf(t, lotId)).toBe("limpopo");
  });

  it("rejects setting and clearing the province in the same call", async () => {
    const t = createTestContext();
    await seedUsers(t);
    const lotId = await insertLotWithProvince(t);

    await expect(
      asAdmin(t).mutation(api.auctions.adminUpdateLot, {
        lotId,
        updates: { province: "limpopo", clearProvince: true },
      })
    ).rejects.toThrow();
    expect(await provinceOf(t, lotId)).toBe("gauteng");
  });

  it("rejects non-admins clearing a province", async () => {
    const t = createTestContext();
    await seedUsers(t);
    const lotId = await insertLotWithProvince(t);

    await expect(
      asBuyer(t).mutation(api.auctions.adminUpdateLot, {
        lotId,
        updates: { clearProvince: true },
      })
    ).rejects.toThrow();
    expect(await provinceOf(t, lotId)).toBe("gauteng");
  });
});
