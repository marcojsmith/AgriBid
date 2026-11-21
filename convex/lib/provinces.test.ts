import { describe, expect, it } from "vitest";

import {
  PROVINCES,
  PROVINCE_LABELS,
  SELLER_RESPONSE_TIMES,
  SELLER_RESPONSE_TIME_LABELS,
  isProvince,
  provinceValidator,
  sellerResponseTimeValidator,
} from "./provinces";

describe("provinces", () => {
  it("lists the nine South African provinces with a label each", () => {
    expect(PROVINCES).toHaveLength(9);
    for (const province of PROVINCES) {
      expect(PROVINCE_LABELS[province]).toBeTruthy();
    }
    expect(Object.keys(PROVINCE_LABELS).sort()).toEqual([...PROVINCES].sort());
  });

  it("keeps the Convex validator in sync with the constant list", () => {
    const literals = (
      provinceValidator as unknown as { members: { value: string }[] }
    ).members.map((member) => member.value);
    expect(literals).toEqual([...PROVINCES]);
  });

  it("guards province values", () => {
    expect(isProvince("gauteng")).toBe(true);
    expect(isProvince("narnia")).toBe(false);
    expect(isProvince(undefined)).toBe(false);
  });
});

describe("seller response times", () => {
  it("has copy for every option and a matching validator", () => {
    expect(Object.keys(SELLER_RESPONSE_TIME_LABELS).sort()).toEqual(
      [...SELLER_RESPONSE_TIMES].sort()
    );
    const literals = (
      sellerResponseTimeValidator as unknown as {
        members: { value: string }[];
      }
    ).members.map((member) => member.value);
    expect(literals).toEqual([...SELLER_RESPONSE_TIMES]);
  });
});
