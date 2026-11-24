/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { SALE_REMINDER_BATCH, SALE_REMINDER_STALE_MS } from "./constants";
import { sendDueSaleRemindersHandler } from "./push";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

const ALICE = "user_alice";
const BOB = "user_bob";
const HOUR = 3_600_000;
const sub = (endpoint = "https://push.example/abc") => ({
  endpoint,
  p256dh: "p256",
  auth: "authkey",
});

const makeContext = () => convexTest(schema, modules);
type Ctx = ReturnType<typeof makeContext>;

/**
 * Switches the push reminders platform setting.
 *
 * @param t - Test context
 * @param enabled - New value
 */
async function setSetting(t: Ctx, enabled: boolean) {
  await t.run(async (ctx) => {
    await ctx.db.insert("settings", {
      key: "push_reminders_enabled",
      value: enabled,
      description: "test",
      updatedAt: Date.now(),
    });
  });
}

/**
 * Inserts a published sale.
 *
 * @param t - Test context
 * @param startTime - When the sale opens
 * @param status - Sale status
 * @returns The auction id
 */
async function makeSale(
  t: Ctx,
  startTime: number,
  status: "published" | "draft" = "published"
): Promise<Id<"auctions">> {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("auctions", {
      title: "Year End Sale",
      startTime,
      endTime: startTime + 48 * HOUR,
      status,
      createdBy: "admin",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
}

/**
 * Inserts a pending reminder.
 *
 * @param t - Test context
 * @param userId - The user
 * @param auctionId - The sale
 */
async function remind(t: Ctx, userId: string, auctionId: Id<"auctions">) {
  await t.run(async (ctx) => {
    await ctx.db.insert("saleReminders", {
      userId,
      auctionId,
      status: "pending",
      createdAt: Date.now(),
    });
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("getVapidPublicKey", () => {
  it("is null without the env var", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "");
    const t = makeContext();
    expect(await t.query(api.push.getVapidPublicKey, {})).toBeNull();
  });

  it("returns the key", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "pub-key");
    const t = makeContext();
    expect(await t.query(api.push.getVapidPublicKey, {})).toBe("pub-key");
  });
});

describe("saveSubscription", () => {
  it("requires auth", async () => {
    const t = makeContext();
    await expect(t.mutation(api.push.saveSubscription, sub())).rejects.toThrow(
      "Not authenticated"
    );
  });

  it("inserts, then updates the same endpoint without duplicating", async () => {
    const t = makeContext();
    const asAlice = t.withIdentity({ subject: ALICE });
    await asAlice.mutation(api.push.saveSubscription, sub());
    await asAlice.mutation(api.push.saveSubscription, {
      ...sub(),
      auth: "rotated",
    });
    const rows = await t.run((ctx) =>
      ctx.db.query("pushSubscriptions").collect()
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: ALICE, auth: "rotated" });
  });

  it("reassigns an endpoint another user owned", async () => {
    const t = makeContext();
    await t
      .withIdentity({ subject: ALICE })
      .mutation(api.push.saveSubscription, sub());
    await t
      .withIdentity({ subject: BOB })
      .mutation(api.push.saveSubscription, sub());
    const rows = await t.run((ctx) =>
      ctx.db.query("pushSubscriptions").collect()
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(BOB);
  });

  it("rejects oversized keys and keeps at most 10 devices per user", async () => {
    const t = makeContext();
    const asAlice = t.withIdentity({ subject: ALICE });
    await expect(
      asAlice.mutation(api.push.saveSubscription, {
        ...sub(),
        p256dh: "k".repeat(200),
      })
    ).rejects.toThrow("Invalid push endpoint");
    for (let i = 0; i < 12; i++) {
      await asAlice.mutation(
        api.push.saveSubscription,
        sub(`https://push.example/${String(i)}`)
      );
    }
    const rows = await t.run((ctx) =>
      ctx.db.query("pushSubscriptions").collect()
    );
    expect(rows).toHaveLength(10);
    expect(rows.map((r) => r.endpoint)).not.toContain("https://push.example/0");
    expect(rows.map((r) => r.endpoint)).toContain("https://push.example/11");
  });

  it("rejects non-https and over-long endpoints", async () => {
    const t = makeContext();
    const asAlice = t.withIdentity({ subject: ALICE });
    await expect(
      asAlice.mutation(api.push.saveSubscription, sub("http://push.example/x"))
    ).rejects.toThrow("Invalid push endpoint");
    await expect(
      asAlice.mutation(
        api.push.saveSubscription,
        sub(`https://push.example/${"a".repeat(2100)}`)
      )
    ).rejects.toThrow("Invalid push endpoint");
  });
});

describe("removeSubscription", () => {
  it("deletes only the caller's own row", async () => {
    const t = makeContext();
    await t
      .withIdentity({ subject: ALICE })
      .mutation(api.push.saveSubscription, sub());
    await t
      .withIdentity({ subject: BOB })
      .mutation(api.push.removeSubscription, { endpoint: sub().endpoint });
    expect(
      await t.run((ctx) => ctx.db.query("pushSubscriptions").collect())
    ).toHaveLength(1);
    await t
      .withIdentity({ subject: ALICE })
      .mutation(api.push.removeSubscription, { endpoint: sub().endpoint });
    expect(
      await t.run((ctx) => ctx.db.query("pushSubscriptions").collect())
    ).toHaveLength(0);
  });

  it("is a no-op for an unknown endpoint", async () => {
    const t = makeContext();
    await expect(
      t
        .withIdentity({ subject: ALICE })
        .mutation(api.push.removeSubscription, { endpoint: "https://x/y" })
    ).resolves.toBeNull();
  });
});

describe("sale reminders", () => {
  it("getMySaleReminder is false when signed out", async () => {
    const t = makeContext();
    const id = await makeSale(t, Date.now() + HOUR);
    expect(await t.query(api.push.getMySaleReminder, { auctionId: id })).toBe(
      false
    );
  });

  it("setSaleReminder requires auth", async () => {
    const t = makeContext();
    await setSetting(t, true);
    const id = await makeSale(t, Date.now() + HOUR);
    await expect(
      t.mutation(api.push.setSaleReminder, { auctionId: id, on: true })
    ).rejects.toThrow("Not authenticated");
  });

  it("is refused while the setting is off", async () => {
    const t = makeContext();
    const id = await makeSale(t, Date.now() + HOUR);
    await expect(
      t
        .withIdentity({ subject: ALICE })
        .mutation(api.push.setSaleReminder, { auctionId: id, on: true })
    ).rejects.toThrow("Reminders are not available");
  });

  it("is refused for a started sale or a draft", async () => {
    const t = makeContext();
    await setSetting(t, true);
    const started = await makeSale(t, Date.now() - HOUR);
    const draft = await makeSale(t, Date.now() + HOUR, "draft");
    const asAlice = t.withIdentity({ subject: ALICE });
    await expect(
      asAlice.mutation(api.push.setSaleReminder, {
        auctionId: started,
        on: true,
      })
    ).rejects.toThrow("This sale can't be reminded");
    await expect(
      asAlice.mutation(api.push.setSaleReminder, { auctionId: draft, on: true })
    ).rejects.toThrow("This sale can't be reminded");
  });

  it("sets and clears idempotently", async () => {
    const t = makeContext();
    await setSetting(t, true);
    const id = await makeSale(t, Date.now() + HOUR);
    const asAlice = t.withIdentity({ subject: ALICE });
    await asAlice.mutation(api.push.setSaleReminder, {
      auctionId: id,
      on: true,
    });
    await asAlice.mutation(api.push.setSaleReminder, {
      auctionId: id,
      on: true,
    });
    expect(
      await asAlice.query(api.push.getMySaleReminder, { auctionId: id })
    ).toBe(true);
    expect(
      await t.run((ctx) => ctx.db.query("saleReminders").collect())
    ).toHaveLength(1);
    await asAlice.mutation(api.push.setSaleReminder, {
      auctionId: id,
      on: false,
    });
    await asAlice.mutation(api.push.setSaleReminder, {
      auctionId: id,
      on: false,
    });
    expect(
      await asAlice.query(api.push.getMySaleReminder, { auctionId: id })
    ).toBe(false);
  });

  it("re-arms a sent reminder when the sale is re-timed", async () => {
    const t = makeContext();
    await setSetting(t, true);
    const id = await makeSale(t, Date.now() + HOUR);
    await t.run(async (ctx) => {
      await ctx.db.insert("saleReminders", {
        userId: ALICE,
        auctionId: id,
        status: "sent",
        createdAt: Date.now(),
        sentAt: Date.now(),
      });
    });
    const asAlice = t.withIdentity({ subject: ALICE });
    expect(
      await asAlice.query(api.push.getMySaleReminder, { auctionId: id })
    ).toBe(false);
    await asAlice.mutation(api.push.setSaleReminder, {
      auctionId: id,
      on: true,
    });
    expect(
      await asAlice.query(api.push.getMySaleReminder, { auctionId: id })
    ).toBe(true);
    const rows = await t.run((ctx) => ctx.db.query("saleReminders").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sentAt).toBeUndefined();
  });

  it("can clear a reminder even after the setting is switched off", async () => {
    const t = makeContext();
    await setSetting(t, false);
    const id = await makeSale(t, Date.now() + HOUR);
    await remind(t, ALICE, id);
    await t
      .withIdentity({ subject: ALICE })
      .mutation(api.push.setSaleReminder, { auctionId: id, on: false });
    expect(
      await t.run((ctx) => ctx.db.query("saleReminders").collect())
    ).toHaveLength(0);
  });
});

describe("sendDueSaleRemindersHandler", () => {
  const run = (t: Ctx, now: number) =>
    t.run((ctx) => sendDueSaleRemindersHandler(ctx, now));

  it("does nothing while the setting is off", async () => {
    const t = makeContext();
    const now = Date.now();
    const id = await makeSale(t, now - 1000);
    await remind(t, ALICE, id);
    expect(await run(t, now)).toEqual({ sent: 0, hasMore: false });
    const rows = await t.run((ctx) => ctx.db.query("saleReminders").collect());
    expect(rows[0]?.status).toBe("pending");
  });

  it("marks reminders sent, notifies and schedules the push batch", async () => {
    const t = makeContext();
    await setSetting(t, true);
    const now = Date.now();
    const id = await makeSale(t, now - 1000);
    await remind(t, ALICE, id);
    await remind(t, BOB, id);
    await t.run(async (ctx) => {
      await ctx.db.insert("pushSubscriptions", {
        userId: ALICE,
        ...sub(),
        createdAt: now,
      });
      await ctx.db.insert("pushSubscriptions", {
        userId: ALICE,
        ...sub("https://push.example/second"),
        createdAt: now,
      });
    });

    expect(await run(t, now)).toEqual({ sent: 2, hasMore: false });

    const state = await t.run(async (ctx) => ({
      reminders: await ctx.db.query("saleReminders").collect(),
      notifications: await ctx.db.query("notifications").collect(),
      scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
    }));
    expect(state.reminders.every((r) => r.status === "sent")).toBe(true);
    expect(state.reminders.every((r) => r.sentAt === now)).toBe(true);
    expect(state.notifications).toHaveLength(2);
    expect(state.notifications[0]).toMatchObject({
      type: "info",
      title: "Year End Sale is open",
      message: "Bidding has started. Tap to see the lots.",
      link: `/auctions/${id}`,
    });
    const push = state.scheduled.filter((s) =>
      s.name.includes("sendPushBatch")
    );
    expect(push).toHaveLength(1);
    const messages = (
      push[0]?.args[0] as {
        messages: { endpoint: string; payload: string }[];
      }
    ).messages;
    expect(messages).toHaveLength(2);
    expect(JSON.parse(messages[0]?.payload ?? "{}")).toEqual({
      title: "Year End Sale is open",
      body: "Bidding has started. Tap to see the lots.",
      url: `/auctions/${id}`,
      tag: `sale-${id}`,
    });
    // A second run finds nothing left to send.
    expect(await run(t, now)).toEqual({ sent: 0, hasMore: false });
  });

  it("skips push scheduling when nobody has a subscription", async () => {
    const t = makeContext();
    await setSetting(t, true);
    const now = Date.now();
    const id = await makeSale(t, now - 1000);
    await remind(t, ALICE, id);
    expect((await run(t, now)).sent).toBe(1);
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(scheduled).toHaveLength(0);
  });

  it("skips future, stale and unpublished sales", async () => {
    const t = makeContext();
    await setSetting(t, true);
    const now = Date.now();
    const future = await makeSale(t, now + HOUR);
    const stale = await makeSale(t, now - SALE_REMINDER_STALE_MS - 1000);
    const draft = await makeSale(t, now - 1000, "draft");
    for (const id of [future, stale, draft]) await remind(t, ALICE, id);
    expect(await run(t, now)).toEqual({ sent: 0, hasMore: false });
  });

  it("caps a run at the batch size and reports hasMore", async () => {
    const t = makeContext();
    await setSetting(t, true);
    const now = Date.now();
    const id = await makeSale(t, now - 1000);
    await t.run(async (ctx) => {
      for (let i = 0; i < SALE_REMINDER_BATCH + 1; i++) {
        await ctx.db.insert("saleReminders", {
          userId: `user_${String(i)}`,
          auctionId: id,
          status: "pending",
          createdAt: now,
        });
      }
    });
    expect(await run(t, now)).toEqual({
      sent: SALE_REMINDER_BATCH,
      hasMore: true,
    });
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(scheduled.some((s) => s.name.includes("sendSaleReminders"))).toBe(
      true
    );
  });
});

describe("deleteSubscriptions", () => {
  it("removes the listed endpoints only", async () => {
    const t = makeContext();
    await t.run(async (ctx) => {
      for (const endpoint of ["https://a/1", "https://a/2"]) {
        await ctx.db.insert("pushSubscriptions", {
          userId: ALICE,
          ...sub(endpoint),
          createdAt: Date.now(),
        });
      }
    });
    await t.mutation(internal.push.deleteSubscriptions, {
      endpoints: ["https://a/1", "https://a/unknown"],
    });
    const rows = await t.run((ctx) =>
      ctx.db.query("pushSubscriptions").collect()
    );
    expect(rows.map((r) => r.endpoint)).toEqual(["https://a/2"]);
  });
});
