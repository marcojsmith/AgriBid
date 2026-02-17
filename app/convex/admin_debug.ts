import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { components } from "./_generated/api";
import { getCallerRole } from "./users";

export const promoteToAdmin = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const callerRole = await getCallerRole(ctx);

    if (process.env.NODE_ENV !== "development" && callerRole !== "admin") {
      throw new Error("Unauthorized: Only admins can promote users");
    }

    const user = await ctx.runQuery(components.auth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", operator: "eq", value: args.email }]
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

    if (!profile) {
      // Provision profile if it doesn't exist yet
      const now = Date.now();
      await ctx.db.insert("profiles", {
        userId: linkId,
        role: "admin",
        isVerified: true,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(profile._id, {
        role: "admin",
        isVerified: true,
        updatedAt: Date.now(),
      });
    }

    return { success: true, userId: linkId };
  },
});
