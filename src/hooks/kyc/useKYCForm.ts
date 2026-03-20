import { useState } from "react";

export interface KYCFormData {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  idNumber: string;
  email: string;
  confirmEmail: string;
}

export type ValidationResult =
  | { valid: true }
  | { valid: false; message: string };

/**
 * Manages KYC form state, initialization from optional data, and field validation helpers.
 *
 * @param initialData - Optional partial form values used once to prefill the form; any missing fields default to empty strings
 * @returns An object exposing:
 *  - `formData`: current KYC form values,
 *  - `updateField(field, value)`: update a single field,
 *  - `resetForm()`: clear all fields and reset initialization state,
 *  - `validate()`: returns a `ValidationResult` object
 *  - `isFormInitialized`: whether initialData has been applied,
 *  - `setIsFormInitialized`: setter to control the initialization flag
 */
export function useKYCForm(initialData?: Partial<KYCFormData>) {
  const [formData, setFormData] = useState<KYCFormData>(() => ({
    firstName: initialData?.firstName ?? "",
    lastName: initialData?.lastName ?? "",
    phoneNumber: initialData?.phoneNumber ?? "",
    idNumber: initialData?.idNumber ?? "",
    email: initialData?.email ?? "",
    confirmEmail: initialData?.confirmEmail ?? initialData?.email ?? "",
  }));

  const [isFormInitialized, setIsFormInitialized] = useState(!!initialData);

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
    setIsFormInitialized(true);
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isValidPhoneNumber = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    return cleanPhone.length >= 10 && cleanPhone.length <= 15;
  };

  const isValidIdNumber = (id: string) => {
    const cleanId = id.replace(/\D/g, "");
    if (cleanId.length !== 13) return false;

    if (/^0+$/.test(cleanId)) return false;

    const yearPart = parseInt(cleanId.substring(0, 2), 10);
    const monthPart = parseInt(cleanId.substring(2, 4), 10);
    const dayPart = parseInt(cleanId.substring(4, 6), 10);

    if (monthPart < 1 || monthPart > 12) return false;

    const currentYearShort = new Date().getFullYear() % 100;
    const fullYear =
      yearPart <= currentYearShort ? 2000 + yearPart : 1900 + yearPart;

    const birthDate = new Date(fullYear, monthPart - 1, dayPart);

    if (
      birthDate.getFullYear() !== fullYear ||
      birthDate.getMonth() !== monthPart - 1 ||
      birthDate.getDate() !== dayPart
    ) {
      return false;
    }

    if (birthDate > new Date()) return false;

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

  const validate = (): ValidationResult => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      return { valid: false, message: "Please fill in all personal details" };
    }

    if (!isValidEmail(formData.email)) {
      return { valid: false, message: "Please enter a valid email address" };
    }

    if (formData.email !== formData.confirmEmail) {
      return { valid: false, message: "Emails do not match" };
    }

    if (!isValidPhoneNumber(formData.phoneNumber)) {
      return {
        valid: false,
        message: "Please enter a valid phone number (at least 10 digits)",
      };
    }

    if (!isValidIdNumber(formData.idNumber)) {
      return {
        valid: false,
        message: "Please enter a valid 13-digit South African ID number",
      };
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
