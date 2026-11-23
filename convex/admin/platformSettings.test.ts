/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api } from "../_generated/api";
import { MAX_ADDITIONAL_IMAGES, MAX_MIN_PHOTOS_PER_LOT } from "../constants";
import schema from "../schema";
import { getMinPhotosPerLot } from "./platformSettings";

const globbedModules = import.meta.glob("../**/*.*s");

/**
 * `import.meta.glob` rewrites matches inside this directory to `./`-prefixed
 * keys; rebase them onto the `../` root convex-test derives from `_generated`.
 */
const modules: Record<string, () => Promise<unknown>> = Object.fromEntries(
  Object.entries(globbedModules).map(([path, load]) => [
    path.startsWith("./") ? `../admin/${path.slice(2)}` : path,
    load,
  ])
);

const ADMIN = "user_admin";
const BUYER = "user_buyer";

type TestContext = ReturnType<typeof makeContext>;

/**
 * Builds a convex-test backend with an admin and a buyer profile.
 *
 * @returns The test context
 */
function makeContext() {
  return convexTest(schema, modules);
}

/**
 * Seeds the admin and buyer profiles.
 *
 * @param t - Test context
 */
async function seed(t: TestContext): Promise<void> {
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

/**
 * Counts audit rows for a target.
 *
 * @param t - Test context
 * @param targetId - Audit target id
 * @returns Number of matching rows
 */
async function audits(t: TestContext, targetId: string): Promise<number> {
  return await t.run(async (ctx) => {
    const rows = await ctx.db.query("auditLogs").collect();
    return rows.filter(
      (r) => r.targetId === targetId && r.action === "UPDATE_SETTING"
    ).length;
  });
}

describe("getPlatformSettings", () => {
  it("returns defaults for anonymous visitors when nothing is stored", async () => {
    const t = makeContext();
    expect(
      await t.query(api.admin.platformSettings.getPlatformSettings, {})
    ).toEqual({
      buyerPremiumPct: 12,
      deposit: { enabled: true, amount: 5000, refundDays: 3 },
      sellerCosts: { commissionPct: 8, listingFee: 0, payoutDays: 7 },
      financeContact: { name: null, company: null, phone: null },
      pushRemindersEnabled: false,
      minPhotosPerLot: 8,
    });
  });

  it("falls back to defaults for invalid stored values", async () => {
    const t = makeContext();
    await t.run(async (ctx) => {
      const bad: [string, string | number | boolean][] = [
        ["buyer_premium_pct", 250],
        ["deposit_enabled", "yes"],
        ["deposit_amount", 12.5],
        ["deposit_refund_days", 99],
        ["seller_commission_pct", -1],
        ["seller_listing_fee", "free"],
        ["seller_payout_days", 0],
        ["push_reminders_enabled", 1],
        ["min_photos_per_lot", 100],
        ["finance_contact_name", 5],
      ];
      for (const [key, value] of bad) {
        await ctx.db.insert("settings", { key, value, updatedAt: 1 });
      }
    });
    const result = await t.query(
      api.admin.platformSettings.getPlatformSettings,
      {}
    );
    expect(result.buyerPremiumPct).toBe(12);
    expect(result.deposit).toEqual({
      enabled: true,
      amount: 5000,
      refundDays: 3,
    });
    expect(result.sellerCosts).toEqual({
      commissionPct: 8,
      listingFee: 0,
      payoutDays: 7,
    });
    expect(result.pushRemindersEnabled).toBe(false);
    expect(result.minPhotosPerLot).toBe(8);
    expect(result.financeContact.name).toBeNull();
  });
});

describe("updateBuyerPremium", () => {
  it("lets an admin set the premium and audits it", async () => {
    const t = makeContext();
    await seed(t);
    await asAdmin(t).mutation(api.admin.platformSettings.updateBuyerPremium, {
      pct: 7.5,
    });
    await asAdmin(t).mutation(api.admin.platformSettings.updateBuyerPremium, {
      pct: 10,
    });
    expect(
      (await t.query(api.admin.platformSettings.getPlatformSettings, {}))
        .buyerPremiumPct
    ).toBe(10);
    expect(await audits(t, "buyer-premium")).toBe(2);
    const rows = await t.run((ctx) => ctx.db.query("settings").collect());
    expect(rows.filter((r) => r.key === "buyer_premium_pct")).toHaveLength(1);
  });

  it("rejects non-admins and anonymous callers", async () => {
    const t = makeContext();
    await seed(t);
    await expect(
      t
        .withIdentity({ subject: BUYER })
        .mutation(api.admin.platformSettings.updateBuyerPremium, { pct: 5 })
    ).rejects.toThrow();
    await expect(
      t.mutation(api.admin.platformSettings.updateBuyerPremium, { pct: 5 })
    ).rejects.toThrow();
    expect(await audits(t, "buyer-premium")).toBe(0);
  });

  it.each([-1, 101, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects %s",
    async (pct) => {
      const t = makeContext();
      await seed(t);
      await expect(
        asAdmin(t).mutation(api.admin.platformSettings.updateBuyerPremium, {
          pct,
        })
      ).rejects.toThrow("Buyer premium must be");
      expect(await audits(t, "buyer-premium")).toBe(0);
    }
  );
});

describe("updateRegistrationDeposit", () => {
  it("stores the deposit rules and audits", async () => {
    const t = makeContext();
    await seed(t);
    await asAdmin(t).mutation(
      api.admin.platformSettings.updateRegistrationDeposit,
      {
        enabled: false,
        amount: 2500,
        refundDays: 10,
      }
    );
    expect(
      (await t.query(api.admin.platformSettings.getPlatformSettings, {}))
        .deposit
    ).toEqual({
      enabled: false,
      amount: 2500,
      refundDays: 10,
    });
    expect(await audits(t, "registration-deposit")).toBe(1);
  });

  it("rejects non-admins", async () => {
    const t = makeContext();
    await seed(t);
    await expect(
      t
        .withIdentity({ subject: BUYER })
        .mutation(api.admin.platformSettings.updateRegistrationDeposit, {
          enabled: true,
          amount: 1,
          refundDays: 1,
        })
    ).rejects.toThrow();
  });

  it.each([
    [-1, 3],
    [1.5, 3],
    [1_000_001, 3],
    [Number.NaN, 3],
    [100, 0],
    [100, 31],
    [100, 2.5],
    [100, Number.POSITIVE_INFINITY],
  ])("rejects amount %s / refundDays %s", async (amount, refundDays) => {
    const t = makeContext();
    await seed(t);
    await expect(
      asAdmin(t).mutation(
        api.admin.platformSettings.updateRegistrationDeposit,
        {
          enabled: true,
          amount,
          refundDays,
        }
      )
    ).rejects.toThrow();
    expect(await audits(t, "registration-deposit")).toBe(0);
  });
});

describe("updateSellerCosts", () => {
  it("stores the seller costs and audits", async () => {
    const t = makeContext();
    await seed(t);
    await asAdmin(t).mutation(api.admin.platformSettings.updateSellerCosts, {
      commissionPct: 6.5,
      listingFee: 250.5,
      payoutDays: 14,
    });
    expect(
      (await t.query(api.admin.platformSettings.getPlatformSettings, {}))
        .sellerCosts
    ).toEqual({ commissionPct: 6.5, listingFee: 250.5, payoutDays: 14 });
    expect(await audits(t, "seller-costs")).toBe(1);
  });

  it("rejects non-admins", async () => {
    const t = makeContext();
    await seed(t);
    await expect(
      t
        .withIdentity({ subject: BUYER })
        .mutation(api.admin.platformSettings.updateSellerCosts, {
          commissionPct: 1,
          listingFee: 1,
          payoutDays: 1,
        })
    ).rejects.toThrow();
  });

  it.each([
    [101, 0, 7],
    [8, -1, 7],
    [8, Number.NaN, 7],
    [8, Number.POSITIVE_INFINITY, 7],
    [8, 0, 0],
    [8, 0, 61],
    [8, 0, 1.5],
  ])("rejects %s / %s / %s", async (commissionPct, listingFee, payoutDays) => {
    const t = makeContext();
    await seed(t);
    await expect(
      asAdmin(t).mutation(api.admin.platformSettings.updateSellerCosts, {
        commissionPct,
        listingFee,
        payoutDays,
      })
    ).rejects.toThrow();
    expect(await audits(t, "seller-costs")).toBe(0);
  });
});

describe("updateFinanceContact", () => {
  it("trims, stores, audits and clears on empty", async () => {
    const t = makeContext();
    await seed(t);
    await asAdmin(t).mutation(api.admin.platformSettings.updateFinanceContact, {
      name: "  Jane  ",
      company: " AgriBid Finance ",
      phone: "+27 82 123 4567",
    });
    expect(
      (await t.query(api.admin.platformSettings.getPlatformSettings, {}))
        .financeContact
    ).toEqual({
      name: "Jane",
      company: "AgriBid Finance",
      phone: "+27 82 123 4567",
    });

    await asAdmin(t).mutation(api.admin.platformSettings.updateFinanceContact, {
      name: "",
      company: "",
      phone: "",
    });
    expect(
      (await t.query(api.admin.platformSettings.getPlatformSettings, {}))
        .financeContact
    ).toEqual({ name: null, company: null, phone: null });
    expect(await audits(t, "finance-contact")).toBe(2);
  });

  it("rejects non-admins", async () => {
    const t = makeContext();
    await seed(t);
    await expect(
      t
        .withIdentity({ subject: BUYER })
        .mutation(api.admin.platformSettings.updateFinanceContact, {
          name: "a",
          company: "b",
          phone: "",
        })
    ).rejects.toThrow();
  });

  it("rejects invalid phones and over-long fields", async () => {
    const t = makeContext();
    await seed(t);
    await expect(
      asAdmin(t).mutation(api.admin.platformSettings.updateFinanceContact, {
        name: "a",
        company: "b",
        phone: "call me",
      })
    ).rejects.toThrow("valid phone");
    await expect(
      asAdmin(t).mutation(api.admin.platformSettings.updateFinanceContact, {
        name: "x".repeat(101),
        company: "b",
        phone: "",
      })
    ).rejects.toThrow("at most 100");
    await expect(
      asAdmin(t).mutation(api.admin.platformSettings.updateFinanceContact, {
        name: "a",
        company: "y".repeat(101),
        phone: "",
      })
    ).rejects.toThrow("at most 100");
    expect(await audits(t, "finance-contact")).toBe(0);
  });
});

describe("updatePushReminders", () => {
  it("toggles the flag and audits", async () => {
    const t = makeContext();
    await seed(t);
    await asAdmin(t).mutation(api.admin.platformSettings.updatePushReminders, {
      enabled: true,
    });
    expect(
      (await t.query(api.admin.platformSettings.getPlatformSettings, {}))
        .pushRemindersEnabled
    ).toBe(true);
    expect(await audits(t, "push-reminders")).toBe(1);
  });

  it("rejects non-admins", async () => {
    const t = makeContext();
    await seed(t);
    await expect(
      t
        .withIdentity({ subject: BUYER })
        .mutation(api.admin.platformSettings.updatePushReminders, {
          enabled: true,
        })
    ).rejects.toThrow();
  });
});

describe("updateMinPhotos / getMinPhotosPerLot", () => {
  it("defaults to 8, then follows the stored value", async () => {
    const t = makeContext();
    await seed(t);
    expect(await t.run((ctx) => getMinPhotosPerLot(ctx))).toBe(8);
    await asAdmin(t).mutation(api.admin.platformSettings.updateMinPhotos, {
      count: MAX_MIN_PHOTOS_PER_LOT,
    });
    expect(await t.run((ctx) => getMinPhotosPerLot(ctx))).toBe(
      MAX_MIN_PHOTOS_PER_LOT
    );
    expect(
      (await t.query(api.admin.platformSettings.getPlatformSettings, {}))
        .minPhotosPerLot
    ).toBe(MAX_MIN_PHOTOS_PER_LOT);
    expect(await audits(t, "min-photos")).toBe(1);
  });

  it("caps the maximum at 4 angle slots plus the additional images", () => {
    expect(MAX_MIN_PHOTOS_PER_LOT).toBe(4 + MAX_ADDITIONAL_IMAGES);
  });

  it("falls back to the default when the stored value exceeds the maximum", async () => {
    const t = makeContext();
    await t.run((ctx) =>
      ctx.db.insert("settings", {
        key: "min_photos_per_lot",
        value: MAX_MIN_PHOTOS_PER_LOT + 1,
        updatedAt: 1,
      })
    );
    expect(await t.run((ctx) => getMinPhotosPerLot(ctx))).toBe(8);
  });

  it("rejects non-admins", async () => {
    const t = makeContext();
    await seed(t);
    await expect(
      t
        .withIdentity({ subject: BUYER })
        .mutation(api.admin.platformSettings.updateMinPhotos, { count: 5 })
    ).rejects.toThrow();
  });

  it.each([
    0,
    MAX_MIN_PHOTOS_PER_LOT + 1,
    2.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])("rejects %s", async (count) => {
    const t = makeContext();
    await seed(t);
    await expect(
      asAdmin(t).mutation(api.admin.platformSettings.updateMinPhotos, {
        count,
      })
    ).rejects.toThrow("Minimum photos per lot must be");
    expect(await audits(t, "min-photos")).toBe(0);
  });
});
