// app/convex/auth.ts
import { v } from "convex/values";
import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import type { GenericCtx } from "@convex-dev/better-auth";

import { components } from "./_generated/api";
import { query } from "./_generated/server";
import type { DataModel } from "./_generated/dataModel";
import { ALLOWED_ORIGINS, isOriginAllowed } from "./config";

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.auth);

/**
 * Creates the auth instance with the provided context and options.
 *
 * @param ctx - The generic context for the data model.
 * @param options - Configuration options for auth creation.
 * @param options.optionsOnly - Whether to only include options in the logger.
 * @param options.origin - The origin of the request.
 * @returns The Better Auth instance.
 */
export const createAuth = (
  ctx: GenericCtx<DataModel>,
  options: { optionsOnly?: boolean; origin?: string } = {}
) => {
  const { optionsOnly = false, origin } = options;
  const trustedOrigins = [...ALLOWED_ORIGINS];
  if (origin && isOriginAllowed(origin)) {
    trustedOrigins.push(origin);
  }

  const siteUrl = process.env.CONVEX_SITE_URL;

  if (!siteUrl) {
    throw new Error("Missing CONVEX_SITE_URL environment variable.");
  }

  return betterAuth({
    appName: "AgriBid",
    logger: {
      disabled: optionsOnly,
    },
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
      convex({
        authConfig: {
          providers: [
            {
              applicationID: "convex",
              domain: siteUrl,
            },
          ],
        },
      }),
    ],
  });
};

export type AuthUser = {
  userId?: string | null;
  _id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  _creationTime?: number;
};

export const getAuthUser = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      userId: v.optional(v.union(v.string(), v.null())),
      _id: v.string(),
      email: v.optional(v.union(v.string(), v.null())),
      name: v.optional(v.union(v.string(), v.null())),
      image: v.optional(v.union(v.string(), v.null())),
      _creationTime: v.optional(v.number()),
    })
  ),
  handler: async (ctx) => {
    try {
      return await authComponent.getAuthUser(ctx);
    } catch (err) {
      if (!(err instanceof Error && err.message.includes("Unauthenticated"))) {
        console.error("authComponent.getAuthUser failure:", err);
      }
      return null;
    }
  },
});
