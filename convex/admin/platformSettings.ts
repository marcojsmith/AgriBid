import { v } from "convex/values";

import { mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { logAudit } from "../admin_utils";
import { requireAdmin } from "../lib/auth";
import * as constants from "../constants";

/** `settings` table keys owned by this module. */
const KEYS = {
  buyerPremiumPct: "buyer_premium_pct",
  depositEnabled: "deposit_enabled",
  depositAmount: "deposit_amount",
  depositRefundDays: "deposit_refund_days",
  sellerCommissionPct: "seller_commission_pct",
  sellerListingFee: "seller_listing_fee",
  sellerPayoutDays: "seller_payout_days",
  financeContactName: "finance_contact_name",
  financeContactCompany: "finance_contact_company",
  financeContactPhone: "finance_contact_phone",
  pushRemindersEnabled: "push_reminders_enabled",
  minPhotosPerLot: "min_photos_per_lot",
} as const;

const PHONE_PATTERN = /^[+\d][\d\s()-]{6,24}$/;

const SuccessValidator = v.object({ success: v.boolean() });

type SettingValue = string | number | boolean;

interface SettingWrite {
  key: string;
  value: SettingValue;
  description: string;
}

/**
 * Reads a raw setting value.
 *
 * @param ctx - Query context
 * @param key - Setting key
 * @returns The stored value or undefined
 */
async function readRaw(
  ctx: QueryCtx,
  key: string
): Promise<SettingValue | undefined> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  return row?.value;
}

/**
 * Reads a numeric setting, falling back to the default when the stored value
 * is missing, not a finite number, out of range or (optionally) not an integer.
 *
 * @param ctx - Query context
 * @param key - Setting key
 * @param fallback - Default value
 * @param min - Inclusive minimum
 * @param max - Inclusive maximum
 * @param integer - Whether the value must be an integer
 * @returns The effective value
 */
async function readNumber(
  ctx: QueryCtx,
  key: string,
  fallback: number,
  min: number,
  max: number,
  integer: boolean
): Promise<number> {
  const value = await readRaw(ctx, key);
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max &&
    (!integer || Number.isInteger(value))
  ) {
    return value;
  }
  return fallback;
}

/**
 * Reads a boolean setting with a default.
 *
 * @param ctx - Query context
 * @param key - Setting key
 * @param fallback - Default value
 * @returns The effective value
 */
