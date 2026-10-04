import { describe, it, expect } from "vitest";
import type { Id } from "convex/_generated/dataModel";

import {
  formatLastUpdated,
  validateEditedMake,
  validateModelName,
  validateNewMake,
} from "./metadataHelpers";

const categoryId = "cat1" as Id<"equipmentCategories">;

describe("validateNewMake", () => {
  it("requires a name, a category and an initial model", () => {
    expect(
      validateNewMake({ make: "", categoryId: "", initialModel: "" })
    ).toBe("All fields are required");
    expect(
      validateNewMake({ make: "Fendt", categoryId: "", initialModel: "1050" })
    ).toBe("All fields are required");
    expect(
      validateNewMake({
        make: "Fendt",
        categoryId,
        initialModel: "",
      })
    ).toBe("All fields are required");
  });

  it("accepts a complete form", () => {
    expect(
      validateNewMake({ make: "Fendt", categoryId, initialModel: "1050" })
    ).toBeNull();
  });
});

describe("validateEditedMake", () => {
  it("requires a non-blank name", () => {
    expect(validateEditedMake({ make: "   ", categoryId })).toBe(
      "Manufacturer name is required"
    );
  });

  it("requires a category", () => {
    expect(validateEditedMake({ make: "Fendt", categoryId: "" })).toBe(
      "Category is required"
    );
  });

  it("accepts a complete form", () => {
    expect(validateEditedMake({ make: " Fendt ", categoryId })).toBeNull();
  });
});

describe("validateModelName", () => {
  it("rejects blank names", () => {
    expect(validateModelName("")).toBe("Model name is required");
    expect(validateModelName("   ")).toBe("Model name is required");
  });

  it("accepts a trimmed name", () => {
    expect(validateModelName("8R 410")).toBeNull();
  });
});

describe("formatLastUpdated", () => {
  it("falls back to 'Never' when the make was never updated", () => {
    expect(formatLastUpdated(undefined)).toBe("Never");
  });

  it("formats a timestamp as a locale date", () => {
    const timestamp = Date.UTC(2024, 4, 17);
    expect(formatLastUpdated(timestamp)).toBe(
      new Date(timestamp).toLocaleDateString()
    );
  });
});
