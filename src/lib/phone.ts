/**
 * South African phone normalisation shared with the Convex backend.
 * The single source of truth lives in `convex/lib/phone.ts`; this module only
 * re-exports it for frontend imports.
 */
export { normalizeSaPhone } from "../../convex/lib/phone";
