import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getCorsHeaders,
  addCorsHeaders,
  optionsHandler,
  authHandler,
  wellKnownHandler,
} from "./http";
import * as config from "./config";
import * as auth from "./auth";
import type { ActionCtx } from "./_generated/server";

vi.mock("./_generated/server", () => ({
  httpAction: vi.fn((h) => h),
}));

vi.mock("./config", () => ({
  isOriginAllowed: vi.fn(),
}));

vi.mock("./auth", () => ({
  createAuth: vi.fn(),
}));

describe("HTTP Coverage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getCorsHeaders", () => {
    it("should return basic headers if origin not allowed", () => {
      vi.mocked(config.isOriginAllowed).mockReturnValue(false);
      const request = new Request("https://test.com", {
        headers: { Origin: "https://malicious.com" },
      });
      const headers = getCorsHeaders(request);
      expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
      expect(headers["Vary"]).toBe("Origin");
    });

    it("should include Allow-Origin if origin is allowed", () => {
      vi.mocked(config.isOriginAllowed).mockReturnValue(true);
      const origin = "https://allowed.com";
      const request = new Request("https://test.com", {
        headers: { Origin: origin },
      });
      const headers = getCorsHeaders(request);
      expect(headers["Access-Control-Allow-Origin"]).toBe(origin);
    });
  });

  describe("addCorsHeaders", () => {
    it("should merge CORS headers into response", () => {
      vi.mocked(config.isOriginAllowed).mockReturnValue(true);
      const origin = "https://allowed.com";
      const request = new Request("https://test.com", {
        headers: { Origin: origin },
      });
      const response = new Response("ok", {
        headers: { "X-Test": "val" },
      });

      const newResponse = addCorsHeaders(response, request);
      expect(newResponse.headers.get("Access-Control-Allow-Origin")).toBe(
        origin
      );
      expect(newResponse.headers.get("X-Test")).toBe("val");
    });
  });

  describe("optionsHandler", () => {
    it("should return 204 with CORS headers", async () => {
      vi.mocked(config.isOriginAllowed).mockReturnValue(true);
      const origin = "https://allowed.com";
      const request = new Request("https://test.com", {
        method: "OPTIONS",
        headers: { Origin: origin },
      });

      const response = await (
        optionsHandler as unknown as (...args: unknown[]) => Promise<Response>
      )({} as unknown as ActionCtx, request);
      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    });
  });

  describe("authHandler", () => {
    it("should forward to better-auth and add CORS", async () => {
      const mockAuth = {
        handler: vi.fn().mockResolvedValue(new Response("auth-ok")),
      };
      vi.mocked(auth.createAuth).mockReturnValue(
        mockAuth as unknown as ReturnType<typeof auth.createAuth>
      );
      vi.mocked(config.isOriginAllowed).mockReturnValue(true);

      const request = new Request("https://test.com/api/auth/signin", {
        headers: { Origin: "https://allowed.com" },
      });

      const response = await (
        authHandler as unknown as (...args: unknown[]) => Promise<Response>
      )({} as unknown as ActionCtx, request);
      expect(mockAuth.handler).toHaveBeenCalledWith(request);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://allowed.com"
      );
    });
  });

  describe("wellKnownHandler", () => {
    it("should rewrite openid-configuration path", async () => {
      const mockAuth = {
        handler: vi.fn().mockResolvedValue(new Response("ok")),
      };
      vi.mocked(auth.createAuth).mockReturnValue(
        mockAuth as unknown as ReturnType<typeof auth.createAuth>
      );

      const request = new Request(
        "https://test.com/.well-known/openid-configuration"
      );
      await (
        wellKnownHandler as unknown as (...args: unknown[]) => Promise<Response>
      )({} as unknown as ActionCtx, request);

      const rewrittenRequest = mockAuth.handler.mock.calls[0][0];
      expect(rewrittenRequest.url).toContain(
        "/api/auth/convex/.well-known/openid-configuration"
      );
    });

    it("should rewrite jwks path", async () => {
      const mockAuth = {
        handler: vi.fn().mockResolvedValue(new Response("ok")),
      };
      vi.mocked(auth.createAuth).mockReturnValue(
        mockAuth as unknown as ReturnType<typeof auth.createAuth>
      );

      const request = new Request("https://test.com/.well-known/jwks");
      await (
        wellKnownHandler as unknown as (...args: unknown[]) => Promise<Response>
      )({} as unknown as ActionCtx, request);

      const rewrittenRequest = mockAuth.handler.mock.calls[0][0];
      expect(rewrittenRequest.url).toContain("/api/auth/convex/jwks");
    });

    it("should handle non-GET requests with body", async () => {
      const mockAuth = {
        handler: vi.fn().mockResolvedValue(new Response("ok")),
      };
      vi.mocked(auth.createAuth).mockReturnValue(
        mockAuth as unknown as ReturnType<typeof auth.createAuth>
      );

      const body = JSON.stringify({ test: true });
      const request = new Request("https://test.com/.well-known/test", {
        method: "POST",
        body,
      });
      await (
        wellKnownHandler as unknown as (...args: unknown[]) => Promise<Response>
      )({} as unknown as ActionCtx, request);

      const rewrittenRequest = mockAuth.handler.mock.calls[0][0];
      expect(rewrittenRequest.method).toBe("POST");
      const rewrittenBody = await rewrittenRequest.text();
      expect(rewrittenBody).toBe(body);
    });
  });
});
