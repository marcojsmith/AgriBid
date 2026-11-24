/**
 * Pure registration input validators. No Convex runtime or environment
 * dependencies, so `src/` can import them (`lib/registration.ts` re-exports
 * them for the backend).
 */

/**
 * Whether `yy`/`mm`/`dd` form a real calendar date in the given full year.
 *
 * @param year - Full four-digit year
 * @param month - Month, 1-12
 * @param day - Day of month
 * @returns True for a real date
 */
function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Validates a South African ID number: 13 digits, a real YYMMDD birth date
 * (either century) and a correct Luhn check digit.
 *
 * @param value - Candidate ID number
 * @returns True when valid
 */
export function isValidSaId(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;

  const yy = Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  if (
    !isRealDate(1900 + yy, month, day) &&
    !isRealDate(2000 + yy, month, day)
  ) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 13; i++) {
    let digit = Number(value[12 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/**
 * Validates a passport number: 6 to 9 letters or digits.
 *
 * @param value - Candidate passport number
 * @returns True when valid
 */
export function isValidPassportNumber(value: string): boolean {
  return /^[A-Z0-9]{6,9}$/i.test(value);
}

/**
 * Validates a postal code: 3 to 10 letters, digits, spaces or hyphens.
 *
 * @param value - Candidate postal code
 * @returns True when valid
 */
export function isValidPostalCode(value: string): boolean {
  return /^[A-Za-z0-9 -]{3,10}$/.test(value);
}
