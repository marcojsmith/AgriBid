// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.hoisted(() => vi.fn());

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = query;
  },
}));

import { GET } from "../share";

const WHATSAPP = "WhatsApp/2.23.20.0 A";
const LOT_ID = "k57abcdefghijklmnopqrstuv";

/**
 * Builds a request to the share function.
 *
 * @param search - Query string
 * @param ua - User agent
 * @returns The request
 */
function req(search: string, ua: string): Request {
  return new Request(`https://agribid.test/api/share?${search}`, {
    headers: { "user-agent": ua },
  });
}

beforeEach(() => {
  query.mockReset();
  process.env.VITE_CONVEX_URL = "https://convex.test";
  process.env.SITE_URL = "https://agribid.test";
});

describe("GET /api/share", () => {
  it("returns the lot tags for a crawler", async () => {
    query.mockResolvedValue({
      make: "New Holland",
      model: "T6070",
      title: "T6070",
      lotNumber: 3,
      status: "assigned",
      startingPrice: 400000,
      currentPrice: 414000,
      bidCount: 2,
      place: "Malmesbury, Western Cape",
      auctionStartTime: 0,
      closeTime: Date.now() + 86_400_000,
    });
    const res = await GET(
      req(`kind=lot&id=${LOT_ID}&path=/auction/${LOT_ID}`, WHATSAPP)
    );
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=0, s-maxage=300, stale-while-revalidate=3600"
    );
    expect(html).toContain("New Holland T6070 · Lot 3 · AgriBid");
    expect(html).toContain(`https://agribid.test/auction/${LOT_ID}`);
  });

  it("returns the sale tags", async () => {
    query.mockResolvedValue({
      title: "Year End Auction",
      status: "published",
      startTime: 0,
      effectiveEndTime: Date.now() + 86_400_000,
      lotCount: 5,
      imageUrls: [],
    });
    const res = await GET(
      req(`kind=sale&id=${LOT_ID}&path=/auctions/${LOT_ID}`, WHATSAPP)
    );
    expect(await res.text()).toContain("<title>Year End Auction</title>");
  });

  it("returns the home tags", async () => {
    query.mockResolvedValue(null);
    const res = await GET(req("kind=home&path=/", WHATSAPP));
    expect(await res.text()).toContain(
      "Online farm equipment auctions in South Africa"
    );
  });

  it("falls back to the home tags with 200 when Convex throws", async () => {
    query.mockRejectedValue(new Error("boom"));
    const res = await GET(
      req(`kind=lot&id=${LOT_ID}&path=/auction/${LOT_ID}`, WHATSAPP)
    );
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain("AgriBid · Farm equipment auctions");
    expect(res.headers.get("cache-control")).toContain("s-maxage=300");
  });

  it("falls back for a malformed id without calling Convex", async () => {
    const res = await GET(req("kind=lot&id=../etc&path=/auction/x", WHATSAPP));
    expect(res.status).toBe(200);
    expect(query).not.toHaveBeenCalled();
  });

  it("falls back when Convex is not configured", async () => {
    delete process.env.VITE_CONVEX_URL;
    const res = await GET(req("kind=home&path=/", WHATSAPP));
    expect(res.status).toBe(200);
  });

  it("redirects browsers to the page", async () => {
    const res = await GET(
      req(`kind=lot&id=${LOT_ID}&path=/auction/${LOT_ID}`, "Mozilla/5.0 Safari")
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`/auction/${LOT_ID}`);
    expect(query).not.toHaveBeenCalled();
  });

  it("rejects paths with control characters", async () => {
    const res = await GET(req("kind=home&path=/%09/evil.com", "Mozilla/5.0"));
    expect(res.headers.get("location")).toBe("/");
  });

  it("never redirects off-site", async () => {
    const res = await GET(req("kind=home&path=//evil.com", "Mozilla/5.0"));
    expect(res.headers.get("location")).toBe("/");
  });

  it("falls back after the call times out", async () => {
    vi.useFakeTimers();
    query.mockReturnValue(new Promise(() => undefined));
    const pending = GET(req("kind=home&path=/", WHATSAPP));
    await vi.advanceTimersByTimeAsync(3100);
    const res = await pending;
    vi.useRealTimers();
    expect(res.status).toBe(200);
  });
});
