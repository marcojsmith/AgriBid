import { describe, it, expect } from "vitest";
import type { Id } from "convex/_generated/dataModel";

import {
  formatFeeValue,
  sortFeesBySortOrder,
  toFeeMutationArgs,
  validateFeeForm,
} from "./feeHelpers";
import {
  defaultFeeFormData,
  type FeeFormData,
  type PlatformFee,
} from "./types";

/**
 * Builds a platform fee document for tests.
 *
 * @param overrides - Fields to override on the default fee.
 * @returns A complete fee document.
 */
const makeFee = (overrides: Partial<PlatformFee> = {}): PlatformFee => ({
  _id: "fee1" as Id<"platformFees">,
  _creationTime: 0,
  name: "Seller Commission",
  feeType: "percentage",
  value: 0.05,
  appliesTo: "seller",
  isActive: true,
  visibleToBuyer: false,
  visibleToSeller: true,
  sortOrder: 0,
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

/**
 * Builds fee form values for tests.
 *
 * @param overrides - Fields to override on the default form data.
 * @returns Complete form data.
 */
const makeFormData = (overrides: Partial<FeeFormData> = {}): FeeFormData => ({
  ...defaultFeeFormData,
  ...overrides,
});

describe("sortFeesBySortOrder", () => {
  it("orders fees by ascending sortOrder", () => {
    const fees = [
      makeFee({ _id: "c" as Id<"platformFees">, sortOrder: 2 }),
      makeFee({ _id: "a" as Id<"platformFees">, sortOrder: 0 }),
      makeFee({ _id: "b" as Id<"platformFees">, sortOrder: 1 }),
    ];

    expect(sortFeesBySortOrder(fees).map((fee) => fee.sortOrder)).toEqual([
      0, 1, 2,
    ]);
  });

  it("does not mutate the input array", () => {
    const fees = [makeFee({ sortOrder: 1 }), makeFee({ sortOrder: 0 })];

    sortFeesBySortOrder(fees);

    expect(fees[0]?.sortOrder).toBe(1);
  });
});

describe("formatFeeValue", () => {
  it("renders percentages without trailing zeros", () => {
    expect(formatFeeValue(makeFee({ value: 0.05 }))).toBe("5%");
    expect(formatFeeValue(makeFee({ value: 0.01 }))).toBe("1%");
    expect(formatFeeValue(makeFee({ value: 1 }))).toBe("100%");
    expect(formatFeeValue(makeFee({ value: 0.125 }))).toBe("12.5%");
    expect(formatFeeValue(makeFee({ value: 0.1234 }))).toBe("12.34%");
  });

  it("renders fixed fees as currency", () => {
    expect(formatFeeValue(makeFee({ feeType: "fixed", value: 500 }))).toBe(
      "R 500,00"
    );
    expect(formatFeeValue(makeFee({ feeType: "fixed", value: 1250000 }))).toBe(
      "R 1 250 000,00"
    );
  });
});

describe("validateFeeForm", () => {
  it("requires a name", () => {
    expect(validateFeeForm(makeFormData({ name: "   " }))).toBe(
      "Fee name is required"
    );
  });

  it("bounds percentage values", () => {
    expect(validateFeeForm(makeFormData({ name: "Fee", value: 0 }))).toBe(
      "Percentage must be between 0.01% and 100%"
    );
    expect(validateFeeForm(makeFormData({ name: "Fee", value: 101 }))).toBe(
      "Percentage must be between 0.01% and 100%"
    );
    expect(
      validateFeeForm(makeFormData({ name: "Fee", value: 0.01 }))
    ).toBeNull();
    expect(
      validateFeeForm(makeFormData({ name: "Fee", value: 100 }))
    ).toBeNull();
  });

  it("requires positive fixed values", () => {
    expect(
      validateFeeForm(makeFormData({ name: "Fee", feeType: "fixed", value: 0 }))
    ).toBe("Fixed fee must be greater than 0");
    expect(
      validateFeeForm(
        makeFormData({ name: "Fee", feeType: "fixed", value: -1 })
      )
    ).toBe("Fixed fee must be greater than 0");
    expect(
      validateFeeForm(makeFormData({ name: "Fee", feeType: "fixed", value: 1 }))
    ).toBeNull();
  });
});

describe("toFeeMutationArgs", () => {
  it("converts percentages to fractions and drops empty descriptions", () => {
    const args = toFeeMutationArgs(
      makeFormData({ name: "Fee", description: "", value: 5 })
    );

    expect(args).toEqual({
      name: "Fee",
      description: undefined,
      feeType: "percentage",
      value: 0.05,
      appliesTo: "seller",
      isActive: true,
      visibleToBuyer: true,
      visibleToSeller: true,
    });
  });

  it("leaves fixed values unscaled and keeps a description", () => {
    const args = toFeeMutationArgs(
      makeFormData({
        name: "Fee",
        description: "Storage",
        feeType: "fixed",
        value: 250,
        isActive: false,
      })
    );

    expect(args.value).toBe(250);
    expect(args.description).toBe("Storage");
    expect(args.isActive).toBe(false);
  });
});
