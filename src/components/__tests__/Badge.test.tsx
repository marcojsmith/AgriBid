import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { Badge } from "../ui/badge";

describe("Badge", () => {
  it("renders children correctly", () => {
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText("Test Badge")).toBeInTheDocument();
  });

  it("renders with default variant", () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText("Default");
    expect(badge).toHaveAttribute("data-slot", "badge");
  });

  it("renders with outline variant", () => {
    render(<Badge variant="outline">Outline</Badge>);
    const badge = screen.getByText("Outline");
    expect(badge).toHaveAttribute("data-variant", "outline");
  });
});
