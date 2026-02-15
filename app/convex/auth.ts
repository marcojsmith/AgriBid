// app/convex/auth.ts
import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import { components } from "./_generated/api";
import { query } from "./_generated/server";
import type { GenericCtx } from "@convex-dev/better-auth";
import type { DataModel } from "./_generated/dataModel";
import { ALLOWED_ORIGINS } from "./config";

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.auth);

export const createAuth = (
  ctx: GenericCtx<DataModel>,
  { optionsOnly } = { optionsOnly: false },
) => {
  const trustedOrigins = ALLOWED_ORIGINS;
  const siteUrl = process.env.CONVEX_SITE_URL;

  if (!siteUrl) {
    throw new Error("Missing CONVEX_SITE_URL environment variable.");
  }

  return betterAuth({
    appName: "AgriBid",
    // disable logging when createAuth is called just to generate options.
    logger: {
      disabled: optionsOnly,
    },
    // The site URL is needed for redirects and cookies
    baseURL: siteUrl,
    basePath: "/api/auth",
    trustedOrigins,
    advanced: {
      useSecureCookies: true,
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
      },
    },
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [
      // The Convex plugin is required for Convex compatibility
      convex({ 
        authConfig: { 
          providers: [{ 
            applicationID: "convex", 
            domain: siteUrl
          }] 
        } 
      }),
    ],
  });
};

export const getAuthUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx);
  },
});