async function readBoolean(
  ctx: QueryCtx,
  key: string,
  fallback: boolean
): Promise<boolean> {
  const value = await readRaw(ctx, key);
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Whether the "Remind me" sale-open push reminders feature is switched on.
 *
 * @param ctx - Query or mutation context
 * @returns True when admins have enabled push reminders (default off)
 */
export async function isPushRemindersEnabled(ctx: QueryCtx): Promise<boolean> {
  return await readBoolean(
    ctx,
    KEYS.pushRemindersEnabled,
    constants.DEFAULT_PUSH_REMINDERS_ENABLED
  );
}

/**
 * Reads an optional text setting; empty or non-string values read as null.
 *
 * @param ctx - Query context
 * @param key - Setting key
 * @returns The stored text or null
 */
async function readText(ctx: QueryCtx, key: string): Promise<string | null> {
  const value = await readRaw(ctx, key);
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * Minimum number of photos a lot needs before it can be submitted.
 *
 * @param ctx - Query context
 * @returns The configured minimum (1 to `MAX_MIN_PHOTOS_PER_LOT`, i.e. 10), default 8
 */
export async function getMinPhotosPerLot(ctx: QueryCtx): Promise<number> {
  return await readNumber(
    ctx,
    KEYS.minPhotosPerLot,
    constants.DEFAULT_MIN_PHOTOS_PER_LOT,
    1,
    constants.MAX_MIN_PHOTOS_PER_LOT,
    true
  );
}

/**
 * Buyer's premium as a percent (0-100).
 *
 * @param ctx - Query context
 * @returns The configured percent, default 12
 */
export async function getBuyerPremiumPct(ctx: QueryCtx): Promise<number> {
  return await readNumber(
    ctx,
    KEYS.buyerPremiumPct,
    constants.DEFAULT_BUYER_PREMIUM_PCT,
    0,
    100,
    false
  );
}

/** Validator for the resolved platform settings object. */
const PlatformSettingsValidator = v.object({
  buyerPremiumPct: v.number(),
  deposit: v.object({
    enabled: v.boolean(),
    amount: v.number(),
    refundDays: v.number(),
  }),
  sellerCosts: v.object({
    commissionPct: v.number(),
    listingFee: v.number(),
    payoutDays: v.number(),
  }),
  financeContact: v.object({
    name: v.union(v.string(), v.null()),
    company: v.union(v.string(), v.null()),
    phone: v.union(v.string(), v.null()),
  }),
  pushRemindersEnabled: v.boolean(),
  minPhotosPerLot: v.number(),
});

/**
 * Public query: every platform setting resolved with its default.
 *
 * Intentionally unauthenticated; these values are shown to buyers and sellers.
 */
export const getPlatformSettings = query({
  args: {},
  returns: PlatformSettingsValidator,
  handler: async (ctx) => {
    const [
      buyerPremiumPct,
      depositEnabled,
      depositAmount,
      depositRefundDays,
      commissionPct,
      listingFee,
      payoutDays,
      name,
      company,
      phone,
      pushRemindersEnabled,
      minPhotosPerLot,
    ] = await Promise.all([
      getBuyerPremiumPct(ctx),
      readBoolean(ctx, KEYS.depositEnabled, constants.DEFAULT_DEPOSIT_ENABLED),
      readNumber(
        ctx,
        KEYS.depositAmount,
        constants.DEFAULT_DEPOSIT_AMOUNT,
        0,
        constants.MAX_DEPOSIT_AMOUNT,
        true
      ),
      readNumber(
        ctx,
        KEYS.depositRefundDays,
        constants.DEFAULT_DEPOSIT_REFUND_DAYS,
        1,
        constants.MAX_DEPOSIT_REFUND_DAYS,
        true
      ),
      readNumber(
        ctx,
        KEYS.sellerCommissionPct,
        constants.DEFAULT_SELLER_COMMISSION_PCT,
        0,
        100,
        false
      ),
      readNumber(
        ctx,
        KEYS.sellerListingFee,
        constants.DEFAULT_SELLER_LISTING_FEE,
        0,
        Number.MAX_SAFE_INTEGER,
        false
      ),
      readNumber(
        ctx,
        KEYS.sellerPayoutDays,
        constants.DEFAULT_SELLER_PAYOUT_DAYS,
        1,
        constants.MAX_SELLER_PAYOUT_DAYS,
        true
      ),
      readText(ctx, KEYS.financeContactName),
      readText(ctx, KEYS.financeContactCompany),
      readText(ctx, KEYS.financeContactPhone),
      readBoolean(
        ctx,
        KEYS.pushRemindersEnabled,
        constants.DEFAULT_PUSH_REMINDERS_ENABLED
      ),
      getMinPhotosPerLot(ctx),
    ]);

    return {
      buyerPremiumPct,
      deposit: {
        enabled: depositEnabled,
        amount: depositAmount,
        refundDays: depositRefundDays,
      },
      sellerCosts: { commissionPct, listingFee, payoutDays },
      financeContact: { name, company, phone },
      pushRemindersEnabled,
      minPhotosPerLot,
    };
  },
});

/**
 * Throws unless `value` is a finite number within range (and an integer when
 * required). Rejects NaN and Infinity.
 *
 * @param label - Human label for the error message
 * @param value - Candidate value
 * @param min - Inclusive minimum
 * @param max - Inclusive maximum
 * @param integer - Whether the value must be an integer
 */
function assertNumber(
  label: string,
  value: number,
  min: number,
  max: number,
  integer: boolean
): void {
  if (
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  ) {
    throw new Error(
      `${label} must be ${integer ? "a whole number" : "a number"} between ${String(min)} and ${String(max)}`
    );
  }
}

/**
 * Upserts settings and writes one audit entry.
 *
 * @param ctx - Mutation context
 * @param writes - Settings to store
 * @param targetId - Audit target id
 */
async function saveSettings(
  ctx: MutationCtx,
  writes: SettingWrite[],
  targetId: string
): Promise<void> {
  for (const write of writes) {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", write.key))
      .unique();
    if (existing) {
      await ctx.db.patch("settings", existing._id, {
        value: write.value,
        description: write.description,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("settings", {
        key: write.key,
        value: write.value,
        description: write.description,
        updatedAt: Date.now(),
      });
    }
  }
  await logAudit(ctx, {
    action: "UPDATE_SETTING",
    targetId,
    targetType: "setting",
    details: `Updated ${writes.map((w) => `${w.key}=${String(w.value)}`).join(", ")}`,
  });
}

/**
 * Admin-only: set the buyer's premium (percent, 0-100).
 */
export const updateBuyerPremium = mutation({
  args: { pct: v.number() },
  returns: SuccessValidator,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    assertNumber("Buyer premium", args.pct, 0, 100, false);
    await saveSettings(
      ctx,
      [
        {
          key: KEYS.buyerPremiumPct,
          value: args.pct,
          description:
            "Default buyer's premium (percent, 0-100) for auctions without their own",
        },
      ],
      "buyer-premium"
    );
    return { success: true };
  },
});

/**
 * Admin-only: set the registration deposit rules.
 */
export const updateRegistrationDeposit = mutation({
  args: {
    enabled: v.boolean(),
    amount: v.number(),
    refundDays: v.number(),
  },
  returns: SuccessValidator,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    assertNumber(
      "Deposit amount",
      args.amount,
      0,
      constants.MAX_DEPOSIT_AMOUNT,
      true
    );
    assertNumber(
      "Deposit refund days",
      args.refundDays,
      1,
      constants.MAX_DEPOSIT_REFUND_DAYS,
      true
    );
    await saveSettings(
      ctx,
      [
        {
          key: KEYS.depositEnabled,
          value: args.enabled,
          description: "Whether a registration deposit is required",
        },
        {
          key: KEYS.depositAmount,
          value: args.amount,
          description: "Registration deposit in rand (0-1,000,000)",
        },
        {
          key: KEYS.depositRefundDays,
          value: args.refundDays,
          description: "Days to refund a registration deposit (1-30)",
        },
      ],
      "registration-deposit"
    );
    return { success: true };
  },
});

/**
 * Admin-only: set the seller cost terms (display only; not used in settlement).
 */
export const updateSellerCosts = mutation({
  args: {
    commissionPct: v.number(),
    listingFee: v.number(),
    payoutDays: v.number(),
  },
  returns: SuccessValidator,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    assertNumber("Seller commission", args.commissionPct, 0, 100, false);
    assertNumber(
      "Seller listing fee",
      args.listingFee,
      0,
      Number.MAX_SAFE_INTEGER,
      false
    );
    assertNumber(
      "Seller payout days",
      args.payoutDays,
      1,
      constants.MAX_SELLER_PAYOUT_DAYS,
      true
    );
    await saveSettings(
      ctx,
      [
        {
          key: KEYS.sellerCommissionPct,
          value: args.commissionPct,
          description: "Seller commission (percent, display only)",
        },
        {
          key: KEYS.sellerListingFee,
          value: args.listingFee,
          description: "Seller listing fee in rand",
        },
        {
          key: KEYS.sellerPayoutDays,
          value: args.payoutDays,
          description: "Days until seller payout (1-60)",
        },
      ],
      "seller-costs"
    );
    return { success: true };
  },
});

/**
 * Trims a finance contact text field and enforces the length cap.
 *
 * @param label - Field label for errors
 * @param value - Raw input
 * @returns The trimmed value
 */
function cleanContactText(label: string, value: string): string {
  const trimmed = value.trim();
  if (trimmed.length > constants.MAX_FINANCE_CONTACT_FIELD_LENGTH) {
    throw new Error(
      `${label} must be at most ${String(constants.MAX_FINANCE_CONTACT_FIELD_LENGTH)} characters`
    );
  }
  return trimmed;
}

/**
 * Admin-only: set the finance contact shown to buyers. An empty value clears it.
 */
export const updateFinanceContact = mutation({
  args: { name: v.string(), company: v.string(), phone: v.string() },
  returns: SuccessValidator,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const name = cleanContactText("Finance contact name", args.name);
    const company = cleanContactText("Finance contact company", args.company);
    const phone = cleanContactText("Finance contact phone", args.phone);
    if (phone !== "" && !PHONE_PATTERN.test(phone)) {
      throw new Error("Finance contact phone is not a valid phone number");
    }
    await saveSettings(
      ctx,
      [
        {
          key: KEYS.financeContactName,
          value: name,
          description: "Finance contact name (empty clears)",
        },
        {
          key: KEYS.financeContactCompany,
          value: company,
          description: "Finance contact company (empty clears)",
        },
        {
          key: KEYS.financeContactPhone,
          value: phone,
          description: "Finance contact phone (empty clears)",
        },
      ],
      "finance-contact"
    );
    return { success: true };
  },
});

/**
 * Admin-only: switch sale-open push reminders on or off.
 */
export const updatePushReminders = mutation({
  args: { enabled: v.boolean() },
  returns: SuccessValidator,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await saveSettings(
      ctx,
      [
        {
          key: KEYS.pushRemindersEnabled,
          value: args.enabled,
          description: "Whether push reminders are enabled",
        },
      ],
      "push-reminders"
    );
    return { success: true };
  },
});

/**
 * Admin-only: set the minimum number of photos per lot (1-10: the four angle
 * slots plus the maximum additional images).
 */
export const updateMinPhotos = mutation({
  args: { count: v.number() },
  returns: SuccessValidator,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    assertNumber(
      "Minimum photos per lot",
      args.count,
      1,
      constants.MAX_MIN_PHOTOS_PER_LOT,
      true
    );
    await saveSettings(
      ctx,
      [
        {
          key: KEYS.minPhotosPerLot,
          value: args.count,
          description: "Minimum photos required per lot (1-10)",
        },
      ],
      "min-photos"
    );
    return { success: true };
  },
});
