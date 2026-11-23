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

  it("renders the opening date in South African time", () => {
    render(
      <StatusBadge
        status={{ kind: "opens", startTime: Date.UTC(2025, 10, 22, 8, 0) }}
      />
    );
    expect(screen.getByText("Opens Sat 22 Nov, 10:00")).toBeInTheDocument();
  });

  it("renders the relative opening time and the closed state", () => {
    const { rerender } = render(
      <StatusBadge
        status={{ kind: "opens", startTime: 1, relative: "3d 4h" }}
      />
    );
    expect(screen.getByText("Opens in 3d 4h")).toBeInTheDocument();
    rerender(<StatusBadge status={{ kind: "closed" }} />);
    expect(
      screen.getByText("Closed").closest("[data-slot=status-badge]")
    ).toHaveAttribute("data-tone", "passed");
  });

  it("uses the soon tone for closing soon and urgent inside the last 10 minutes", () => {
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

  it("renders Sold, Not sold and Under consideration with text labels", () => {
    const { rerender } = render(<StatusBadge status={{ kind: "sold" }} />);
    expect(screen.getByText("Sold")).toBeInTheDocument();
    rerender(<StatusBadge status={{ kind: "passed" }} />);
    expect(screen.getByText("Not sold")).toBeInTheDocument();
    rerender(<StatusBadge status={{ kind: "under-consideration" }} />);
    expect(screen.getByText("Under consideration")).toBeInTheDocument();
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
