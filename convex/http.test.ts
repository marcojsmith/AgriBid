import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./config", () => ({
  isOriginAllowed: vi.fn(),
}));

import { isOriginAllowed } from "./config";
import { getCorsHeaders, addCorsHeaders } from "./http";

const mockIsOriginAllowed = vi.mocked(isOriginAllowed);

describe("getCorsHeaders", () => {
  beforeEach(() => {
    mockIsOriginAllowed.mockReset();
  });

  it("includes Access-Control-Allow-Origin when the origin is allowed", () => {
    mockIsOriginAllowed.mockReturnValue(true);
    const request = new Request("https://example.com", {
      headers: { Origin: "https://allowed.example.com" },
    });

    const headers = getCorsHeaders(request);

    expect(mockIsOriginAllowed).toHaveBeenCalledWith(
      "https://allowed.example.com"
    );
    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "https://allowed.example.com"
    );
    expect(headers["Access-Control-Allow-Methods"]).toBe(
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    expect(headers["Access-Control-Allow-Headers"]).toBe(
      "Content-Type, Authorization, Cookie, X-Requested-With"
    );
    expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
    expect(headers.Vary).toBe("Origin");
  });

  it("omits Access-Control-Allow-Origin when the origin is disallowed", () => {
    mockIsOriginAllowed.mockReturnValue(false);
    const request = new Request("https://example.com", {
      headers: { Origin: "https://evil.example.com" },
    });

    const headers = getCorsHeaders(request);

    expect(mockIsOriginAllowed).toHaveBeenCalledWith(
      "https://evil.example.com"
    );
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("checks the empty string when the Origin header is missing", () => {
    mockIsOriginAllowed.mockReturnValue(false);
    const request = new Request("https://example.com");

    getCorsHeaders(request);

    expect(mockIsOriginAllowed).toHaveBeenCalledWith("");
  });
});

describe("addCorsHeaders", () => {
  beforeEach(() => {
    mockIsOriginAllowed.mockReset();
  });

  it("merges CORS headers onto the response while preserving status and body", async () => {
    mockIsOriginAllowed.mockReturnValue(true);
    const request = new Request("https://example.com", {
      headers: { Origin: "https://allowed.example.com" },
    });
    const response = new Response("hello", {
      status: 201,
      statusText: "Created",
      headers: { "X-Custom": "value" },
    });

    const result = addCorsHeaders(response, request);

    expect(result.status).toBe(201);
    expect(result.statusText).toBe("Created");
    expect(await result.text()).toBe("hello");
    expect(result.headers.get("X-Custom")).toBe("value");
    expect(result.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://allowed.example.com"
    );
  });

  it("overrides any existing Access-Control-Allow-Origin with the computed value", () => {
    mockIsOriginAllowed.mockReturnValue(true);
    const request = new Request("https://example.com", {
      headers: { Origin: "https://allowed.example.com" },
    });
    const response = new Response(null, {
      headers: { "Access-Control-Allow-Origin": "https://stale.example.com" },
    });

    const result = addCorsHeaders(response, request);

    expect(result.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://allowed.example.com"
    );
  });
});
