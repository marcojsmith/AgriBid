// app/src/pages/kyc/hooks/useKYCForm.ts
import { useState, useEffect } from "react";

export interface KYCFormData {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  idNumber: string;
  email: string;
  confirmEmail: string;
}

/**
 * Manages KYC form state, initialization from optional data, and field validation helpers.
 *
 * @param initialData - Optional partial form values used once to prefill the form; any missing fields default to empty strings
 * @returns An object exposing:
 *  - `formData`: current KYC form values,
 *  - `updateField(field, value)`: update a single field,
 *  - `resetForm()`: clear all fields and reset initialization state,
 *  - `validate()`: returns `{ valid: true }` when all fields pass validation or `{ valid: false, message: string }` describing the first validation error,
 *  - `isFormInitialized`: whether initialData has been applied,
 *  - `setIsFormInitialized`: setter to control the initialization flag
 */
export function useKYCForm(initialData?: Partial<KYCFormData>) {
  const [formData, setFormData] = useState<KYCFormData>({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    idNumber: "",
    email: "",
    confirmEmail: "",
  });

  const [isFormInitialized, setIsFormInitialized] = useState(false);

  useEffect(() => {
    if (initialData && !isFormInitialized) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        firstName: initialData.firstName || "",
        lastName: initialData.lastName || "",
        phoneNumber: initialData.phoneNumber || "",
        idNumber: initialData.idNumber || "",
        email: initialData.email || "",
        confirmEmail: initialData.confirmEmail ?? initialData.email ?? "",
      });
      setIsFormInitialized(true);
    }
  }, [initialData, isFormInitialized]);

  const updateField = (field: keyof KYCFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      phoneNumber: "",
      idNumber: "",
      email: "",
      confirmEmail: "",
    });
    // Set to true so effect doesn't immediately re-populate from initialData
    setIsFormInitialized(true);
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isValidPhoneNumber = (phone: string) => {
    // Basic validation for South African numbers or international format
    // Allows +27, 0, and digits. Needs at least 10 digits.
    const cleanPhone = phone.replace(/\D/g, "");
    return cleanPhone.length >= 10 && cleanPhone.length <= 15;
  };

  const isValidIdNumber = (id: string) => {
    // Robust validation for SA ID (13 digits, date check, Luhn checksum)
    const cleanId = id.replace(/\D/g, "");
    if (cleanId.length !== 13) return false;

    // Reject obvious dummies (all zeros)
    if (/^0+$/.test(cleanId)) return false;

    // 1. Date Validation (YYMMDD)
    const yearPart = parseInt(cleanId.substring(0, 2), 10);
    const monthPart = parseInt(cleanId.substring(2, 4), 10);
    const dayPart = parseInt(cleanId.substring(4, 6), 10);

    // Month check
    if (monthPart < 1 || monthPart > 12) return false;

    // Full year inference (assume 1900-2099)
    // NOTE: This logic has a 100-year ambiguity (e.g., year '26' could be 1926 or 2026).
    // People born in the cutoff year (e.g., yearPart === currentYearShort, such as 1926) 
    // are mapped to 2026 (future date, fails validation). 
    // Those born before the cutoff (yearPart < currentYearShort, e.g., 1925) are mapped 
    // to 20xx (e.g., 2025), which are past dates and may incorrectly pass.
    // This limitation is intentional for this prototype; the cutoff can be changed if needed.
    const currentYearShort = new Date().getFullYear() % 100;
    const fullYear = yearPart <= currentYearShort ? 2000 + yearPart : 1900 + yearPart;
    
    const birthDate = new Date(fullYear, monthPart - 1, dayPart);
    
    // Check if date is valid (e.g., handles Feb 29 on non-leap years)
    if (
      birthDate.getFullYear() !== fullYear ||
      birthDate.getMonth() !== monthPart - 1 ||
      birthDate.getDate() !== dayPart
    ) {
      return false;
    }

    // Reject future dates
    if (birthDate > new Date()) return false;

    // 2. Luhn Checksum
    let sum = 0;
    for (let i = 0; i < 13; i++) {
      let digit = parseInt(cleanId.charAt(i), 10);
      if (i % 2 !== 0) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
    }
    
    return sum % 10 === 0;
  };

  const validate = () => {
    if (
      !formData.firstName.trim() ||
      !formData.lastName.trim()
    ) {
      return { valid: false, message: "Please fill in all personal details" };
    }

    if (!isValidEmail(formData.email)) {
      return { valid: false, message: "Please enter a valid email address" };
    }

    if (formData.email !== formData.confirmEmail) {
      return { valid: false, message: "Emails do not match" };
    }

    if (!isValidPhoneNumber(formData.phoneNumber)) {
      return { valid: false, message: "Please enter a valid phone number (at least 10 digits)" };
    }

    if (!isValidIdNumber(formData.idNumber)) {
      return { valid: false, message: "Please enter a valid 13-digit South African ID number" };
    }

    return { valid: true };
  };

  return {
    formData,
    updateField,
    resetForm,
    validate,
    isFormInitialized,
    setIsFormInitialized,
  };
}