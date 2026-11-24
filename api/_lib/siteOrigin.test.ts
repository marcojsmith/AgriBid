// @vitest-environment node
import { describe, expect, it } from "vitest";

import { siteOrigin } from "./siteOrigin";

describe("siteOrigin", () => {
  it("prefers SITE_URL and trims trailing slashes", () => {
    expect(
      siteOrigin({
        SITE_URL: "https://example.com/",
        VERCEL_ENV: "production",
        VERCEL_PROJECT_PRODUCTION_URL: "prod.vercel.app",
        VERCEL_URL: "deploy.vercel.app",
      })
    ).toBe("https://example.com");
  });

  it("uses the production domain on production", () => {
    expect(
      siteOrigin({
        VERCEL_ENV: "production",
        VERCEL_PROJECT_PRODUCTION_URL: "prod.vercel.app",
        VERCEL_URL: "deploy.vercel.app",
      })
    ).toBe("https://prod.vercel.app");
  });

  it("uses the deployment URL on previews", () => {
    expect(
      siteOrigin({
        VERCEL_ENV: "preview",
        VERCEL_PROJECT_PRODUCTION_URL: "prod.vercel.app",
        VERCEL_URL: "deploy.vercel.app",
      })
    ).toBe("https://deploy.vercel.app");
  });

  it("falls back to localhost", () => {
    expect(siteOrigin({})).toBe("http://localhost:5173");
  });
});
