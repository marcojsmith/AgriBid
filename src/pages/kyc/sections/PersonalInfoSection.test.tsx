import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { PersonalInfoSection } from "./PersonalInfoSection";

describe("PersonalInfoSection", () => {
  const mockUpdateField = vi.fn();

  const defaultProps = {
    formData: {
      firstName: "",
      lastName: "",
      idNumber: "",
      phoneNumber: "",
      email: "",
      confirmEmail: "",
    },
    updateField: mockUpdateField,
  };

  it("renders personal information form title and all fields", () => {
    render(<PersonalInfoSection {...defaultProps} />);
    expect(screen.getByText("Personal Information")).toBeInTheDocument();
    expect(screen.getByLabelText(/first names/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/id \/ passport number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cell phone number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm email/i)).toBeInTheDocument();
  });

  it("renders all input fields with provided values", () => {
    const formData = {
      firstName: "John",
      lastName: "Doe",
      idNumber: "1234567890123",
      phoneNumber: "0123456789",
      email: "john@example.com",
      confirmEmail: "john@example.com",
    };
    render(<PersonalInfoSection {...defaultProps} formData={formData} />);

    expect(screen.getByDisplayValue("John")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Doe")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1234567890123")).toBeInTheDocument();
    expect(screen.getByDisplayValue("0123456789")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("john@example.com")).toHaveLength(2);
  });

  it("calls updateField for each field when user types", () => {
    render(<PersonalInfoSection {...defaultProps} />);

    // Test First Names
    fireEvent.change(screen.getByLabelText(/first names/i), {
      target: { value: "Jane" },
    });
    expect(mockUpdateField).toHaveBeenCalledWith("firstName", "Jane");

    // Test Last Name
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: "Smith" },
    });
    expect(mockUpdateField).toHaveBeenCalledWith("lastName", "Smith");

    // Test ID Number
    fireEvent.change(screen.getByLabelText(/id \/ passport number/i), {
      target: { value: "123" },
    });
    expect(mockUpdateField).toHaveBeenCalledWith("idNumber", "123");

    // Test Phone Number
    fireEvent.change(screen.getByLabelText(/cell phone number/i), {
      target: { value: "082" },
    });
    expect(mockUpdateField).toHaveBeenCalledWith("phoneNumber", "082");

    // Test Email
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "jane@test.com" },
    });
    expect(mockUpdateField).toHaveBeenCalledWith("email", "jane@test.com");

    // Test Confirm Email
    fireEvent.change(screen.getByLabelText(/confirm email/i), {
      target: { value: "jane@test.com" },
    });
    expect(mockUpdateField).toHaveBeenCalledWith(
      "confirmEmail",
      "jane@test.com"
    );
  });

  it("renders error messages when errors are provided", () => {
    const errors = {
      firstName: "First name is required",
      lastName: "Last name is required",
      idNumber: "Invalid ID number",
      phoneNumber: "Invalid phone number",
      email: "Invalid email",
      confirmEmail: "Emails do not match",
    };

    render(<PersonalInfoSection {...defaultProps} errors={errors} />);

    expect(screen.getByText("First name is required")).toBeInTheDocument();
    expect(screen.getByText("Last name is required")).toBeInTheDocument();
    expect(screen.getByText("Invalid ID number")).toBeInTheDocument();
    expect(screen.getByText("Invalid phone number")).toBeInTheDocument();
    expect(screen.getByText("Invalid email")).toBeInTheDocument();
    expect(screen.getByText("Emails do not match")).toBeInTheDocument();
  });

  it("applies error styling to inputs with errors", () => {
    const errors = {
      firstName: "Error",
    };

    render(<PersonalInfoSection {...defaultProps} errors={errors} />);

    const firstNameInput = screen.getByLabelText(/first names/i);
    expect(firstNameInput).toHaveClass("border-destructive");

    const lastNameInput = screen.getByLabelText(/last name/i);
    expect(lastNameInput).not.toHaveClass("border-destructive");
  });

  it("handles email mismatch error state rendering specifically", () => {
    const errors = {
      confirmEmail: "Emails do not match",
    };

    render(<PersonalInfoSection {...defaultProps} errors={errors} />);

    expect(screen.getByText("Emails do not match")).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm email/i)).toHaveClass(
      "border-destructive"
    );
  });
});
