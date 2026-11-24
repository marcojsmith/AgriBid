import { describe, expect, it } from "vitest";

import {
  phoneToField,
  switchPhoneMode,
  toE164,
  toSaveArgs,
  validateDetails,
  type DetailsValues,
} from "./registrationForm";

const SA: DetailsValues = {
  idType: "sa_id",
  fullName: "Thandi Naidoo",
  phone: "82 555 0147",
  idNumber: "8001 0150 0908 7",
  passportNumber: "",
  countryOfIssue: "",
  streetAddress: "14 Kerk Street",
  town: "Malmesbury",
  postalCode: "7300",
};

const PASSPORT: DetailsValues = {
  ...SA,
  idType: "passport",
  fullName: "Anna Schmidt",
  phone: "+264 81 555 0147",
  idNumber: "",
  passportNumber: "n0123456",
  countryOfIssue: "Namibia",
};

describe("toE164", () => {
  it("builds a +27 number from the nine national digits", () => {
    expect(toE164("sa_id", "82 555 0147")).toBe("+27825550147");
    expect(toE164("sa_id", "082 555 0147")).toBe("+27825550147");
    expect(toE164("sa_id", "+27 82 555 0147")).toBe("+27825550147");
  });

  it("rejects a short or non-SA number in SA mode", () => {
    expect(toE164("sa_id", "82 555")).toBeNull();
    expect(toE164("sa_id", "")).toBeNull();
  });

  it("takes the full number in passport mode", () => {
    expect(toE164("passport", "+264 81 555 0147")).toBe("+264815550147");
    expect(toE164("passport", "081 555 0147")).toBeNull();
    expect(toE164("passport", "+12")).toBeNull();
  });
});

describe("phone field helpers", () => {
  it("shows the digits after +27 for an SA ID", () => {
    expect(phoneToField("sa_id", "+27825550147")).toBe("825550147");
    expect(phoneToField("sa_id", "+264815550147")).toBe("+264815550147");
    expect(phoneToField("passport", "+264815550147")).toBe("+264815550147");
    expect(phoneToField("sa_id", undefined)).toBe("");
  });

  it("keeps what was typed when switching ID type", () => {
    expect(switchPhoneMode("passport", "82 555 0147")).toBe("+27825550147");
    expect(switchPhoneMode("passport", "082 555 0147")).toBe("+27825550147");
    expect(switchPhoneMode("passport", "+264 81 555 0147")).toBe(
      "+264815550147"
    );
    expect(switchPhoneMode("sa_id", "+27825550147")).toBe("825550147");
    expect(switchPhoneMode("sa_id", "+264815550147")).toBe("+264815550147");
    expect(switchPhoneMode("passport", "  ")).toBe("");
    // 27... typed in SA mode must not become +2727...
    expect(switchPhoneMode("passport", "27825550147")).toBe("+27825550147");
  });
});

describe("validateDetails", () => {
  it("passes valid SA ID and passport forms", () => {
    expect(validateDetails(SA)).toEqual({});
    expect(validateDetails(PASSPORT)).toEqual({});
  });

  it("flags every empty field", () => {
    const errors = validateDetails({
      ...SA,
      fullName: " ",
      phone: "",
      idNumber: "",
      streetAddress: "",
      town: "",
      postalCode: "",
    });
    expect(Object.keys(errors).sort()).toEqual([
      "fullName",
      "idNumber",
      "phone",
      "postalCode",
      "streetAddress",
      "town",
    ]);
  });

  it("flags a bad SA ID number", () => {
    expect(validateDetails({ ...SA, idNumber: "1234567890123" }).idNumber).toBe(
      "Enter a valid 13-digit ID number."
    );
  });

  it("flags a bad passport number and a missing country", () => {
    const errors = validateDetails({
      ...PASSPORT,
      passportNumber: "!",
      countryOfIssue: " ",
    });
    expect(errors.passportNumber).toBe("Enter a valid passport number.");
    expect(errors.countryOfIssue).toBe("Enter the country of issue.");
  });

  it("flags a bad postal code", () => {
    expect(validateDetails({ ...SA, postalCode: "7!" }).postalCode).toBe(
      "Enter a valid postal code."
    );
  });

  it("explains the phone format per ID type", () => {
    expect(validateDetails({ ...SA, phone: "12" }).phone).toBe(
      "Enter a valid mobile number."
    );
    expect(validateDetails({ ...PASSPORT, phone: "12" }).phone).toContain(
      "country code"
    );
  });
});

describe("toSaveArgs", () => {
  it("builds the SA ID arguments", () => {
    expect(toSaveArgs(SA)).toEqual({
      idType: "sa_id",
      fullName: "Thandi Naidoo",
      phoneNumber: "+27825550147",
      idNumber: "8001015009087",
      streetAddress: "14 Kerk Street",
      town: "Malmesbury",
      postalCode: "7300",
    });
  });

  it("builds the passport arguments, uppercasing the number", () => {
    expect(toSaveArgs(PASSPORT)).toEqual({
      idType: "passport",
      fullName: "Anna Schmidt",
      phoneNumber: "+264815550147",
      passportNumber: "N0123456",
      countryOfIssue: "Namibia",
      streetAddress: "14 Kerk Street",
      town: "Malmesbury",
      postalCode: "7300",
    });
  });

  it("throws on an invalid phone number", () => {
    expect(() => toSaveArgs({ ...SA, phone: "1" })).toThrow(
      "Invalid phone number"
    );
  });
});
