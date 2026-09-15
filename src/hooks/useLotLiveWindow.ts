import { useEffect, useState } from "react";

import { useAuctionStarted } from "./useAuctionStarted";

/**
 * The lifecycle phase of a lot from a bidder's perspective.
 *
 * - `unavailable`: not yet assigned to an auction (draft/under review/approved).
 * - `upcoming`: assigned to a published auction whose start time is in the future.
 * - `live`: assigned to a published auction currently inside its bidding window.
 * - `ended`: settled, rejected, or the parent auction's window has closed.
 */
export type LotLivePhase = "unavailable" | "upcoming" | "live" | "ended";

/**
 * The minimum lot fields required to derive its live/biddable window.
 *
 * The canonical window lives on the parent auction and is surfaced on the lot by
 * the query layer as `auctionStartTime`/`auctionEndTime`/`auctionStatus`, with
 * `extendedEndTime` carrying any per-lot soft-close extension.
 */
export interface LotLiveWindowInput {
  /** Lot status (`draft`/`pending_review`/`approved`/`assigned`/`sold`/`unsold`/`rejected`). */
  status: string;
  /** Parent auction status, if the lot is assigned to one. */
  auctionStatus?: "draft" | "published" | "closed";
  /** Parent auction's scheduled start timestamp (ms). */
  auctionStartTime?: number;
  /** Parent auction's scheduled end timestamp (ms). */
  auctionEndTime?: number;
  /** Per-lot soft-close extension; effective end when present. */
  extendedEndTime?: number;
}

/**
 * Derived live window state for a lot.
 */
export interface LotLiveWindow {
  /** Current lifecycle phase. */
  phase: LotLivePhase;
  /** True only while the lot is live and biddable. */
  isLive: boolean;
  /** True when the lot is assigned to a published auction that hasn't started. */
  isUpcoming: boolean;
  /** True when the lot is settled, rejected, or its auction window has closed. */
  isEnded: boolean;
  /** True when the lot has not yet been assigned to a published auction. */
  isUnavailable: boolean;
  /** Effective start timestamp (ms), if known. */
  effectiveStartTime?: number;
  /** Effective end timestamp (ms): `extendedEndTime ?? auctionEndTime`, if known. */
  effectiveEndTime?: number;
}

function deriveLotLiveWindow(
  lot: LotLiveWindowInput,
  hasStarted: boolean,
  hasEnded: boolean,
  effectiveEndTime: number | undefined
): LotLiveWindow {
  const isTerminal =
    lot.status === "sold" || lot.status === "unsold" || lot.status === "rejected";
  const isScheduled =
    lot.status === "assigned" && lot.auctionStatus === "published";

  let phase: LotLivePhase;
  if (isTerminal) {
    phase = "ended";
  } else if (!isScheduled) {
    // An `assigned` lot without a published parent window is a data anomaly;
    // fail safe to "ended" rather than showing it as biddable.
    phase = lot.status === "assigned" ? "ended" : "unavailable";
  } else if (!hasStarted) {
    phase = "upcoming";
  } else if (hasEnded) {
    phase = "ended";
  } else {
    phase = "live";
  }

  return {
    phase,
    isLive: phase === "live",
    isUpcoming: phase === "upcoming",
    isEnded: phase === "ended",
    isUnavailable: phase === "unavailable",
    effectiveStartTime: lot.auctionStartTime,
    effectiveEndTime,
  };
}

/**
 * Pure, timer-free derivation of a lot's live window at a given instant.
 *
 * Use this for one-off "is it live right now?" checks (e.g. guarding a bid
 * submission) and `useLotLiveWindow` for reactive rendering that transitions
 * automatically as time passes.
 *
 * @param lot - The lot to evaluate
 * @param now - The reference timestamp in milliseconds
 * @returns The lot's live window state at `now`
 */
export function getLotLiveWindow(
  lot: LotLiveWindowInput,
  now: number
): LotLiveWindow {
  const effectiveEndTime = lot.extendedEndTime ?? lot.auctionEndTime;
  const hasStarted =
    lot.auctionStartTime === undefined || lot.auctionStartTime <= now;
  const hasEnded =
    effectiveEndTime === undefined || effectiveEndTime <= now;

  return deriveLotLiveWindow(lot, hasStarted, hasEnded, effectiveEndTime);
}

/**
 * Reactive hook tracking a lot's live/biddable window.
 *
 * Composes `useAuctionStarted` for the not-started → started transition and
 * schedules a timeout for the effective end, so a lot moves through
 * `upcoming` → `live` → `ended` in the UI without a manual refresh.
 *
 * @param lot - The lot to track
 * @returns The lot's live window state, kept up to date as boundaries pass
 */
export function useLotLiveWindow(lot: LotLiveWindowInput): LotLiveWindow {
  const hasStarted = useAuctionStarted(lot.auctionStartTime);
  const effectiveEndTime = lot.extendedEndTime ?? lot.auctionEndTime;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (effectiveEndTime === undefined) return;

    const msUntilEnd = effectiveEndTime - Date.now();
    if (msUntilEnd <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reflecting an already-passed end boundary is the point of this hook
      setNow(Date.now());
      return;
    }

    const timer = setTimeout(() => {
      setNow(Date.now());
    }, msUntilEnd + 25);
    return () => {
      clearTimeout(timer);
    };
  }, [effectiveEndTime]);

  const hasEnded =
    effectiveEndTime === undefined || now >= effectiveEndTime;

  return deriveLotLiveWindow(lot, hasStarted, hasEnded, effectiveEndTime);
}
