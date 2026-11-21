/**
 * Province and seller response-time constants shared with the Convex backend.
 * The single source of truth lives in `convex/lib/provinces.ts`; this module
 * only re-exports it for frontend imports.
 */
export {
  PROVINCES,
  PROVINCE_LABELS,
  isProvince,
  SELLER_RESPONSE_TIMES,
  SELLER_RESPONSE_TIME_LABELS,
  type Province,
  type SellerResponseTime,
} from "../../convex/lib/provinces";
