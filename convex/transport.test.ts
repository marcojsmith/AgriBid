/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api } from "./_generated/api";
import {
  MAX_TRANSPORT_QUOTES_GLOBAL,
  MS_PER_HOUR,
  TRANSPORT_QUOTE_MAX_NAME_LENGTH,
  TRANSPORT_QUOTE_MAX_NOTES_LENGTH,
} from "./constants";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

const base = {
  deliveryTown: "Bloemfontein",
  deliveryProvince: "free_state" as const,
  name: "Thandi",
  phone: "083 700 0000",
  pickup: "Paarl",
};

const makeContext = () => convexTest(schema, modules);
type Ctx = ReturnType<typeof makeContext>;

/**
 * Inserts a lot.
 *
 * @param t - Test context
 * @param extra - Field overrides
 * @param extra.lotNumber - Lot number within the sale
 * @param extra.province - Province the lot stands in
 * @returns The lot id
 */
async function makeLot(
  t: Ctx,
  extra: { lotNumber?: number; province?: "western_cape" } = {}
): Promise<Id<"lots">> {
  return await t.run((ctx) =>
    ctx.db.insert("lots", {
      title: "John Deere 5075E",
      make: "John Deere",
      model: "5075E",
      year: 2020,
      operatingHours: 100,
      location: "Malmesbury",
      reservePrice: 1000,
      startingPrice: 500,
      currentPrice: 500,
      minIncrement: 50,
      sellerId: "seller",
      status: "approved",
      images: [],
      ...extra,
    })
  );
}

/**
 * Reads all stored requests.
 *
 * @param t - Test context
 * @returns The rows
 */
const rows = (t: Ctx) =>
  t.run((ctx) => ctx.db.query("transportQuoteRequests").collect());

describe("transport.requestQuote", () => {
  it("lets a guest submit and normalises the phone", async () => {
    const t = makeContext();
    await t.mutation(api.transport.requestQuote, {
      ...base,
      notes: "  two trailers ",
    });
    const [row] = await rows(t);
    expect(row).toMatchObject({
      phone: "+27837000000",
      status: "new",
      pickup: "Paarl",
      notes: "two trailers",
    });
    expect(row?.userId).toBeUndefined();
  });

  it("stores the user id when signed in", async () => {
    const t = makeContext();
    await t
      .withIdentity({ subject: "user_1" })
      .mutation(api.transport.requestQuote, base);
    expect((await rows(t))[0]?.userId).toBe("user_1");
  });

  it("builds pickup and label from the lot, ignoring the client", async () => {
    const t = makeContext();
    const lotId = await makeLot(t, { lotNumber: 4, province: "western_cape" });
    await t.mutation(api.transport.requestQuote, {
      ...base,
      lotId,
      pickup: "Evil",
    });
    expect((await rows(t))[0]).toMatchObject({
      pickup: "Malmesbury, Western Cape",
      lotLabel: "John Deere 5075E · Lot 4",
    });
  });

  it("uses the bare title and location when the lot has no number or province", async () => {
    const t = makeContext();
    const lotId = await makeLot(t);
    await t.mutation(api.transport.requestQuote, { ...base, lotId });
    expect((await rows(t))[0]).toMatchObject({
      pickup: "Malmesbury",
      lotLabel: "John Deere 5075E",
    });
  });

  it("rejects a lot that does not exist", async () => {
    const t = makeContext();
    const lotId = await makeLot(t);
    await t.run((ctx) => ctx.db.delete("lots", lotId));
    await expect(
      t.mutation(api.transport.requestQuote, { ...base, lotId })
    ).rejects.toThrow("Lot not found.");
  });

  it("refuses no lot and no pickup", async () => {
    const t = makeContext();
    await expect(
      t.mutation(api.transport.requestQuote, { ...base, pickup: "  " })
    ).rejects.toThrow("Enter where to collect from.");
    await expect(
      t.mutation(api.transport.requestQuote, { ...base, pickup: undefined })
    ).rejects.toThrow("Enter where to collect from.");
  });

  it.each([
    [{ phone: "12345" }, "Enter a South African phone number"],
    [{ name: "  " }, "Enter your name."],
    [{ deliveryTown: " " }, "Enter the delivery town."],
    [
      { name: "x".repeat(TRANSPORT_QUOTE_MAX_NAME_LENGTH + 1) },
      "Enter your name.",
    ],
    [
      { notes: "x".repeat(TRANSPORT_QUOTE_MAX_NOTES_LENGTH + 1) },
      "Notes must be at most",
    ],
  ])("rejects bad input %j", async (override, message) => {
    const t = makeContext();
    await expect(
      t.mutation(api.transport.requestQuote, { ...base, ...override })
    ).rejects.toThrow(message);
    expect(await rows(t)).toHaveLength(0);
  });

  it("refuses the 4th request from the same phone", async () => {
    const t = makeContext();
    for (let i = 0; i < 3; i++) {
      await t.mutation(api.transport.requestQuote, base);
    }
    await expect(
      t.mutation(api.transport.requestQuote, {
        ...base,
        phone: "+27837000000",
      })
    ).rejects.toThrow("Too many requests. Try again later.");
  });

  it("refuses the 6th request from the same user", async () => {
    const t = makeContext();
    const user = t.withIdentity({ subject: "user_1" });
    for (let i = 0; i < 5; i++) {
      await user.mutation(api.transport.requestQuote, {
        ...base,
        phone: `083 700 000${i.toString()}`,
      });
    }
    await expect(
      user.mutation(api.transport.requestQuote, {
        ...base,
        phone: "083 700 0009",
      })
    ).rejects.toThrow("Too many requests. Try again later.");
  });

  it("enforces the global cap", async () => {
    const t = makeContext();
    await t.run(async (ctx) => {
      for (let i = 0; i < MAX_TRANSPORT_QUOTES_GLOBAL; i++) {
        await ctx.db.insert("transportQuoteRequests", {
          pickup: "x",
          deliveryTown: "x",
          deliveryProvince: "gauteng",
          name: "x",
          phone: `+2782${String(1000000 + i)}`,
          status: "new",
          createdAt: Date.now(),
        });
      }
    });
    await expect(t.mutation(api.transport.requestQuote, base)).rejects.toThrow(
      "Too many requests. Try again later."
    );
  });

  it("ignores requests older than the window", async () => {
    const t = makeContext();
    await t.run(async (ctx) => {
      for (let i = 0; i < 3; i++) {
        await ctx.db.insert("transportQuoteRequests", {
          pickup: "x",
          deliveryTown: "x",
          deliveryProvince: "gauteng",
          name: "x",
          phone: "+27837000000",
          status: "new",
          createdAt: Date.now() - 2 * MS_PER_HOUR,
        });
      }
    });
    await t.mutation(api.transport.requestQuote, base);
    expect(await rows(t)).toHaveLength(4);
  });
});
