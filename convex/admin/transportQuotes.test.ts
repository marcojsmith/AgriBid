/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api } from "../_generated/api";
import schema from "../schema";
import type { Id } from "../_generated/dataModel";

const modules = import.meta.glob("../**/*.*s");

const makeContext = () => convexTest(schema, modules);
type Ctx = ReturnType<typeof makeContext>;

const paging = { numItems: 50, cursor: null };

/**
 * Seeds an admin and a buyer profile.
 *
 * @param t - Test context
 */
async function seedProfiles(t: Ctx): Promise<void> {
  await t.run(async (ctx) => {
    const now = Date.now();
    for (const [userId, role] of [
      ["admin_1", "admin"],
      ["buyer_1", "buyer"],
    ] as const) {
      await ctx.db.insert("profiles", {
        userId,
        name: userId,
        email: `${userId}@example.com`,
        role,
        isVerified: true,
        kycStatus: "verified",
        createdAt: now,
        updatedAt: now,
      });
    }
  });
}

/**
 * Inserts a transport quote request.
 *
 * @param t - Test context
 * @param status - Request status
 * @param createdAt - Creation time
 * @returns The request id
 */
async function makeRequest(
  t: Ctx,
  status: "new" | "handled",
  createdAt: number
): Promise<Id<"transportQuoteRequests">> {
  return await t.run((ctx) =>
    ctx.db.insert("transportQuoteRequests", {
      pickup: "Paarl",
      deliveryTown: "Bloemfontein",
      deliveryProvince: "free_state",
      name: "Thandi",
      phone: "+27837000000",
      status,
      createdAt,
    })
  );
}

describe("admin.getTransportQuotes", () => {
  it("refuses a non-admin", async () => {
    const t = makeContext();
    await seedProfiles(t);
    await expect(
      t
        .withIdentity({ subject: "buyer_1" })
        .query(api.admin.getTransportQuotes, { paginationOpts: paging })
    ).rejects.toThrow("Admin privileges required");
  });

  it("lists newest first and filters by status", async () => {
    const t = makeContext();
    await seedProfiles(t);
    const oldNew = await makeRequest(t, "new", 1000);
    const handled = await makeRequest(t, "handled", 2000);
    const newest = await makeRequest(t, "new", 3000);
    const admin = t.withIdentity({ subject: "admin_1" });

    const all = await admin.query(api.admin.getTransportQuotes, {
      paginationOpts: paging,
    });
    expect(all.page.map((r) => r._id)).toEqual([newest, handled, oldNew]);
    expect(all.totalCount).toBe(3);

    const onlyNew = await admin.query(api.admin.getTransportQuotes, {
      paginationOpts: paging,
      status: "new",
    });
    expect(onlyNew.page.map((r) => r._id)).toEqual([newest, oldNew]);
    expect(onlyNew.totalCount).toBe(2);
  });
});

describe("admin.markTransportQuoteHandled", () => {
  it("refuses a non-admin", async () => {
    const t = makeContext();
    await seedProfiles(t);
    const id = await makeRequest(t, "new", 1000);
    await expect(
      t
        .withIdentity({ subject: "buyer_1" })
        .mutation(api.admin.markTransportQuoteHandled, { requestId: id })
    ).rejects.toThrow("Admin privileges required");
  });

  it("patches the request and writes one audit log, idempotently", async () => {
    const t = makeContext();
    await seedProfiles(t);
    const id = await makeRequest(t, "new", 1000);
    const admin = t.withIdentity({ subject: "admin_1" });

    await admin.mutation(api.admin.markTransportQuoteHandled, {
      requestId: id,
    });
    await admin.mutation(api.admin.markTransportQuoteHandled, {
      requestId: id,
    });

    const { row, logs } = await t.run(async (ctx) => ({
      row: await ctx.db.get("transportQuoteRequests", id),
      logs: await ctx.db.query("auditLogs").collect(),
    }));
    expect(row).toMatchObject({ status: "handled", handledBy: "admin_1" });
    expect(row?.handledAt).toEqual(expect.any(Number));
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      adminId: "admin_1",
      targetId: id,
      targetType: "transportQuote",
    });
  });

  it("throws for a missing request", async () => {
    const t = makeContext();
    await seedProfiles(t);
    const id = await makeRequest(t, "new", 1000);
    await t.run((ctx) => ctx.db.delete("transportQuoteRequests", id));
    await expect(
      t
        .withIdentity({ subject: "admin_1" })
        .mutation(api.admin.markTransportQuoteHandled, { requestId: id })
    ).rejects.toThrow("not found");
  });
});
