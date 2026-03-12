import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { AdminConnectionError } from "./AdminConnectionError";

describe("AdminConnectionError", () => {
  it("renders with default props", () => {
    render(<AdminConnectionError />);

    expect(screen.getByText("Connection Timeout")).toBeInTheDocument();
    expect(
      screen.getByText(
        "We're having trouble reaching the requested service. This could be due to a temporary network issue or high server load."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Retry Connection")).toBeInTheDocument();
  });

  it("renders with custom title and description", () => {
    render(
      <AdminConnectionError
        title="Custom Error"
        description="Custom error description"
      />
    );

    expect(screen.getByText("Custom Error")).toBeInTheDocument();
    expect(screen.getByText("Custom error description")).toBeInTheDocument();
  });

  it("calls onRetry when retry button is clicked", () => {
    const onRetry = vi.fn();
    render(<AdminConnectionError onRetry={onRetry} />);

    fireEvent.click(screen.getByText("Retry Connection"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders with sm icon size", () => {
    render(<AdminConnectionError iconSize="sm" />);

    expect(screen.getByText("Connection Timeout")).toBeInTheDocument();
  });

  it("renders with md icon size", () => {
    render(<AdminConnectionError iconSize="md" />);

    expect(screen.getByText("Connection Timeout")).toBeInTheDocument();
  });

  it("renders with lg icon size", () => {
    render(<AdminConnectionError iconSize="lg" />);

    expect(screen.getByText("Connection Timeout")).toBeInTheDocument();
  });

  it("renders with custom className", () => {
    render(<AdminConnectionError className="custom-class" />);

    const container = screen.getByRole("alert");
    expect(container).toHaveClass("custom-class");
  });

  it("has correct role attribute", () => {
    render(<AdminConnectionError />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders refresh icon", () => {
    render(<AdminConnectionError />);

    const refreshIcon = document.querySelector("svg.lucide-refresh-cw");
    expect(refreshIcon).toBeInTheDocument();
  });
});
