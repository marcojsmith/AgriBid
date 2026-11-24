/**
 * Registration step 1 form logic: the values, the phone number rules and the
 * inline validation. Pure, so it can be tested without rendering. The checks
 * reuse the backend helpers so the form and `saveMyDetails` always agree.
 */

import type { IdType } from "../../convex/lib/registration";
import {
  isValidPassportNumber,
  isValidPostalCode,
  isValidSaId,
} from "../../convex/lib/registrationValidators";
import { normalizeSaPhone } from "./phone";

/** What the buyer types on the details step. */
export interface DetailsValues {
  idType: IdType;
  fullName: string;
  /** SA ID: the number after "+27". Passport: the full number with country code. */
  phone: string;
  idNumber: string;
  passportNumber: string;
  countryOfIssue: string;
  streetAddress: string;
  town: string;
  postalCode: string;
}

/** The fields that can carry an inline error. */
export type DetailsErrors = Partial<
  Record<
    | "fullName"
    | "phone"
    | "idNumber"
    | "passportNumber"
    | "countryOfIssue"
    | "streetAddress"
    | "town"
    | "postalCode",
    string
  >
>;

/** The arguments of `registration.saveMyDetails`. */
export interface SaveDetailsArgs {
  idType: IdType;
  fullName: string;
  phoneNumber: string;
  idNumber?: string;
  passportNumber?: string;
  countryOfIssue?: string;
  streetAddress: string;
  town: string;
  postalCode: string;
}

const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

/**
 * Removes spaces, dashes, dots and brackets from a typed phone number.
 *
 * @param raw - The number as typed
 * @returns The cleaned number
 */
function stripPhone(raw: string): string {
  return raw.replace(/[\s\-.()]/g, "");
}

/**
 * Turns the typed phone number into E.164.
 *
 * SA ID mode shows a fixed "+27" prefix, so the buyer types the nine national
 * digits (a leading 0 or 27 is tolerated). Passport mode takes the full number
 * with its country code.
 *
 * @param idType - The chosen ID type
 * @param raw - The number as typed
 * @returns The E.164 number, or null when invalid
 */
export function toE164(idType: IdType, raw: string): string | null {
  const cleaned = stripPhone(raw);
  if (idType === "passport") {
    return E164_PATTERN.test(cleaned) ? cleaned : null;
  }
  if (/^[1-8]\d{8}$/.test(cleaned)) return `+27${cleaned}`;
  return normalizeSaPhone(cleaned);
}

/**
 * The text to show in the phone field for a stored E.164 number.
 *
 * @param idType - The ID type
 * @param stored - The stored number, if any
 * @returns For SA ID the digits after "+27"; for a passport the full number
 */
export function phoneToField(
  idType: IdType,
  stored: string | undefined
): string {
  if (!stored) return "";
  if (idType === "sa_id" && stored.startsWith("+27")) return stored.slice(3);
  return stored;
}

/**
 * Converts the phone field when the buyer flips between SA ID and passport, so
 * what they typed is kept.
 *
 * @param to - The ID type being switched to
 * @param phone - The current field text
 * @returns The field text for the new mode
 */
export function switchPhoneMode(to: IdType, phone: string): string {
  const cleaned = stripPhone(phone);
  if (cleaned === "") return "";
  if (to === "passport") {
    // Typed as a South African number (9 digits, 0..., 27...): make it +27 once.
    const sa = toE164("sa_id", cleaned);
    if (sa) return sa;
    return cleaned.startsWith("+")
      ? cleaned
      : `+27${cleaned.replace(/^0/, "")}`;
  }
  return cleaned.startsWith("+27") ? cleaned.slice(3) : cleaned;
}

/**
 * Checks every field and returns an error per invalid one. Shown on submit,
 * not while typing.
 *
 * @param values - The form values
 * @returns The errors (empty when the form is valid)
 */
export function validateDetails(values: DetailsValues): DetailsErrors {
  const errors: DetailsErrors = {};
  if (values.fullName.trim() === "") errors.fullName = "Enter your full name.";

  if (toE164(values.idType, values.phone) === null) {
    errors.phone =
      values.idType === "passport"
        ? "Enter your number with country code, e.g. +264 81 555 0147."
        : "Enter a valid mobile number.";
  }

  if (values.idType === "sa_id") {
    if (!isValidSaId(values.idNumber.replace(/\s/g, ""))) {
      errors.idNumber = "Enter a valid 13-digit ID number.";
    }
  } else {
    if (!isValidPassportNumber(values.passportNumber.trim().toUpperCase())) {
      errors.passportNumber = "Enter a valid passport number.";
    }
    if (values.countryOfIssue.trim() === "") {
      errors.countryOfIssue = "Enter the country of issue.";
    }
  }

  if (values.streetAddress.trim() === "") {
    errors.streetAddress = "Enter your street address.";
  }
  if (values.town.trim() === "") errors.town = "Enter your town.";
  if (!isValidPostalCode(values.postalCode.trim())) {
    errors.postalCode = "Enter a valid postal code.";
  }
  return errors;
}

/**
 * Builds the `saveMyDetails` arguments from validated values.
 *
 * @param values - The form values (already validated)
 * @returns The mutation arguments
 * @throws When the phone number is invalid (validate first)
 */
export function toSaveArgs(values: DetailsValues): SaveDetailsArgs {
  const phoneNumber = toE164(values.idType, values.phone);
  if (phoneNumber === null) throw new Error("Invalid phone number");
  const base = {
    idType: values.idType,
    fullName: values.fullName.trim(),
    phoneNumber,
    streetAddress: values.streetAddress.trim(),
    town: values.town.trim(),
    postalCode: values.postalCode.trim(),
  };
  return values.idType === "sa_id"
    ? { ...base, idNumber: values.idNumber.replace(/\s/g, "") }
    : {
        ...base,
        passportNumber: values.passportNumber.trim().toUpperCase(),
        countryOfIssue: values.countryOfIssue.trim(),
      };
}
