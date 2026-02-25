// app/convex/http.ts
import { httpRouter } from "convex/server";
import { createAuth } from "./auth";
import { httpAction } from "./_generated/server";
import { isOriginAllowed } from "./config";

const http = httpRouter();

// ---------------------------------------------------------------------------
// CORS Configuration
/**
 * Builds CORS response headers using the request's Origin and the configured allowlist.
 *
 * @param request - The incoming HTTP Request; the `Origin` header is inspected to determine whether to include `Access-Control-Allow-Origin`.
 * @returns A record of CORS header names to values. If the request origin is allowed, includes `Access-Control-Allow-Origin` set to that origin; always includes standard CORS headers for methods, headers, credentials and `Vary`.
 */

function getCorsHeaders(request: Request): Record<string, string> {
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

function addCorsHeaders(response: Response, request: Request): Response {
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

// ---------------------------------------------------------------------------
// Preflight handler (OPTIONS) — covers every /api/auth/* route
// ---------------------------------------------------------------------------

http.route({
  pathPrefix: "/api/auth/",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    return new Response(null, {
      status: 204,
      headers: new Headers(getCorsHeaders(request)),
    });
  }),
});

// ---------------------------------------------------------------------------
// Auth handler wrapper — forwards to Better Auth, then injects CORS headers
// ---------------------------------------------------------------------------

const authHandler = httpAction(async (ctx, request) => {
  const origin = request.headers.get("Origin") ?? "";
  const auth = createAuth(ctx, { origin });
  const response = await auth.handler(request);
  return addCorsHeaders(response, request);
});

// ---------------------------------------------------------------------------
// Well-known handler — rewrites /.well-known/* to /api/auth/.well-known/*
// ---------------------------------------------------------------------------

const wellKnownHandler = httpAction(async (ctx, request) => {
  const origin = request.headers.get("Origin") ?? "";
  const auth = createAuth(ctx, { origin });
  const url = new URL(request.url);

  // Rewrite standard OIDC discovery path to the plugin's internal path
  if (url.pathname.endsWith("/openid-configuration")) {
    url.pathname = "/api/auth/convex/.well-known/openid-configuration";
  } else if (url.pathname.endsWith("/jwks")) {
    url.pathname = "/api/auth/convex/jwks";
  }

  const init: RequestInit = {
    method: request.method,
    headers: request.headers,
    // @ts-expect-error - duplex is required in some runtimes but not in standard RequestInit
    duplex: "half",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  const rewrittenRequest = new Request(url.toString(), init as RequestInit);

  const response = await auth.handler(rewrittenRequest);
  return addCorsHeaders(response, request);
});

// Register GET and POST for the auth prefix
http.route({
  pathPrefix: "/api/auth/",
  method: "GET",
  handler: authHandler,
});

http.route({
  pathPrefix: "/api/auth/",
  method: "POST",
  handler: authHandler,
});

// Explicitly register the convex plugin sub-path
http.route({
  pathPrefix: "/api/auth/convex/",
  method: "GET",
  handler: authHandler,
});

// Register GET for .well-known OpenID discovery
http.route({
  pathPrefix: "/.well-known/",
  method: "GET",
  handler: wellKnownHandler,
});

export default http;
