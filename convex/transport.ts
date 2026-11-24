import { v, ConvexError } from "convex/values";

import { mutation, type MutationCtx } from "./_generated/server";
import { getAuthUser, resolveUserId } from "./lib/auth";
import { normalizeSaPhone } from "./lib/phone";
import {
  PROVINCE_LABELS,
  provinceValidator,
  type Province,
} from "./lib/provinces";
import {
  MAX_TRANSPORT_QUOTES_GLOBAL,
  MAX_TRANSPORT_QUOTES_PER_PHONE,
  MAX_TRANSPORT_QUOTES_PER_USER,
  TRANSPORT_QUOTE_MAX_NAME_LENGTH,
  TRANSPORT_QUOTE_MAX_NOTES_LENGTH,
  TRANSPORT_QUOTE_MAX_PICKUP_LENGTH,
  TRANSPORT_QUOTE_MAX_TOWN_LENGTH,
  TRANSPORT_QUOTE_RATE_LIMIT_WINDOW_MS,
} from "./constants";
import type { Id } from "./_generated/dataModel";

const TOO_MANY = "Too many requests. Try again later.";

/**
 * Trims a required field and checks its length.
 *
 * @param value - The raw value
 * @param max - Maximum length
 * @param message - Error message when empty or too long
 * @returns The trimmed value
 */
function requiredText(value: string, max: number, message: string): string {
  const text = value.trim();
  if (text.length === 0 || text.length > max) throw new ConvexError(message);
  return text;
}

/**
 * Handler for a transport quote request. Guests are allowed, so this does not
 * call `requireAuth`; the signed-in user id is stored when there is one. The
 * pickup and lot label are built on the server when a lot is given.
 *
 * @param ctx - The mutation context
 * @param args - The form values
 * @param args.lotId - The lot the request is about, when any
 * @param args.pickup - Pickup place (required without a lot; ignored with one)
 * @param args.deliveryTown - Delivery town
 * @param args.deliveryProvince - Delivery province
 * @param args.name - Requester name
 * @param args.phone - Requester phone, any common SA format
 * @param args.notes - Optional notes
 * @returns Null
 */
export const requestQuoteHandler = async (
  ctx: MutationCtx,
  args: {
    lotId?: Id<"lots">;
    pickup?: string;
    deliveryTown: string;
    deliveryProvince: Province;
    name: string;
    phone: string;
    notes?: string;
  }
): Promise<null> => {
  const authUser = await getAuthUser(ctx);
  const userId = authUser ? (resolveUserId(authUser) ?? undefined) : undefined;

  const name = requiredText(
    args.name,
    TRANSPORT_QUOTE_MAX_NAME_LENGTH,
    "Enter your name."
  );
  const deliveryTown = requiredText(
    args.deliveryTown,
    TRANSPORT_QUOTE_MAX_TOWN_LENGTH,
    "Enter the delivery town."
  );
  const phone = normalizeSaPhone(args.phone);
  if (!phone) {
    throw new ConvexError(
      "Enter a South African phone number, like 083 700 0000."
    );
  }
  const notes = args.notes?.trim() ?? "";
  if (notes.length > TRANSPORT_QUOTE_MAX_NOTES_LENGTH) {
    throw new ConvexError(
      `Notes must be at most ${TRANSPORT_QUOTE_MAX_NOTES_LENGTH.toString()} characters.`
    );
  }

  let pickup: string;
  let lotLabel: string | undefined;
  if (args.lotId) {
    const lot = await ctx.db.get("lots", args.lotId);
    if (!lot) throw new ConvexError("Lot not found.");
    pickup = lot.province
      ? `${lot.location}, ${PROVINCE_LABELS[lot.province]}`
      : lot.location;
    lotLabel =
      lot.lotNumber !== undefined
        ? `${lot.title} · Lot ${lot.lotNumber.toString()}`
        : lot.title;
  } else {
    pickup = requiredText(
      args.pickup ?? "",
      TRANSPORT_QUOTE_MAX_PICKUP_LENGTH,
      "Enter where to collect from."
    );
  }

  const windowStart = Date.now() - TRANSPORT_QUOTE_RATE_LIMIT_WINDOW_MS;
  const byPhone = await ctx.db
    .query("transportQuoteRequests")
    .withIndex("by_phone_and_createdAt", (q) =>
      q.eq("phone", phone).gte("createdAt", windowStart)
    )
    .take(MAX_TRANSPORT_QUOTES_PER_PHONE + 1);
  if (byPhone.length >= MAX_TRANSPORT_QUOTES_PER_PHONE) {
    throw new ConvexError(TOO_MANY);
  }
  if (userId) {
    const byUser = await ctx.db
      .query("transportQuoteRequests")
      .withIndex("by_userId_and_createdAt", (q) =>
        q.eq("userId", userId).gte("createdAt", windowStart)
      )
      .take(MAX_TRANSPORT_QUOTES_PER_USER + 1);
    if (byUser.length >= MAX_TRANSPORT_QUOTES_PER_USER) {
      throw new ConvexError(TOO_MANY);
    }
  }
  const recent = await ctx.db
    .query("transportQuoteRequests")
    .withIndex("by_createdAt", (q) => q.gte("createdAt", windowStart))
    .take(MAX_TRANSPORT_QUOTES_GLOBAL + 1);
  if (recent.length >= MAX_TRANSPORT_QUOTES_GLOBAL) {
    throw new ConvexError(TOO_MANY);
  }

  await ctx.db.insert("transportQuoteRequests", {
    userId,
    lotId: args.lotId,
    lotLabel,
    pickup,
    deliveryTown,
    deliveryProvince: args.deliveryProvince,
    name,
    phone,
    notes: notes || undefined,
    status: "new",
    createdAt: Date.now(),
  });
  return null;
};

/**
 * Request a transport quote. Open to guests; the AgriBid team sees requests
 * in the admin Support page.
 */
export const requestQuote = mutation({
  args: {
    lotId: v.optional(v.id("lots")),
    pickup: v.optional(v.string()),
    deliveryTown: v.string(),
    deliveryProvince: provinceValidator,
    name: v.string(),
    phone: v.string(),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: requestQuoteHandler,
});
