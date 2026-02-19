import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { components } from "./_generated/api";
import { getCallerRole } from "./users";
import { logAudit } from "./admin_utils";

// Dev-only feature: allows bypassing admin check for initial setup.
// Must be disabled in production (NODE_ENV=production).
const isProduction = process.env.NODE_ENV === "production";
const allowDevPromotionFlag = process.env.ALLOW_DEV_ADMIN_PROMOTION === "true";

if (isProduction && allowDevPromotionFlag) {
  throw new Error(
    "Security configuration error: ALLOW_DEV_ADMIN_PROMOTION must not be enabled in production"
  );
}

export const promoteToAdmin = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const callerRole = await getCallerRole(ctx);
    const allowDevPromotion = !isProduction && allowDevPromotionFlag;

    if (!allowDevPromotion && callerRole !== "admin") {
      throw new Error("Unauthorized: Only admins can promote users");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.email)) {
      throw new Error("Invalid email format");
    }

    const user = await ctx.runQuery(components.auth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", operator: "eq", value: args.email }],
    });

    if (!user) {
      throw new Error("User not found");
    }

    const linkId = user.userId ?? user._id;
    if (!linkId) {
      throw new Error("User identity not fully established (missing ID)");
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", linkId))
      .unique();

    const previousRole = profile?.role;
    let targetId: string;

    if (!profile) {
      // Provision profile if it doesn't exist yet
      const now = Date.now();
      const newProfileId = await ctx.db.insert("profiles", {
        userId: linkId,
        role: "admin",
        isVerified: true,
        createdAt: now,
        updatedAt: now,
      });
      targetId = newProfileId;
    } else {
      await ctx.db.patch(profile._id, {
        role: "admin",
        isVerified: true,
        updatedAt: Date.now(),
      });
      targetId = profile._id;
    }

    await logAudit(ctx, {
      action: "promote_to_admin",
      targetId: targetId,
      targetType: "user_profile",
      details: JSON.stringify({
        previousRole,
        newRole: "admin",
        userId: linkId,
        // Redact email for PII safety in audit logs
        email: args.email.replace(/^(.{1,2})[^@]*(@.*)$/, "$1***$2"),
      }),
    });

    return { success: true, userId: linkId };
  },
});
