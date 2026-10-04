import { v } from "convex/values";

import { mutation } from "./_generated/server";
import { getCallerRole } from "./lib/auth";
import { logAudit } from "./admin_utils";

/**
 * Check if the production safeguard is violated.
 * This function is called at module load time to fail fast if the env vars are misconfigured.
 */
function validateProductionConfig(): void {
  const isProduction = process.env.NODE_ENV === "production";
  const allowDevPromotionFlag = process.env.ALLOW_DEV_ADMIN_PROMOTION === "true";

  if (isProduction && allowDevPromotionFlag) {
    throw new Error(
      "Security configuration error: ALLOW_DEV_ADMIN_PROMOTION must not be enabled in production"
    );
  }
}

validateProductionConfig();

export const promoteToAdmin = mutation({
  args: { email: v.string() },
  returns: v.object({ success: v.boolean(), userId: v.string() }),
  handler: async (ctx, args) => {
    const callerRole = await getCallerRole(ctx);

    const isProduction = process.env.NODE_ENV === "production";
    const allowDevPromotionFlag = process.env.ALLOW_DEV_ADMIN_PROMOTION === "true";
    const allowDevPromotion = !isProduction && allowDevPromotionFlag;

    if (!allowDevPromotion && callerRole !== "admin") {
      throw new Error("Unauthorized: Only admins can promote users");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.email)) {
      throw new Error("Invalid email format");
    }

    const profile = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("email"), args.email))
      .unique();

    if (!profile) {
      throw new Error("User not found");
    }

    const linkId = profile.userId;
    const previousRole = profile.role;

    await ctx.db.patch("profiles", profile._id, {
      role: "admin",
      isVerified: true,
      updatedAt: Date.now(),
    });
    const targetId = profile._id;

    await logAudit(ctx, {
      action: "promote_to_admin",
      targetId: targetId,
      targetType: "user_profile",
      details: JSON.stringify({
        previousRole,
        newRole: "admin",
        userId: linkId,
        email: args.email.replace(/^(.{1,2})[^@]*(@.*)$/, "$1***$2"),
      }),
    });

    return { success: true, userId: linkId };
  },
});
