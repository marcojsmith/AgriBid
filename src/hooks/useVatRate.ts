import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";

/**
 * Reads the platform VAT rate an admin configured (default 15%).
 *
 * Convex shares one subscription per query, so calling this from several
 * components costs a single read.
 *
 * @returns The VAT rate as a percentage, or `undefined` while it loads
 */
export function useVatRate(): number | undefined {
  return useQuery(api.admin.getVatRate)?.vatRatePct;
}
