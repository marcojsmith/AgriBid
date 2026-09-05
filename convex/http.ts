import { httpRouter } from "convex/server";

import { isOriginAllowed } from "./config";

const http = httpRouter();

/**
 * Builds CORS response headers for a request, allowing the origin if it passes
 * the configured allowlist.
 * @param request - The incoming HTTP request.
 * @returns CORS header map to apply to a response.
 */
export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  const isAllowed = isOriginAllowed(origin);

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, Cookie, X-Requested-With",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };

  if (isAllowed) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

/**
 * Wraps a response with CORS headers derived from the incoming request.
 * @param response - The response to add CORS headers to.
 * @param request - The incoming HTTP request used to derive the headers.
 * @returns A new response with CORS headers applied.
 */
export function addCorsHeaders(response: Response, request: Request): Response {
  const corsHeaders = getCorsHeaders(request);
  const newHeaders = new Headers(response.headers);

  for (const [key, value] of Object.entries(corsHeaders)) {
    newHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export default http;
