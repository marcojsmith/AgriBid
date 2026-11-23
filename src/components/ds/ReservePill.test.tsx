import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { ReservePill } from "./ReservePill";

describe("ReservePill", () => {
  it.each([
    ["applies", "Reserve applies"],
    ["met", "Reserve met"],
    ["not-met", "Reserve not met"],
    ["none", "No reserve"],
  ] as const)("renders %s as text", (state, label) => {
    render(<ReservePill state={state} className="extra" />);
    const el = screen.getByText(label);
    expect(el).toHaveAttribute("data-state", state);
    expect(el).toHaveClass("extra", "whitespace-nowrap", "text-sm");
    expect(el.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("is neutral before any bid and amber when not met", () => {
    const { rerender } = render(<ReservePill state="applies" />);
    expect(screen.getByText("Reserve applies")).toHaveClass(
      "text-muted-foreground"
    );
    rerender(<ReservePill state="not-met" />);
    expect(screen.getByText("Reserve not met")).toHaveClass(
      "bg-warn-soft",
      "text-warn-fg"
    );
  });

  it("uses the smaller size inside cards", () => {
    render(<ReservePill state="met" size="card" />);
    expect(screen.getByText("Reserve met")).toHaveClass("text-[13px]");
  });
});
