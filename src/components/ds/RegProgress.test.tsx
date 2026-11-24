import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { RegProgress } from "./RegProgress";

function segments(container: HTMLElement) {
  return Array.from(container.querySelectorAll("[data-segment]"));
}

describe("RegProgress", () => {
  it("labels the root and hides the bar", () => {
    const { container } = render(<RegProgress step={2} total={4} label="ID" />);
    const root = screen.getByRole("group", { name: "Step 2 of 4, ID" });
    expect(root).toBeInTheDocument();
    expect(
      container.querySelector("[data-slot='reg-progress-bar']")
    ).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Step 2 of 4")).toHaveClass("font-semibold");
    expect(root).toHaveTextContent("Step 2 of 4 · ID");
  });

  it("renders done, current and upcoming segments", () => {
    const { container } = render(<RegProgress step={2} total={4} label="ID" />);
    const segs = segments(container);
    expect(segs).toHaveLength(4);
    expect(segs.map((s) => s.getAttribute("data-state"))).toEqual([
      "done",
      "current",
      "todo",
      "todo",
    ]);
    expect(segs[0]).toHaveClass("bg-primary", "rounded");
    expect(segs[1]).toHaveClass("bg-primary/55");
    expect(segs[2]).toHaveClass("bg-border");
  });

  it("supports three steps", () => {
    const { container } = render(
      <RegProgress step={3} total={3} label="Deposit" />
    );
    expect(segments(container)).toHaveLength(3);
    expect(
      screen.getByRole("group", { name: "Step 3 of 3, Deposit" })
    ).toBeInTheDocument();
  });
});
