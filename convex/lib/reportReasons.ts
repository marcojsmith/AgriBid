import { v } from "convex/values";

/** Reasons a buyer can pick when reporting a seller or profile. */
export const profileReportReasonValidator = v.union(
  v.literal("misleading_listing"),
  v.literal("suspected_fraud"),
  v.literal("offensive_content"),
  v.literal("other")
);

/** Reasons a buyer can pick when reporting a seller or profile. */
export type ProfileReportReason =
  "misleading_listing" | "suspected_fraud" | "offensive_content" | "other";

/**
 * Every reason a stored `profileFlags` row can carry: the current ones plus the
 * retired ones that old rows still hold.
 */
export const profileFlagReasonValidator = v.union(
  profileReportReasonValidator,
  // Legacy reasons: no longer offered, kept so existing rows stay valid.
  v.literal("fake_account"),
  v.literal("fraudulent_listings"),
  v.literal("abusive_behaviour"),
  v.literal("identity_misrepresentation")
);
