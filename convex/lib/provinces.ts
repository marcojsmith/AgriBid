import { v } from "convex/values";

/** The nine South African provinces, as stored on `lots.province`. */
export const PROVINCES = [
  "eastern_cape",
  "free_state",
  "gauteng",
  "kwazulu_natal",
  "limpopo",
  "mpumalanga",
  "northern_cape",
  "north_west",
  "western_cape",
] as const;

/** A South African province key. */
export type Province = (typeof PROVINCES)[number];

/** Human-readable labels for each province key. */
export const PROVINCE_LABELS: Record<Province, string> = {
  eastern_cape: "Eastern Cape",
  free_state: "Free State",
  gauteng: "Gauteng",
  kwazulu_natal: "KwaZulu-Natal",
  limpopo: "Limpopo",
  mpumalanga: "Mpumalanga",
  northern_cape: "Northern Cape",
  north_west: "North West",
  western_cape: "Western Cape",
};

/** Convex validator accepting exactly the nine province keys. */
export const provinceValidator = v.union(
  v.literal("eastern_cape"),
  v.literal("free_state"),
  v.literal("gauteng"),
  v.literal("kwazulu_natal"),
  v.literal("limpopo"),
  v.literal("mpumalanga"),
  v.literal("northern_cape"),
  v.literal("north_west"),
  v.literal("western_cape")
);

/**
 * Type guard for a province key.
 * @param value - Any value.
 * @returns True when the value is one of {@link PROVINCES}.
 */
export function isProvince(value: unknown): value is Province {
  return (
    typeof value === "string" &&
    (PROVINCES as readonly string[]).includes(value)
  );
}

/** How quickly a seller usually replies to buyer messages (admin-set). */
export const SELLER_RESPONSE_TIMES = [
  "within_hours",
  "within_day",
  "within_2_days",
  "slower",
] as const;

/** A seller response-time key. */
export type SellerResponseTime = (typeof SELLER_RESPONSE_TIMES)[number];

/** Public copy for each response-time key. */
export const SELLER_RESPONSE_TIME_LABELS: Record<SellerResponseTime, string> = {
  within_hours: "Usually replies within a few hours",
  within_day: "Usually replies within a day",
  within_2_days: "Usually replies within 2 days",
  slower: "May take a few days to reply",
};

/** Convex validator accepting exactly the response-time keys. */
export const sellerResponseTimeValidator = v.union(
  v.literal("within_hours"),
  v.literal("within_day"),
  v.literal("within_2_days"),
  v.literal("slower")
);
