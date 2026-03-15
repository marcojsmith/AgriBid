import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Package } from "lucide-react";

import { StatCard } from "./StatCard";

describe("StatCard", () => {
  it("renders with required props", () => {
    render(
      <StatCard
        label="Total Sales"
        value={100}
        icon={<Package data-testid="icon" />}
      />
    );

    expect(screen.getByText("Total Sales")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("renders with string value", () => {
    render(<StatCard label="Status" value="Active" icon={<Package />} />);

    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders with custom color", () => {
    render(
      <StatCard
        label="Revenue"
        value={5000}
        icon={<Package />}
        color="text-green-500"
      />
    );

    const valueElement = screen.getByText("5000");
    expect(valueElement).toHaveClass("text-green-500");
  });

  it("renders with custom className", () => {
    render(
      <StatCard
        label="Test"
        value={42}
        icon={<Package />}
        className="custom-class"
      />
    );

    const card = screen.getByText("Test").closest(".border-2");
    expect(card).toHaveClass("custom-class");
  });

  it("renders with p-2 padding", () => {
    render(
      <StatCard label="Test" value={42} icon={<Package />} padding="p-2" />
    );

    const card = screen.getByText("Test").closest(".border-2");
    expect(card).toHaveClass("p-2");
  });

  it("renders with p-6 padding", () => {
    render(
      <StatCard label="Test" value={42} icon={<Package />} padding="p-6" />
    );

    const card = screen.getByText("Test").closest(".border-2");
    expect(card).toHaveClass("p-6");
  });

  it("renders with default padding", () => {
    render(<StatCard label="Test" value={42} icon={<Package />} />);

    const card = screen.getByText("Test").closest(".border-2");
    expect(card).toHaveClass("p-4");
  });

  it("renders with bg-card/50 variant", () => {
    render(
      <StatCard
        label="Test"
        value={42}
        icon={<Package />}
        bgVariant="bg-card/50"
      />
    );

    const card = screen.getByText("Test").closest(".border-2");
    expect(card).toHaveClass("bg-card/50");
  });

  it("renders with h-8 w-8 icon size", () => {
    render(
      <StatCard label="Test" value={42} icon={<Package />} iconSize="h-8 w-8" />
    );

    const iconContainer = screen.getByText("42").parentElement?.nextSibling;
    expect(iconContainer).toHaveClass("h-8", "w-8");
  });

  it("renders with h-12 w-12 icon size", () => {
    render(
      <StatCard
        label="Test"
        value={42}
        icon={<Package />}
        iconSize="h-12 w-12"
      />
    );

    const iconContainer = screen.getByText("42").parentElement?.nextSibling;
    expect(iconContainer).toHaveClass("h-12", "w-12");
  });

  it("renders with default icon size", () => {
    render(<StatCard label="Test" value={42} icon={<Package />} />);

    const iconContainer = screen.getByText("42").parentElement?.nextSibling;
    expect(iconContainer).toHaveClass("h-10", "w-10");
  });

  it("renders with empty color when not provided", () => {
    render(<StatCard label="Test" value={42} icon={<Package />} />);

    const valueElement = screen.getByText("42");
    expect(valueElement).not.toHaveClass("text-");
  });

  it("renders icon in container", () => {
    render(
      <StatCard
        label="Test"
        value={42}
        icon={<Package data-testid="package-icon" />}
      />
    );

    expect(screen.getByTestId("package-icon")).toBeInTheDocument();
  });

  it("handles large numeric values", () => {
    render(<StatCard label="Total" value={999999} icon={<Package />} />);

    expect(screen.getByText("999999")).toBeInTheDocument();
  });

  it("handles zero value", () => {
    render(<StatCard label="Count" value={0} icon={<Package />} />);

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("renders with custom className overriding defaults", () => {
    render(
      <StatCard
        label="Test"
        value={42}
        icon={<Package />}
        className="mt-4 ml-2"
      />
    );

    const card = screen.getByText("Test").closest(".border-2");
    expect(card).toHaveClass("mt-4", "ml-2");
  });
});
