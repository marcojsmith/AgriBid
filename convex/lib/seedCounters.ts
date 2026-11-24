import { getCounter, updateCounter } from "../admin_utils";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getLotCounterKey } from "../lots/mutations/helpers";
import { bidCounterName } from "./lotCounters";

/**
 * Recalculates the dashboard counters (lots, bids, per-lot bid counters,
 * profiles, support, audit logs and lot fees) from the tables, so seeding,
 * the demo import and `seed:weeklyReset` all leave them consistent.
 *
 * Per-lot bid counters are only raised to the number of valid bid rows, never
 * lowered, because imported closed lots keep the source's real bid count while
 * holding at most one bid row.
 *
 * @param ctx - Mutation context.
 */
export async function recalculateCounters(ctx: MutationCtx): Promise<void> {
  // Mirrors convex/lots/mutations/helpers.ts's getLotCounterKey mapping exactly.
  // Lots
  const allLots = await ctx.db.query("lots").collect();
  await updateCounter(ctx, "lots", "total", allLots.length, true);
  await updateCounter(
    ctx,
    "lots",
    "active",
    allLots.filter((l) => getLotCounterKey(l.status) === "active").length,
    true
  );
  await updateCounter(
    ctx,
    "lots",
    "pending",
    allLots.filter((l) => getLotCounterKey(l.status) === "pending").length,
    true
  );
  await updateCounter(
    ctx,
    "lots",
    "draft",
    allLots.filter((l) => getLotCounterKey(l.status) === "draft").length,
    true
  );

  // Bids
  const allBids = await ctx.db.query("bids").collect();
  await updateCounter(ctx, "bids", "total", allBids.length, true);
  // Per-lot valid-bid counters feed the engagement ranking.
  const validBidsByLot = new Map<Id<"lots">, number>();
  for (const bid of allBids) {
    if (bid.status === "voided") continue;
    validBidsByLot.set(bid.lotId, (validBidsByLot.get(bid.lotId) ?? 0) + 1);
  }
  for (const [lotId, count] of validBidsByLot) {
    const existing = await getCounter(ctx, bidCounterName(lotId));
    if ((existing?.total ?? 0) < count) {
      await updateCounter(ctx, bidCounterName(lotId), "total", count, true);
    }
  }

  const soldLots = allLots.filter((l) => l.status === "sold");
  const salesVolume = soldLots.reduce(
    (sum, l) => sum + (l.currentPrice || 0),
    0
  );

  await updateCounter(ctx, "lots", "salesVolume", salesVolume, true);
  await updateCounter(ctx, "lots", "soldCount", soldLots.length, true);

  // Profiles
  const allProfiles = await ctx.db.query("profiles").collect();
  await updateCounter(ctx, "profiles", "total", allProfiles.length, true);
  await updateCounter(
    ctx,
    "profiles",
    "verified",
    allProfiles.filter((p) => p.isVerified).length,
    true
  );
  await updateCounter(
    ctx,
    "profiles",
    "pending",
    allProfiles.filter((p) => p.kycStatus === "pending").length,
    true
  );

  // Support
  const allTickets = await ctx.db.query("supportTickets").collect();
  await updateCounter(ctx, "support", "total", allTickets.length, true);
  await updateCounter(
    ctx,
    "support",
    "open",
    allTickets.filter((t) => t.status === "open").length,
    true
  );
  await updateCounter(
    ctx,
    "support",
    "resolved",
    allTickets.filter((t) => t.status === "resolved").length,
    true
  );

  // Audit Logs
  const allAuditLogs = await ctx.db.query("auditLogs").collect();
  await updateCounter(ctx, "auditLogs", "total", allAuditLogs.length, true);

  // Lot Fees
  const allLotFees = await ctx.db.query("lotFees").collect();
  const buyerFeesTotal = allLotFees
    .filter((f) => f.appliedTo === "buyer")
    .reduce((sum, f) => sum + f.calculatedAmount, 0);
  const sellerFeesTotal = allLotFees
    .filter((f) => f.appliedTo === "seller")
    .reduce((sum, f) => sum + f.calculatedAmount, 0);
  await updateCounter(ctx, "lotFees", "buyerTotal", buyerFeesTotal, true);
  await updateCounter(ctx, "lotFees", "sellerTotal", sellerFeesTotal, true);
}
