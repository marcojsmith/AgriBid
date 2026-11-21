import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { ReservePill } from "./ReservePill";

describe("ReservePill", () => {
  it.each([
    ["met", "Reserve met"],
    ["not-met", "Reserve not met"],
    ["none", "No reserve"],
  ] as const)("renders %s as text", (state, label) => {
    render(<ReservePill state={state} className="extra" />);
    const el = screen.getByText(label);
    expect(el).toHaveAttribute("data-state", state);
    expect(el).toHaveClass("extra");
    expect(el.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
