import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";

import { SummaryCard } from "./SummaryCard";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
  };
});

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe("SummaryCard", () => {
  const mockProps = {
    title: "Test Title",
    icon: <span data-testid="icon">Icon</span>,
    stats: [
      { label: "Label 1", value: 100 },
      { label: "Label 2", value: "200", color: "text-green-500" },
    ],
    link: "/test-link",
    linkLabel: "View Details",
  };

  it("renders title correctly", () => {
    renderWithRouter(<SummaryCard {...mockProps} />);
    expect(screen.getByText("Test Title")).toBeInTheDocument();
  });

  it("renders icon", () => {
    renderWithRouter(<SummaryCard {...mockProps} />);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("renders all stats", () => {
    renderWithRouter(<SummaryCard {...mockProps} />);
    expect(screen.getByText("Label 1")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("Label 2")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  it("renders link with label", () => {
    renderWithRouter(<SummaryCard {...mockProps} />);
    expect(screen.getByText("View Details")).toBeInTheDocument();
  });

  it("applies custom color to stat value", () => {
    renderWithRouter(<SummaryCard {...mockProps} />);
    const valueElement = screen.getByText("200");
    expect(valueElement).toHaveClass("text-green-500");
  });

  it("renders with custom className", () => {
    renderWithRouter(<SummaryCard {...mockProps} className="custom-class" />);
    const card = screen
      .getByText("Test Title")
      .closest("div[class*='border-2']");
    expect(card).toHaveClass("custom-class");
  });

  it("renders empty stats array", () => {
    renderWithRouter(<SummaryCard {...mockProps} stats={[]} />);
    expect(screen.getByText("Test Title")).toBeInTheDocument();
  });

  it("handles numeric and string values", () => {
    renderWithRouter(
      <SummaryCard
        {...mockProps}
        stats={[
          { label: "Numeric", value: 42 },
          { label: "String", value: "hello" },
        ]}
      />
    );
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});
