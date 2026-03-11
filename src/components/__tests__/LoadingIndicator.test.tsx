import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { LoadingIndicator, LoadingPage } from "../LoadingIndicator";

describe("LoadingIndicator", () => {
  it("renders with default size (md)", () => {
    render(<LoadingIndicator />);
    const spinner = screen.getByRole("status");
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass("h-12", "w-12");
  });

  it("renders with small size", () => {
    render(<LoadingIndicator size="sm" />);
    const spinner = screen.getByRole("status");
    expect(spinner).toHaveClass("h-6", "w-6");
  });

  it("renders with large size", () => {
    render(<LoadingIndicator size="lg" />);
    const spinner = screen.getByRole("status");
    expect(spinner).toHaveClass("h-16", "w-16");
  });

  it("applies custom className", () => {
    render(<LoadingIndicator className="custom-class" />);
    const spinner = screen.getByRole("status");
    expect(spinner).toHaveClass("custom-class");
  });

  it("has proper accessibility attributes", () => {
    render(<LoadingIndicator />);
    const spinner = screen.getByRole("status");
    expect(spinner).toHaveAttribute("aria-label", "Loading");
    expect(screen.getByText("Loading...")).toHaveClass("sr-only");
  });
});

describe("LoadingPage", () => {
  it("renders with default message", () => {
    render(<LoadingPage />);
    expect(screen.getByText("AGRIBID LOADING...")).toBeInTheDocument();
  });

  it("renders with custom message", () => {
    render(<LoadingPage message="Loading data..." />);
    expect(screen.getByText("Loading data...")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<LoadingPage className="custom-page" />);
    const container = screen.getByRole("status");
    expect(container).toHaveClass("custom-page");
  });

  it("has proper accessibility attributes", () => {
    render(<LoadingPage message="Please wait" />);
    const container = screen.getByRole("status");
    expect(container).toHaveAttribute("aria-live", "polite");
    expect(container).toHaveAttribute("aria-label", "Please wait");
  });
});
