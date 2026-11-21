import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders Live with a dot and the live tone", () => {
    render(<StatusBadge status={{ kind: "live" }} />);
    const el = screen.getByText("Live").closest("[data-slot=status-badge]");
    expect(el).toHaveAttribute("data-tone", "live");
    expect(el).toHaveClass("bg-live-solid");
    expect(el?.textContent).toBe("●Live");
  });

  it("renders the opening date in SAST", () => {
    render(
      <StatusBadge
        status={{ kind: "opens", startTime: Date.UTC(2025, 10, 22, 8, 0) }}
      />
    );
    expect(
      screen.getByText("Opens Sat 22 Nov, 10:00 SAST")
    ).toBeInTheDocument();
  });

  it("uses the soon tone for closing soon and urgent inside the last hour", () => {
    const { rerender } = render(
      <StatusBadge status={{ kind: "closing-soon", urgent: false }} />
    );
    expect(
      screen.getByText("Closing soon").closest("[data-slot=status-badge]")
    ).toHaveAttribute("data-tone", "soon");
    rerender(<StatusBadge status={{ kind: "closing-soon", urgent: true }} />);
    expect(
      screen.getByText("Closing soon").closest("[data-slot=status-badge]")
    ).toHaveAttribute("data-tone", "urgent");
  });

  it("renders Sold and Passed in with text labels", () => {
    const { rerender } = render(<StatusBadge status={{ kind: "sold" }} />);
    expect(screen.getByText("Sold")).toBeInTheDocument();
    rerender(<StatusBadge status={{ kind: "passed" }} />);
    expect(screen.getByText("Passed in")).toBeInTheDocument();
  });

  it("supports the soft variant", () => {
    render(<StatusBadge status={{ kind: "sold" }} variant="soft" />);
    expect(
      screen.getByText("Sold").closest("[data-slot=status-badge]")
    ).toHaveClass("bg-sold-soft", "text-sold-fg");
  });

  it("merges className", () => {
    render(<StatusBadge status={{ kind: "live" }} className="extra" />);
    expect(
      screen.getByText("Live").closest("[data-slot=status-badge]")
    ).toHaveClass("extra");
  });
});
