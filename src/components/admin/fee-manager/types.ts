import type { Doc } from "convex/_generated/dataModel";

/**
 * A platform fee rule as returned by `api.admin.getPlatformFees`.
 */
export type PlatformFee = Doc<"platformFees">;

/**
 * State of the create/edit fee form.
 */
export interface FeeFormData {
  name: string;
  description: string;
  feeType: "percentage" | "fixed";
  value: number;
  appliesTo: "buyer" | "seller" | "both";
  isActive: boolean;
  visibleToBuyer: boolean;
  visibleToSeller: boolean;
}

/**
 * Fields shared by the create and update platform fee mutations. Percentage
 * values are stored as fractions (0.05 = 5%) while the form works in percent.
 */
export type FeeMutationArgs = Omit<FeeFormData, "description"> & {
  description?: string;
};

/**
 * Values a freshly opened "create fee" dialog starts with.
 */
export const defaultFeeFormData: FeeFormData = {
  name: "",
  description: "",
  feeType: "percentage",
  value: 0,
  appliesTo: "seller",
  isActive: true,
  visibleToBuyer: true,
  visibleToSeller: true,
};
