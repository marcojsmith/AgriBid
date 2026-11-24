import { describe, expect, it } from "vitest";

import {
  computeBidEligibility,
  hasAllDetails,
  type EligibilityDocument,
  type EligibilityProfile,
} from "./bidEligibility";

const DEPOSIT_ON = { enabled: true, amount: 5000 };
const DEPOSIT_OFF = { enabled: false, amount: 5000 };

const saDetails: EligibilityProfile = {
  isVerified: false,
  idType: "sa_id",
  fullName: "enc",
  phoneNumber: "enc",
  idNumber: "enc",
  streetAddress: "enc",
  town: "enc",
  postalCode: "enc",
};

const passportDetails: EligibilityProfile = {
  isVerified: false,
  idType: "passport",
  fullName: "enc",
  phoneNumber: "enc",
  passportNumber: "enc",
  countryOfIssue: "Zimbabwe",
  streetAddress: "enc",
  town: "enc",
  postalCode: "enc",
};

const doc = (
  kind: EligibilityDocument["kind"],
  status: EligibilityDocument["status"] = "pending"
): EligibilityDocument => ({ kind, status });

describe("computeBidEligibility", () => {
  it("is ok when verified and the deposit is received", () => {
    expect(
      computeBidEligibility({
        profile: { ...saDetails, isVerified: true },
        documents: [],
        deposit: { status: "received", amount: 5000 },
        depositSetting: DEPOSIT_ON,
      })
    ).toEqual({ kind: "ok" });
  });

  it("is ok when verified and the deposit setting is off", () => {
    expect(
      computeBidEligibility({
        profile: { isVerified: true },
        documents: [],
        deposit: null,
        depositSetting: DEPOSIT_OFF,
      })
    ).toEqual({ kind: "ok" });
  });

  it("asks an existing verified buyer with no deposit row to pay", () => {
    expect(
      computeBidEligibility({
        profile: { isVerified: true, kycStatus: "verified" },
        documents: [],
        deposit: null,
        depositSetting: DEPOSIT_ON,
      })
    ).toEqual({ kind: "deposit_due", amount: 5000 });
  });

  it.each(["awaiting", "paid_claimed", "refunded"] as const)(
    "needs the deposit when verified and it is %s",
    (status) => {
      expect(
        computeBidEligibility({
          profile: { isVerified: true },
          documents: [],
          deposit: { status, amount: 5000 },
          depositSetting: DEPOSIT_ON,
        })
      ).toEqual({ kind: "deposit_due", amount: 5000 });
    }
  );

  it("counts rejected documents", () => {
    expect(
      computeBidEligibility({
        profile: { ...saDetails, registrationSubmittedAt: 1 },
        documents: [
          doc("id_front", "rejected"),
          doc("id_back"),
          doc("proof_of_address", "rejected"),
        ],
        deposit: null,
        depositSetting: DEPOSIT_ON,
      })
    ).toEqual({ kind: "needs_replacing", count: 2 });
  });

  it("is under review once submitted, reporting the deposit", () => {
    const base = {
      profile: { ...saDetails, registrationSubmittedAt: 1 },
      documents: [doc("id_front"), doc("id_back"), doc("proof_of_address")],
      depositSetting: DEPOSIT_ON,
    };
    expect(computeBidEligibility({ ...base, deposit: null })).toEqual({
      kind: "under_review",
      depositReceived: false,
    });
    expect(
      computeBidEligibility({
        ...base,
        deposit: { status: "received", amount: 5000 },
      })
    ).toEqual({ kind: "under_review", depositReceived: true });
  });

  it("treats a legacy pending KYC profile as under review", () => {
    expect(
      computeBidEligibility({
        profile: { isVerified: false, kycStatus: "pending" },
        documents: [],
        deposit: null,
        depositSetting: DEPOSIT_ON,
      })
    ).toEqual({ kind: "under_review", depositReceived: false });
  });

  it("starts at step 1 when details are missing", () => {
    expect(
      computeBidEligibility({
        profile: { isVerified: false },
        documents: [],
        deposit: null,
        depositSetting: DEPOSIT_ON,
      })
    ).toEqual({ kind: "incomplete", step: 1, totalSteps: 4 });
  });

  it("is on step 2 when details are done but the SA ID is incomplete", () => {
    expect(
      computeBidEligibility({
        profile: saDetails,
        documents: [doc("id_front")],
        deposit: null,
        depositSetting: DEPOSIT_ON,
      })
    ).toEqual({ kind: "incomplete", step: 2, totalSteps: 4 });
  });

  it("is on step 3 when the ID is uploaded but proof of address is not", () => {
    expect(
      computeBidEligibility({
        profile: saDetails,
        documents: [doc("id_front"), doc("id_back")],
        deposit: null,
        depositSetting: DEPOSIT_ON,
      })
    ).toEqual({ kind: "incomplete", step: 3, totalSteps: 4 });
  });

  it("uses three steps when the deposit is off", () => {
    expect(
      computeBidEligibility({
        profile: saDetails,
        documents: [],
        deposit: null,
        depositSetting: DEPOSIT_OFF,
      })
    ).toEqual({ kind: "incomplete", step: 2, totalSteps: 3 });
  });

  it("needs only the photo page for a passport", () => {
    expect(
      computeBidEligibility({
        profile: passportDetails,
        documents: [doc("passport_photo")],
        deposit: null,
        depositSetting: DEPOSIT_ON,
      })
    ).toEqual({ kind: "incomplete", step: 3, totalSteps: 4 });
    expect(
      computeBidEligibility({
        profile: passportDetails,
        documents: [],
        deposit: null,
        depositSetting: DEPOSIT_ON,
      })
    ).toEqual({ kind: "incomplete", step: 2, totalSteps: 4 });
  });
});

describe("hasAllDetails", () => {
  it("requires the passport number and country for passports", () => {
    expect(hasAllDetails(passportDetails)).toBe(true);
    expect(
      hasAllDetails({ ...passportDetails, countryOfIssue: undefined })
    ).toBe(false);
    expect(
      hasAllDetails({ ...passportDetails, passportNumber: undefined })
    ).toBe(false);
  });

  it("requires the ID number for SA IDs", () => {
    expect(hasAllDetails(saDetails)).toBe(true);
    expect(hasAllDetails({ ...saDetails, idNumber: undefined })).toBe(false);
  });
});
