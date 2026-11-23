import {
  MAX_SPEC_TEXT_LENGTH,
  PHOTO_ANGLES,
  PHOTO_ANGLE_LABELS,
  SELLER_TYPE_LABELS,
  type Drive,
  type PhotoAngle,
  type SellerType,
} from "../../convex/lib/lotSpecs";

export {
  MAX_SPEC_TEXT_LENGTH,
  PHOTO_ANGLES,
  PHOTO_ANGLE_LABELS,
  SELLER_TYPE_LABELS,
  type Drive,
  type PhotoAngle,
  type SellerType,
};

/** Drive types a seller can pick, with their display labels. */
export const DRIVE_OPTIONS: readonly { value: Drive; label: string }[] = [
  { value: "2wd", label: "2WD" },
  { value: "4wd", label: "4WD" },
  { value: "tracks", label: "Tracks" },
];

/** Seller types in display order. */
export const SELLER_TYPES: readonly SellerType[] = [
  "private_farmer",
  "farming_business",
  "dealer",
];

/** Optional machine spec values captured for a lot. */
export interface LotSpecValues {
  /** Engine power in kW (0-2000). */
  powerKw?: number;
  /** Drive type. */
  drive?: Drive;
  /** Transmission description. */
  transmission?: string;
  /** Front tyre tread remaining (0-100). */
  frontTyrePct?: number;
  /** Rear tyre tread remaining (0-100). */
  rearTyrePct?: number;
  /** Machine serial number. */
  serialNumber?: string;
}

/**
 * Narrows a string to a drive type.
 *
 * @param value - Raw select value
 * @returns The matching drive type, or undefined
 */
export function parseDrive(value: string): Drive | undefined {
  return DRIVE_OPTIONS.find((option) => option.value === value)?.value;
}

/**
 * Narrows a string to a seller type.
 *
 * @param value - Raw select value
 * @returns The matching seller type, or undefined
 */
export function parseSellerType(value: string): SellerType | undefined {
  return SELLER_TYPES.find((type) => type === value);
}

/**
 * Narrows a string to a photo angle.
 *
 * @param value - Raw select value
 * @returns The matching photo angle, or undefined
 */
export function parsePhotoAngle(value: string): PhotoAngle | undefined {
  return PHOTO_ANGLES.find((angle) => angle === value);
}

/**
 * Parses an optional numeric input; blank means "not provided".
 *
 * @param raw - Raw input text
 * @returns The number, or undefined when blank
 */
export function parseOptionalNumber(raw: string): number | undefined {
  return raw.trim() === "" ? undefined : Number(raw);
}

/**
 * Checks an optional number against an inclusive range.
 *
 * @param label - Field label for the message
 * @param value - Candidate value
 * @param max - Inclusive maximum
 * @param unit - Unit suffix for the message
 * @returns An error message, or null when valid or absent
 */
function rangeError(
  label: string,
  value: number | undefined,
  max: number,
  unit: string
): string | null {
  if (value === undefined) return null;
  if (!Number.isFinite(value) || value < 0 || value > max) {
    return `${label} must be between 0 and ${String(max)}${unit}`;
  }
  return null;
}

/**
 * Validates spec values with the same ranges the server enforces.
 *
 * @param specs - Spec values to check
 * @returns The first error message, or null when everything is valid
 */
export function getLotSpecsError(specs: LotSpecValues): string | null {
  const textError = (label: string, text?: string): string | null =>
    text !== undefined && text.length > MAX_SPEC_TEXT_LENGTH
      ? `${label} must be at most ${String(MAX_SPEC_TEXT_LENGTH)} characters`
      : null;
  return (
    rangeError("Power", specs.powerKw, 2000, " kW") ??
    rangeError("Front tyre", specs.frontTyrePct, 100, "%") ??
    rangeError("Rear tyre", specs.rearTyrePct, 100, "%") ??
    textError("Transmission", specs.transmission) ??
    textError("Serial number", specs.serialNumber)
  );
}

/**
 * Builds the spec arguments for createLot / saveDraft / adminUpdateLot,
 * dropping blank values so untouched fields are never sent.
 *
 * @param specs - Spec values from the form
 * @returns Only the fields that have a value
 */
export function buildSpecArgs(specs: LotSpecValues): LotSpecValues {
  const transmission = specs.transmission?.trim();
  const serialNumber = specs.serialNumber?.trim();
  return {
    ...(specs.powerKw !== undefined && { powerKw: specs.powerKw }),
    ...(specs.drive !== undefined && { drive: specs.drive }),
    ...(transmission ? { transmission } : {}),
    ...(specs.frontTyrePct !== undefined && {
      frontTyrePct: specs.frontTyrePct,
    }),
    ...(specs.rearTyrePct !== undefined && { rearTyrePct: specs.rearTyrePct }),
    ...(serialNumber ? { serialNumber } : {}),
  };
}

/**
 * Keeps only angle captions whose image is still on the lot.
 *
 * @param angles - Map of image reference to angle
 * @param refs - The lot's current image references
 * @returns The filtered map, or undefined when nothing remains
 */
export function pickImageAngles(
  angles: Record<string, PhotoAngle> | undefined,
  refs: readonly string[]
): Record<string, PhotoAngle> | undefined {
  if (!angles) return undefined;
  const kept = Object.entries(angles).filter(([ref]) => refs.includes(ref));
  return kept.length > 0 ? Object.fromEntries(kept) : undefined;
}
