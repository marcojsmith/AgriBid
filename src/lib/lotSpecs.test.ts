import { describe, expect, it } from "vitest";

import {
  buildSpecArgs,
  getLotSpecsError,
  parseDrive,
  parseOptionalNumber,
  parsePhotoAngle,
  parseSellerType,
  pickImageAngles,
} from "./lotSpecs";

describe("lotSpecs helpers", () => {
  it("parses select values and rejects unknown ones", () => {
    expect(parseDrive("4wd")).toBe("4wd");
    expect(parseDrive("")).toBeUndefined();
    expect(parseSellerType("dealer")).toBe("dealer");
    expect(parseSellerType("nope")).toBeUndefined();
    expect(parsePhotoAngle("hour_meter")).toBe("hour_meter");
    expect(parsePhotoAngle("")).toBeUndefined();
  });

  it("parses optional numbers", () => {
    expect(parseOptionalNumber("")).toBeUndefined();
    expect(parseOptionalNumber("  ")).toBeUndefined();
    expect(parseOptionalNumber("12.5")).toBe(12.5);
  });

  describe("getLotSpecsError", () => {
    it("accepts empty and in-range specs", () => {
      expect(getLotSpecsError({})).toBeNull();
      expect(
        getLotSpecsError({
          powerKw: 2000,
          frontTyrePct: 0,
          rearTyrePct: 100,
          transmission: "x".repeat(100),
          serialNumber: "SN1",
        })
      ).toBeNull();
    });

    it("rejects out-of-range numbers", () => {
      expect(getLotSpecsError({ powerKw: 2001 })).toBe(
        "Power must be between 0 and 2000 kW"
      );
      expect(getLotSpecsError({ powerKw: -1 })).toContain("Power");
      expect(getLotSpecsError({ powerKw: Number.NaN })).toContain("Power");
      expect(getLotSpecsError({ frontTyrePct: 101 })).toBe(
        "Front tyre must be between 0 and 100%"
      );
      expect(getLotSpecsError({ rearTyrePct: 101 })).toBe(
        "Rear tyre must be between 0 and 100%"
      );
    });

    it("rejects over-long text", () => {
      expect(getLotSpecsError({ transmission: "x".repeat(101) })).toBe(
        "Transmission must be at most 100 characters"
      );
      expect(getLotSpecsError({ serialNumber: "x".repeat(101) })).toBe(
        "Serial number must be at most 100 characters"
      );
    });
  });

  describe("buildSpecArgs", () => {
    it("drops blank values and trims text", () => {
      expect(
        buildSpecArgs({
          transmission: "  ",
          serialNumber: "",
          powerKw: undefined,
        })
      ).toEqual({});
    });

    it("keeps provided values including zero", () => {
      expect(
        buildSpecArgs({
          powerKw: 0,
          drive: "tracks",
          transmission: " Powershift ",
          frontTyrePct: 50,
          rearTyrePct: 60,
          serialNumber: " SN9 ",
        })
      ).toEqual({
        powerKw: 0,
        drive: "tracks",
        transmission: "Powershift",
        frontTyrePct: 50,
        rearTyrePct: 60,
        serialNumber: "SN9",
      });
    });
  });

  describe("pickImageAngles", () => {
    it("returns undefined without angles or matches", () => {
      expect(pickImageAngles(undefined, ["a"])).toBeUndefined();
      expect(pickImageAngles({ gone: "front" }, ["a"])).toBeUndefined();
    });

    it("keeps only angles whose image is still present", () => {
      expect(pickImageAngles({ a: "front", gone: "rear" }, ["a", "b"])).toEqual(
        { a: "front" }
      );
    });
  });
});
