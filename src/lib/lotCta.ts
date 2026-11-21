import { formatRand } from "@/lib/currency";

/** Where a lot is in its life, from a bidder's point of view. */
export type LotCtaPhase = "upcoming" | "live" | "ended" | "unavailable";

/** The inputs that decide which call to action a lot shows. */
export interface LotCtaInput {
  /** The lot's phase (see `useLotLiveWindow`). */
  phase: LotCtaPhase;
  /** Whether someone is signed in. */
  signedIn: boolean;
  /**
   * Whether the signed-in user is verified to bid (`profile.isVerified`).
   * `undefined` while the profile loads: the user is then not asked to verify.
   */
  isVerified?: boolean;
  /** The next bid in rand, shown on the live button ("Bid R 217 500"). */
  nextBid: number;
}

/**
 * What the call to action does:
 * - `register`: signed out, goes to sign-in.
 * - `verify`: signed in but not verified, goes to `/kyc`.
 * - `set-max`: verified, bidding not open yet, opens the lot to set a maximum bid.
 * - `bid`: bidding is open, places the next bid (signed out goes to sign-in first).
 * - `result`: bidding ended, opens the lot to see the result.
 * - `view`: any other state, opens the lot.
 */
export type LotCtaKind =
  "register" | "verify" | "set-max" | "bid" | "result" | "view";

/** The resolved call to action. */
export interface LotCta {
  kind: LotCtaKind;
  /** Button text; never a grey "Not started". */
  label: string;
}

/**
 * Picks the one call to action a lot shows, so every card (and later the lot
 * page) agrees. It mirrors the bid rules already in `BiddingPanel`: bidding
 * needs a signed-in, verified user.
 *
 * - Ended: "View result", whoever is looking.
 * - Not open to bidding (draft, under review): "View lot".
 * - Signed out: "Register to bid" before the start, "Bid R x" once live
 *   (the click sends them to sign in).
 * - Signed in but not verified: "Verify to bid".
 * - Verified: "Set max bid" before the start, "Bid R x" once live.
 *
 * @param input - Phase, session, verification and the next bid
 * @returns The call to action kind and label
 */
export function getLotCta(input: LotCtaInput): LotCta {
  const { phase, signedIn, isVerified, nextBid } = input;
  if (phase === "ended") return { kind: "result", label: "View result" };
  if (phase === "unavailable") return { kind: "view", label: "View lot" };

  if (!signedIn) {
    return phase === "live"
      ? { kind: "bid", label: `Bid ${formatRand(nextBid)}` }
      : { kind: "register", label: "Register to bid" };
  }
  if (isVerified === false) return { kind: "verify", label: "Verify to bid" };
  return phase === "live"
    ? { kind: "bid", label: `Bid ${formatRand(nextBid)}` }
    : { kind: "set-max", label: "Set max bid" };
}
