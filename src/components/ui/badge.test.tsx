import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { Badge } from "./badge";

describe("Badge", () => {
  it("renders a span with the default variant", () => {
    render(<Badge>Fresh</Badge>);

    const badge = screen.getByText("Fresh");
    expect(badge.tagName).toBe("SPAN");
    expect(badge).toHaveAttribute("data-slot", "badge");
    expect(badge).toHaveAttribute("data-variant", "default");
    expect(badge).toHaveClass("bg-primary");
  });

  it("applies the requested variant classes", () => {
    render(<Badge variant="destructive">Sold</Badge>);

    const badge = screen.getByText("Sold");
    expect(badge).toHaveAttribute("data-variant", "destructive");
    expect(badge).toHaveClass("bg-destructive");
  });

  it("merges a caller-supplied className", () => {
    render(<Badge className="custom-class">Lot 12</Badge>);

    expect(screen.getByText("Lot 12")).toHaveClass("custom-class");
  });

  it("forwards remaining props to the rendered element", () => {
    render(<Badge aria-label="Auction state">Active</Badge>);

    expect(screen.getByLabelText("Auction state")).toHaveTextContent("Active");
  });

  it("renders the child element instead of a span when asChild is set", () => {
    render(
      <Badge asChild>
        <a href="/categories/veg">Veg</a>
      </Badge>
    );

    const link = screen.getByRole("link", { name: "Veg" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/categories/veg");
    expect(link).toHaveAttribute("data-slot", "badge");
    expect(link).toHaveClass("inline-flex");
    expect(link).toHaveClass("rounded-full");
  });
});
