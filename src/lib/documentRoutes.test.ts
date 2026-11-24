import { afterEach, describe, expect, it, vi } from "vitest";

import { documentFileUrl, getConvexSiteUrl } from "./documentRoutes";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getConvexSiteUrl", () => {
  it("uses VITE_CONVEX_SITE_URL, without a trailing slash", () => {
    vi.stubEnv(
      "VITE_CONVEX_SITE_URL",
      "https://agribid-convex.duckdns.org:8443/"
    );
    expect(getConvexSiteUrl()).toBe("https://agribid-convex.duckdns.org:8443");
  });

  it("derives the .convex.site origin from a Convex Cloud URL", () => {
    vi.stubEnv("VITE_CONVEX_SITE_URL", "");
    vi.stubEnv("VITE_CONVEX_URL", "https://happy-otter-1.convex.cloud");
    expect(getConvexSiteUrl()).toBe("https://happy-otter-1.convex.site");
  });

  it("throws when nothing is configured", () => {
    vi.stubEnv("VITE_CONVEX_SITE_URL", "");
    vi.stubEnv("VITE_CONVEX_URL", "http://127.0.0.1:3210");
    expect(() => getConvexSiteUrl()).toThrow(/VITE_CONVEX_SITE_URL/);
  });
});

describe("documentFileUrl", () => {
  it("builds registration and legacy URLs, encoding the values", () => {
    vi.stubEnv("VITE_CONVEX_SITE_URL", "https://site.test");
    expect(documentFileUrl({ kind: "registration", id: "a b&c" })).toBe(
      "https://site.test/documents/file?id=a+b%26c"
    );
    expect(
      documentFileUrl({ kind: "legacy", userId: "user_1", index: 3 })
    ).toBe("https://site.test/documents/file?legacyUser=user_1&index=3");
  });
});
