import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { TextField } from "./TextField";

describe("TextField", () => {
  it("associates the label with the input and reports changes", () => {
    const onChange = vi.fn();
    render(
      <TextField id="phone" label="Cell number" value="" onChange={onChange} />
    );
    const input = screen.getByLabelText("Cell number");
    expect(input).toHaveAttribute("id", "phone");
    expect(input.parentElement).toHaveClass("h-[52px]", "rounded-md");
    fireEvent.change(input, { target: { value: "821234567" } });
    expect(onChange).toHaveBeenCalledWith("821234567");
  });

  it("shows the hint and links it with aria-describedby", () => {
    render(
      <TextField
        id="idn"
        label="ID number"
        value=""
        onChange={vi.fn()}
        hint="13 digits."
      />
    );
    const input = screen.getByLabelText("ID number");
    const hint = screen.getByText("13 digits.");
    expect(hint).toHaveAttribute("id", "idn-hint");
    expect(input).toHaveAttribute("aria-describedby", "idn-hint");
    expect(input).not.toHaveAttribute("aria-invalid", "true");
  });

  it("replaces the hint with an alert error", () => {
    render(
      <TextField
        id="idn"
        label="ID number"
        value="123"
        onChange={vi.fn()}
        hint="13 digits."
        error="Enter all 13 digits"
      />
    );
    const input = screen.getByLabelText("ID number");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Enter all 13 digits");
    expect(alert).toHaveClass("text-destructive");
    expect(screen.queryByText("13 digits.")).not.toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", alert.id);
  });

  it("renders a prefix segment and passes input attributes", () => {
    render(
      <TextField
        id="cell"
        label="Cell number"
        value="82"
        onChange={vi.fn()}
        prefix="+27"
        inputMode="tel"
        autoComplete="tel-national"
        maxLength={9}
        className="extra"
      />
    );
    expect(screen.getByText("+27")).toBeInTheDocument();
    const input = screen.getByLabelText("Cell number");
    expect(input).toHaveAttribute("inputmode", "tel");
    expect(input).toHaveAttribute("autocomplete", "tel-national");
    expect(input).toHaveAttribute("maxlength", "9");
    expect(input).toHaveValue("82");
    expect(document.querySelector("[data-slot='text-field']")).toHaveClass(
      "extra"
    );
  });
});
