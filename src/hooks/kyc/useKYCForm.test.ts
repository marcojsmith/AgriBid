import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import {
  useKYCForm,
  type KYCFormData,
  type ValidationResult,
} from "./useKYCForm";

describe("useKYCForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with empty fields by default", () => {
      const { result } = renderHook(() => useKYCForm());

      expect(result.current.formData).toEqual({
        firstName: "",
        lastName: "",
        phoneNumber: "",
        idNumber: "",
        email: "",
        confirmEmail: "",
      });
      expect(result.current.isFormInitialized).toBe(false);
    });

    it("should initialize with provided initial data", () => {
      const initialData: Partial<KYCFormData> = {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      };

      const { result } = renderHook(() => useKYCForm(initialData));

      expect(result.current.formData.firstName).toBe("John");
      expect(result.current.formData.lastName).toBe("Doe");
      expect(result.current.formData.email).toBe("john@example.com");
      expect(result.current.formData.confirmEmail).toBe("john@example.com");
      expect(result.current.isFormInitialized).toBe(true);
    });

    it("should use empty confirmEmail when email not provided", () => {
      const { result } = renderHook(() => useKYCForm({ firstName: "Test" }));

      expect(result.current.formData.confirmEmail).toBe("");
    });
  });

  describe("updateField", () => {
    it("should update a single field", () => {
      const { result } = renderHook(() => useKYCForm());

      act(() => {
        result.current.updateField("firstName", "Jane");
      });

      expect(result.current.formData.firstName).toBe("Jane");
      expect(result.current.formData.lastName).toBe("");
    });

    it("should update multiple fields sequentially", () => {
      const { result } = renderHook(() => useKYCForm());

      act(() => {
        result.current.updateField("firstName", "Jane");
        result.current.updateField("lastName", "Smith");
        result.current.updateField("phoneNumber", "+27123456789");
      });

      expect(result.current.formData.firstName).toBe("Jane");
      expect(result.current.formData.lastName).toBe("Smith");
      expect(result.current.formData.phoneNumber).toBe("+27123456789");
    });
  });

  describe("resetForm", () => {
    it("should reset all fields to empty", () => {
      const { result } = renderHook(() =>
        useKYCForm({ firstName: "John", lastName: "Doe" })
      );

      act(() => {
        result.current.resetForm();
      });

      expect(result.current.formData).toEqual({
        firstName: "",
        lastName: "",
        phoneNumber: "",
        idNumber: "",
        email: "",
        confirmEmail: "",
      });
      expect(result.current.isFormInitialized).toBe(true);
    });
  });

  describe("validate", () => {
    it("should fail for empty fields", () => {
      const { result } = renderHook(() => useKYCForm());

      let validationResult: ValidationResult | undefined;
      act(() => {
        validationResult = result.current.validate();
      });

      expect(validationResult).toEqual({
        valid: false,
        message: "Please fill in all personal details",
      });
    });

    it("should fail for missing firstName", () => {
      const { result } = renderHook(() =>
        useKYCForm({
          lastName: "Doe",
          email: "test@example.com",
          confirmEmail: "test@example.com",
          phoneNumber: "+27123456789",
          idNumber: "8001015009087",
        })
      );

      let validationResult: ValidationResult | undefined;
      act(() => {
        validationResult = result.current.validate();
      });

      expect(validationResult).toEqual({
        valid: false,
        message: "Please fill in all personal details",
      });
    });

    it("should fail for invalid email", () => {
      const { result } = renderHook(() =>
        useKYCForm({
          firstName: "John",
          lastName: "Doe",
          email: "invalid-email",
          confirmEmail: "invalid-email",
          phoneNumber: "+27123456789",
          idNumber: "8001015009087",
        })
      );

      let validationResult: ValidationResult | undefined;
      act(() => {
        validationResult = result.current.validate();
      });

      expect(validationResult).toEqual({
        valid: false,
        message: "Please enter a valid email address",
      });
    });

    it("should fail for mismatched emails", () => {
      const { result } = renderHook(() =>
        useKYCForm({
          firstName: "John",
          lastName: "Doe",
          email: "test@example.com",
          confirmEmail: "different@example.com",
          phoneNumber: "+27123456789",
          idNumber: "8001015009087",
        })
      );

      let validationResult: ValidationResult | undefined;
      act(() => {
        validationResult = result.current.validate();
      });

      expect(validationResult).toEqual({
        valid: false,
        message: "Emails do not match",
      });
    });

    it("should fail for invalid phone number (too short)", () => {
      const { result } = renderHook(() =>
        useKYCForm({
          firstName: "John",
          lastName: "Doe",
          email: "test@example.com",
          confirmEmail: "test@example.com",
          phoneNumber: "123",
          idNumber: "8001015009087",
        })
      );

      let validationResult: ValidationResult | undefined;
      act(() => {
        validationResult = result.current.validate();
      });

      expect(validationResult).toEqual({
        valid: false,
        message: "Please enter a valid phone number (at least 10 digits)",
      });
    });

    it("should fail for invalid phone number (too long)", () => {
      const { result } = renderHook(() =>
        useKYCForm({
          firstName: "John",
          lastName: "Doe",
          email: "test@example.com",
          confirmEmail: "test@example.com",
          phoneNumber: "1234567890123456",
          idNumber: "8001015009087",
        })
      );

      let validationResult: ValidationResult | undefined;
      act(() => {
        validationResult = result.current.validate();
      });

      expect(validationResult).toEqual({
        valid: false,
        message: "Please enter a valid phone number (at least 10 digits)",
      });
    });

    it("should fail for invalid ID number (wrong length)", () => {
      const { result } = renderHook(() =>
        useKYCForm({
          firstName: "John",
          lastName: "Doe",
          email: "test@example.com",
          confirmEmail: "test@example.com",
          phoneNumber: "+27123456789",
          idNumber: "90010100000",
        })
      );

      let validationResult: ValidationResult | undefined;
      act(() => {
        validationResult = result.current.validate();
      });

      expect(validationResult).toEqual({
        valid: false,
        message: "Please enter a valid 13-digit South African ID number",
      });
    });

    it("should fail for all-zero ID number", () => {
      const { result } = renderHook(() =>
        useKYCForm({
          firstName: "John",
          lastName: "Doe",
          email: "test@example.com",
          confirmEmail: "test@example.com",
          phoneNumber: "+27123456789",
          idNumber: "0000000000000",
        })
      );

      let validationResult: ValidationResult | undefined;
      act(() => {
        validationResult = result.current.validate();
      });

      expect(validationResult).toEqual({
        valid: false,
        message: "Please enter a valid 13-digit South African ID number",
      });
    });

    it("should fail for invalid date in ID number", () => {
      const { result } = renderHook(() =>
        useKYCForm({
          firstName: "John",
          lastName: "Doe",
          email: "test@example.com",
          confirmEmail: "test@example.com",
          phoneNumber: "+27123456789",
          idNumber: "9013015009087",
        })
      );

      let validationResult: ValidationResult | undefined;
      act(() => {
        validationResult = result.current.validate();
      });

      expect(validationResult).toEqual({
        valid: false,
        message: "Please enter a valid 13-digit South African ID number",
      });
    });

    it("should fail for future birth date in ID number", () => {
      const futureYear = new Date().getFullYear() + 1;
      const yearSuffix = String(futureYear).slice(-2);
      const idNumber = `${yearSuffix}01010000081`;

      const { result } = renderHook(() =>
        useKYCForm({
          firstName: "John",
          lastName: "Doe",
          email: "test@example.com",
          confirmEmail: "test@example.com",
          phoneNumber: "+27123456789",
          idNumber,
        })
      );

      let validationResult: ValidationResult | undefined;
      act(() => {
        validationResult = result.current.validate();
      });

      expect(validationResult).toEqual({
        valid: false,
        message: "Please enter a valid 13-digit South African ID number",
      });
    });

    it("should fail for invalid Luhn checksum", () => {
      const { result } = renderHook(() =>
        useKYCForm({
          firstName: "John",
          lastName: "Doe",
          email: "test@example.com",
          confirmEmail: "test@example.com",
          phoneNumber: "+27123456789",
          idNumber: "9001010000082",
        })
      );

      let validationResult: ValidationResult | undefined;
      act(() => {
        validationResult = result.current.validate();
      });

      expect(validationResult).toEqual({
        valid: false,
        message: "Please enter a valid 13-digit South African ID number",
      });
    });

    it("should pass for valid data", () => {
      const { result } = renderHook(() =>
        useKYCForm({
          firstName: "John",
          lastName: "Doe",
          email: "test@example.com",
          confirmEmail: "test@example.com",
          phoneNumber: "+27123456789",
          idNumber: "8001015009087",
        })
      );

      let validationResult: ValidationResult | undefined;
      act(() => {
        validationResult = result.current.validate();
      });

      expect(validationResult).toEqual({ valid: true });
    });

    it("should validate phone number with spaces and dashes", () => {
      const { result } = renderHook(() =>
        useKYCForm({
          firstName: "John",
          lastName: "Doe",
          email: "test@example.com",
          confirmEmail: "test@example.com",
          phoneNumber: "+27 123-456-789",
          idNumber: "8001015009087",
        })
      );

      let validationResult: ValidationResult | undefined;
      act(() => {
        validationResult = result.current.validate();
      });

      expect(validationResult).toEqual({ valid: true });
    });
  });

  describe("setIsFormInitialized", () => {
    it("should allow setting isFormInitialized to false", () => {
      const { result } = renderHook(() => useKYCForm({ firstName: "Test" }));

      expect(result.current.isFormInitialized).toBe(true);

      act(() => {
        result.current.setIsFormInitialized(false);
      });

      expect(result.current.isFormInitialized).toBe(false);
    });
  });
});
