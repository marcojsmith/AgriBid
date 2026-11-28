import { usePaginatedQuery } from "convex/react";
import { api } from "convex/_generated/api";

import type { CreditedLot } from "@/lib/account";

/** The lot a deposit was credited to, with what is left to pay on it. */
export interface DepositCredit {
  lot: CreditedLot;
  /** Rand still to pay on that lot after the credit. */
  amountDue: number;
}

/**
 * Finds the lot the received deposit was credited to. The registration data
 * does not name it, so this reads the newest won-lot payments and takes the
 * one with a deposit credit. Skipped unless the deposit is received.
 *
 * @param received - Whether the deposit is in the `received` state
 * @returns The credit, or null when none was used (or it is not in the newest ten)
 */
export function useDepositCredit(received: boolean): DepositCredit | null {
  const won = usePaginatedQuery(
    api.lotPayments.getMyWonLots,
    received ? {} : "skip",
    { initialNumItems: 10 }
  );
  const row = won.results.find((item) => item.depositCredit > 0);
  return row
    ? {
        lot: { title: row.title, lotNumber: row.lotNumber },
        amountDue: row.amountDue,
      }
    : null;
}
