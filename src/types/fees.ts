import type { Doc, Id } from "../../convex/_generated/dataModel";

/** Method of fee calculation: "percentage" for percentage-based fees, "fixed" for flat fees */
export type FeeType = "percentage" | "fixed";
/** Which party bears the fee: "buyer", "seller", or "both" (split fees) */
export type FeeAppliesTo = "buyer" | "seller" | "both";

/**
 * Represents a platform-level fee configuration.
 * Used to define fees that can be applied to auctions at settlement time.
 * @property name - Display name of the fee
 * @property description - Optional description
 * @property feeType - Calculation method: "percentage" or "fixed"
 * @property value - Numeric value (percentage 0-1 or fixed amount in ZAR)
 * @property appliesTo - Which party bears the fee
 * @property isActive - Whether the fee is currently active
 * @property visibleToBuyer - Whether buyers can see the fee
 * @property visibleToSeller - Whether sellers can see the fee
 * @property sortOrder - Display order
 * @property createdAt - Creation timestamp
 * @property updatedAt - Last update timestamp
 */
export interface PlatformFee extends Doc<"platformFees"> {
  name: string;
  description?: string;
  feeType: FeeType;
  value: number;
  appliesTo: FeeAppliesTo;
  isActive: boolean;
  visibleToBuyer: boolean;
  visibleToSeller: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Represents a fee actually applied to a specific auction at settlement.
 * Distinct from PlatformFee which is the configuration template.
 * @property auctionId - The auction this fee applies to
 * @property feeId - Reference to the platform fee configuration
 * @property feeName - Snapshot of the fee name at calculation time
 * @property appliedTo - Which party pays this specific fee record
 * @property feeType - Calculation method used
 * @property rate - The numeric rate/fee value used
 * @property salePrice - The final sale price of the auction
 * @property calculatedAmount - The calculated fee amount
 * @property createdAt - When this fee was calculated
 * @remarks When a PlatformFee has appliesTo="both", two AuctionFee records are created (one for buyer, one for seller)
 */
export interface AuctionFee extends Doc<"auctionFees"> {
  auctionId: Id<"auctions">;
  feeId: Id<"platformFees">;
  feeName: string;
  appliedTo: "buyer" | "seller";
  feeType: FeeType;
  rate: number;
  salePrice: number;
  calculatedAmount: number;
  createdAt: number;
}

/**
 * Input type for creating a new platform fee.
 * @property name - Display name (required)
 * @property description - Optional description
 * @property feeType - Calculation method
 * @property value - Fee amount
 * @property appliesTo - Which party bears the fee
 * @property isActive - Initial active status
 * @property visibleToBuyer - Initial buyer visibility
 * @property visibleToSeller - Initial seller visibility
 * @remarks System-managed fields (sortOrder, createdAt, updatedAt) are computed automatically
 */
export interface CreateFeeInput {
  name: string;
  description?: string;
  feeType: FeeType;
  value: number;
  appliesTo: FeeAppliesTo;
  isActive: boolean;
  visibleToBuyer: boolean;
  visibleToSeller: boolean;
}

/**
 * Input type for updating an existing platform fee.
 * All fields are optional to support partial updates.
 * @property name - New display name
 * @property description - New description
 * @property feeType - New calculation method
 * @property value - New fee amount
 * @property appliesTo - New target party
 * @property isActive - New active status
 * @property visibleToBuyer - New buyer visibility
 * @property visibleToSeller - New seller visibility
 * @property sortOrder - New display order (unlike CreateFeeInput, this can be updated)
 */
export interface UpdateFeeInput {
  name?: string;
  description?: string;
  feeType?: FeeType;
  value?: number;
  appliesTo?: FeeAppliesTo;
  isActive?: boolean;
  visibleToBuyer?: boolean;
  visibleToSeller?: boolean;
  sortOrder?: number;
}

/**
 * Aggregated fee statistics for the platform.
 * @property totalFeesCollected - Sum of all fees (buyer + seller)
 * @property buyerFeesTotal - Sum of fees applied to buyers
 * @property sellerFeesTotal - Sum of fees applied to sellers
 * @property feeBreakdown - Per-fee aggregation showing feeName, totalAmount collected, and occurrence count
 */
export interface FeeStats {
  totalFeesCollected: number;
  buyerFeesTotal: number;
  sellerFeesTotal: number;
  feeBreakdown: Array<{
    feeName: string;
    totalAmount: number;
    count: number;
  }>;
}

/**
 * Transient preview of fee calculations shown before persisting.
 * Used for displaying estimated fees to users.
 * Differs from AuctionFee which is the persisted record.
 * @property feeName - Name of the fee
 * @property appliedTo - Which party this preview applies to
 * @property feeType - Calculation method
 * @property rate - The rate/amount being applied
 * @property salePrice - The sale price used in calculation
 * @property calculatedAmount - The resulting fee amount
 */
export interface FeePreview {
  feeName: string;
  appliedTo: "buyer" | "seller";
  feeType: FeeType;
  rate: number;
  salePrice: number;
  calculatedAmount: number;
}
