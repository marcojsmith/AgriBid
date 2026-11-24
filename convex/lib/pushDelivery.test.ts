import { describe, expect, it, vi } from "vitest";

import { deliverAll } from "./pushDelivery";

const message = (endpoint: string) => ({
  endpoint,
  p256dh: "p",
  auth: "a",
  payload: "{}",
});

describe("deliverAll", () => {
  it("counts successful sends as delivered", async () => {
    const send = vi.fn().mockResolvedValue({ statusCode: 201 });
    expect(await deliverAll([message("https://a/1")], send)).toEqual({
      delivered: 1,
      expired: [],
    });
    expect(send).toHaveBeenCalledWith(
      { endpoint: "https://a/1", keys: { p256dh: "p", auth: "a" } },
      "{}"
    );
  });

  it("reports 404 and 410 endpoints as expired", async () => {
    const send = vi.fn((sub: { endpoint: string }) => {
      if (sub.endpoint.endsWith("/gone")) {
        return Promise.reject(
          Object.assign(new Error("gone"), { statusCode: 410 })
        );
      }
      if (sub.endpoint.endsWith("/missing")) {
        return Promise.reject(
          Object.assign(new Error("nf"), { statusCode: 404 })
        );
      }
      return Promise.resolve({ statusCode: 201 });
    });
    const result = await deliverAll(
      [
        message("https://a/ok"),
        message("https://a/gone"),
        message("https://a/missing"),
      ],
      send
    );
    expect(result.delivered).toBe(1);
    expect(result.expired.sort()).toEqual([
      "https://a/gone",
      "https://a/missing",
    ]);
  });

  it("does not expire endpoints on other failures", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("boom"), { statusCode: 500 })
      )
      .mockRejectedValueOnce(new Error("network"));
    expect(
      await deliverAll([message("https://a/1"), message("https://a/2")], send)
    ).toEqual({ delivered: 0, expired: [] });
  });
});
