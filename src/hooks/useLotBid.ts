import { useCallback, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";

import {
  getLotLiveWindow,
  type LotLiveWindowInput,
} from "@/hooks/useLotLiveWindow";
import { formatRand } from "@/lib/currency";
import { classifyBidError, type BidError } from "@/lib/lotPage";
import { getErrorMessage } from "@/lib/utils";

/** What the bid flow reads from the lot. */
interface UseLotBidInput {
  lotId: Id<"lots"> | undefined;
  /** The smallest bid the server accepts right now. */
  minimum: number;
  /** The lot's window, checked again against the clock at confirm time. */
  window: LotLiveWindowInput | null;
}

/** The bid flow's state and actions. */
export interface LotBidFlow {
  /** The amount in the bid field: what the user typed, else the minimum. */
  amount: number;
  setAmount: (amount: number) => void;
  /** Whether the confirm sheet is open. */
  confirmOpen: boolean;
  /** Opens the confirm sheet for the field's amount (or `amount` when given). */
  startBid: (amount?: number) => void;
  /** Closes the confirm sheet and clears its error. */
  closeConfirm: () => void;
  /** Sends the bid. */
  confirm: () => Promise<void>;
  /** Re-prices the bid at a new minimum and clears the error. */
  reviseBid: (amount: number) => void;
  busy: boolean;
  error: BidError | null;
}

/**
 * The lot page's bid flow: the amount (the minimum until the user types or
 * taps a quick amount), the confirm sheet that every bid goes through, and
 * the server call. A failed bid keeps the sheet open with a plain-words
 * reason (someone bid before you, below the minimum, bidding closed, not
 * verified). The server stays authoritative: nothing here relaxes its checks.
 * There is no maximum (proxy) bid: `placeBid` is called without `maxBid`.
 *
 * @param input - The lot, its minimum and an open check
 * @param input.lotId - The lot
 * @param input.minimum - The current minimum bid
 * @param input.window - The lot's live window inputs
 * @returns The state and actions
 */
export function useLotBid({
  lotId,
  minimum,
  window,
}: UseLotBidInput): LotBidFlow {
  const placeBid = useMutation(api.auctions.mutations.bidding.placeBid);
  const [typed, setTyped] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<BidError | null>(null);
  // The minimum the user saw when they opened the sheet. A bid that is then
  // rejected because the minimum moved means someone bid in the meantime.
  const [shownMinimum, setShownMinimum] = useState(minimum);

  const amount = typed ?? minimum;
  const inFlight = useRef(false);

  const closeConfirm = useCallback(() => {
    // Cancel returns the field to the live minimum.
    setTyped(null);
    setConfirmOpen(false);
    setError(null);
  }, []);

  const startBid = useCallback(
    (next?: number) => {
      // Freeze the amount being confirmed: it must not drift with the live
      // minimum while the sheet is open.
      setTyped(next ?? typed ?? minimum);
      setShownMinimum(minimum);
      setError(null);
      setConfirmOpen(true);
    },
    [minimum, typed]
  );

  const reviseBid = useCallback((next: number) => {
    setTyped(next);
    setShownMinimum(next);
    setError(null);
  }, []);

  const confirm = useCallback(async () => {
    if (!lotId || !window || !getLotLiveWindow(window, Date.now()).isLive) {
      setError({ kind: "closed", message: "Bidding on this lot has closed." });
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await placeBid({ lotId, amount });
      toast.success(`Bid of ${formatRand(amount)} placed`);
      setConfirmOpen(false);
      setTyped(null);
    } catch (caught) {
      setError(
        classifyBidError(
          getErrorMessage(caught, "Couldn't place your bid."),
          amount,
          shownMinimum
        )
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [amount, window, lotId, shownMinimum, placeBid]);

  return {
    amount,
    setAmount: setTyped,
    confirmOpen,
    startBid,
    closeConfirm,
    confirm,
    reviseBid,
    busy,
    error,
  };
}
