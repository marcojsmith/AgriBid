/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";

import { internal } from "./_generated/api";
import schema from "./schema";

const mocks = vi.hoisted(() => ({
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: mocks.setVapidDetails,
    sendNotification: mocks.sendNotification,
  },
}));

const modules = import.meta.glob("./**/*.*s");

const GOOD = "https://fcm.googleapis.com/fcm/send/good";
const GONE = "https://fcm.googleapis.com/fcm/send/gone";
const message = (endpoint: string) => ({
  endpoint,
  p256dh: "p",
  auth: "a",
  payload: "{}",
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sendNotification.mockResolvedValue({ statusCode: 201 });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** Sets all three VAPID env vars. */
function stubVapid() {
  vi.stubEnv("VAPID_PUBLIC_KEY", "pub");
  vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
  vi.stubEnv("VAPID_SUBJECT", "https://agribid.example");
}

describe("sendPushBatch", () => {
  it("returns zeros and warns when VAPID is not configured", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubEnv("VAPID_PUBLIC_KEY", "pub");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    vi.stubEnv("VAPID_SUBJECT", "https://agribid.example");
    const t = convexTest(schema, modules);
    const result = await t.action(internal.pushNode.sendPushBatch, {
      messages: [message(GOOD)],
    });
    expect(result).toEqual({ delivered: 0, removed: 0, skipped: 0 });
    expect(mocks.sendNotification).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it("sends, and deletes endpoints the push service reports gone", async () => {
    stubVapid();
    mocks.sendNotification.mockImplementation((target: { endpoint: string }) =>
      target.endpoint === GONE
        ? Promise.reject(Object.assign(new Error("gone"), { statusCode: 410 }))
        : Promise.resolve({ statusCode: 201 })
    );
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      for (const endpoint of [GOOD, GONE]) {
        await ctx.db.insert("pushSubscriptions", {
          userId: "user_a",
          endpoint,
          p256dh: "p",
          auth: "a",
          createdAt: Date.now(),
        });
      }
    });
    const result = await t.action(internal.pushNode.sendPushBatch, {
      messages: [message(GOOD), message(GONE)],
    });
    expect(result).toEqual({ delivered: 1, removed: 1, skipped: 0 });
    expect(mocks.setVapidDetails).toHaveBeenCalledWith(
      "https://agribid.example",
      "pub",
      "priv"
    );
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      { endpoint: GOOD, keys: { p256dh: "p", auth: "a" } },
      "{}",
      expect.objectContaining({ TTL: 3600, urgency: "high", timeout: 10_000 })
    );
    const rows = await t.run((ctx) =>
      ctx.db.query("pushSubscriptions").collect()
    );
    expect(rows.map((r) => r.endpoint)).toEqual([GOOD]);
  });

  it("skips endpoints outside the push services without calling them", async () => {
    stubVapid();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const t = convexTest(schema, modules);
    const result = await t.action(internal.pushNode.sendPushBatch, {
      messages: [
        message("https://localhost/x"),
        message("https://192.168.1.5/x"),
        message(GOOD),
      ],
    });
    expect(result).toEqual({ delivered: 1, removed: 0, skipped: 2 });
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
  });
});
