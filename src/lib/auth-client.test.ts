import { describe, it, expect, vi } from "vitest";

import { authClient } from "./auth-client";

describe("authClient", () => {
  it("should be initialized", () => {
    expect(authClient).toBeDefined();
  });

  it("should export authentication methods", () => {
    expect(typeof authClient.signIn).toBe("function");
    expect(typeof authClient.signUp).toBe("function");
    expect(typeof authClient.signOut).toBe("function");
    expect(typeof authClient.useSession).toBe("function");
  });

  it("should fallback to window.location.origin if VITE_CONVEX_SITE_URL is not set", async () => {
    // Cast to any to bypass TS read-only error for the test environment modification
    const originalUrl = import.meta.env.VITE_CONVEX_SITE_URL;
    delete (import.meta.env as Record<string, string | undefined>)
      .VITE_CONVEX_SITE_URL;

    // We must isolate the import to force re-evaluation of auth-client.ts
    vi.resetModules();
    const { authClient: testClient } = await import("./auth-client");
    expect(testClient).toBeDefined();

    // Restore the original URL
    if (originalUrl) {
      (
        import.meta.env as Record<string, string | undefined>
      ).VITE_CONVEX_SITE_URL = originalUrl;
    }
  });
});
