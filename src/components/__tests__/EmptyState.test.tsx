import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Package } from "lucide-react";

import { EmptyState } from "../admin/EmptyState";

describe("EmptyState", () => {
  it("renders with required props", () => {
    render(
      <EmptyState label="No Items" icon={<Package data-testid="icon" />} />
    );

    expect(screen.getByText("No Items")).toBeInTheDocument();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("renders with default subtitle", () => {
    render(<EmptyState label="No Items" icon={<Package />} />);

    expect(
      screen.getByText("Operational Equilibrium Reached")
    ).toBeInTheDocument();
  });

  it("renders with custom subtitle", () => {
    render(
      <EmptyState
        label="No Items"
        icon={<Package />}
        subtitle="Custom Message"
      />
    );

    expect(screen.getByText("Custom Message")).toBeInTheDocument();
  });
});
