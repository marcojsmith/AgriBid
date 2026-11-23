import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { LotChip } from "./LotChip";

describe("LotChip", () => {
  it("renders 'Lot N' inline by default", () => {
    render(<LotChip number={3} />);
    const el = screen.getByText("Lot 3");
    expect(el).toHaveAttribute("data-slot", "lot-chip");
    expect(el).toHaveClass("bg-chip", "text-white", "rounded-sm");
    expect(el).not.toHaveClass("absolute");
  });

  it("positions itself over a photo and accepts string numbers and classes", () => {
    render(<LotChip number="12A" overPhoto className="extra" />);
    expect(screen.getByText("Lot 12A")).toHaveClass(
      "absolute",
      "top-2",
      "left-2",
      "extra"
    );
  });
});
