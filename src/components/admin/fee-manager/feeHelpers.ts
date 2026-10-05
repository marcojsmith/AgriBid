import { formatCurrency } from "@/lib/currency";

import type { FeeFormData, FeeMutationArgs, PlatformFee } from "./types";

/**
 * Sorts fees by their stored sort order without mutating the input.
 *
 * @param fees - Fee rules in the order Convex returned them.
 * @returns A new array ordered by ascending `sortOrder`.
 */
export function sortFeesBySortOrder(
  fees: readonly PlatformFee[]
): PlatformFee[] {
  return [...fees].sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Renders a fee value for the table: percentages as `5%`, fixed fees as
 * formatted currency.
 *
 * @param fee - The fee rule to render.
 * @returns The display string for the fee's value.
 */
export function formatFeeValue(fee: PlatformFee): string {
  if (fee.feeType === "percentage") {
    return `${(fee.value * 100).toFixed(2).replace(/\.?0+$/, "")}%`;
  }
  return formatCurrency(fee.value);
}

/**
 * Validates the fee form before it is sent to the backend.
 *
 * @param formData - Current form values.
 * @returns An error message, or `null` when the form is valid.
 */
export function validateFeeForm(formData: FeeFormData): string | null {
  if (!formData.name.trim()) {
    return "Fee name is required";
  }

  if (formData.feeType === "percentage") {
    if (formData.value < 0.01 || formData.value > 100) {
      return "Percentage must be between 0.01% and 100%";
    }
  } else if (formData.value <= 0) {
    return "Fixed fee must be greater than 0";
  }

  return null;
}

/**
 * Converts form values into the mutation payload, converting a percentage from
 * the form's percent scale to the stored fraction (5% becomes 0.05) and
 * dropping an empty description so the field is cleared.
 *
 * @param formData - Current form values.
 * @returns The payload shared by the create and update mutations.
 */
export function toFeeMutationArgs(formData: FeeFormData): FeeMutationArgs {
  return {
    name: formData.name,
    description: formData.description || undefined,
    feeType: formData.feeType,
    value:
      formData.feeType === "percentage" ? formData.value / 100 : formData.value,
    appliesTo: formData.appliesTo,
    isActive: formData.isActive,
    visibleToBuyer: formData.visibleToBuyer,
    visibleToSeller: formData.visibleToSeller,
  };
}
