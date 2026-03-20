import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useQuery } from "convex/react";

import { FilterSidebar } from "./FilterSidebar";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

type ReactComponentType = React.ComponentType<unknown>;

const mockSetSearchParams = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  type ActualType = typeof actual;
  const typedActual = actual as ActualType & {
    useSearchParams: () => [URLSearchParams, typeof mockSetSearchParams];
  };
  return {
    ...typedActual,
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  };
});

vi.mock("./ui/select", () => {
  interface MockProps {
    children: React.ReactNode;
    onValueChange?: (v: string) => void;
    value?: string;
    placeholder?: string;
    "aria-label"?: string;
    "aria-labelledby"?: string;
    onClick?: () => void;
  }

  return {
    Select: ({ children, onValueChange, value }: MockProps) => (
      <div data-testid="mock-select" data-value={value}>
        {React.Children.map(children, (child) => {
          if (
            React.isValidElement(child) &&
            typeof child.type !== "string" &&
            (child.type as ReactComponentType).name === "SelectContent"
          ) {
            return React.cloneElement(
              child as React.ReactElement<{
                onValueChange?: (v: string) => void;
              }>,
              {
                onValueChange,
              }
            );
          }
          return child;
        })}
      </div>
    ),
    SelectTrigger: ({
      children,
      "aria-label": label,
      "aria-labelledby": labelledBy,
    }: MockProps) => (
      <button aria-label={label} aria-labelledby={labelledBy}>
        {children}
      </button>
    ),
    SelectValue: ({ placeholder }: MockProps) => <span>{placeholder}</span>,
    SelectContent: ({ children, onValueChange }: MockProps) => (
      <div data-testid="mock-select-content">
        {React.Children.map(children, (child) => {
          if (
            React.isValidElement(child) &&
            typeof child.type !== "string" &&
            (child.type as ReactComponentType).name === "SelectItem"
          ) {
            return React.cloneElement(
              child as React.ReactElement<{
                onClick?: () => void;
                value: string;
              }>,
              {
                onClick: () => {
                  const childProps = child.props as React.PropsWithChildren<{
                    value?: string;
                  }>;
                  return onValueChange?.(childProps.value ?? "");
                },
              }
            );
          }
          return child;
        })}
      </div>
    ),
    SelectItem: ({ children, value, onClick }: MockProps) => (
      <button data-testid={`select-item-${value}`} onClick={onClick}>
        {children}
      </button>
    ),
  };
});

describe("FilterSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    (useQuery as Mock).mockReturnValue(["John Deere", "Case IH"]);
  });

  const renderSidebar = (onClose?: () => void) => {
    return render(
      <BrowserRouter>
        <FilterSidebar onClose={onClose} />
      </BrowserRouter>
    );
  };

  it("updates minYear when a value is selected", () => {
    renderSidebar();
    const item = screen.getAllByTestId("select-item-2024")[0];
    fireEvent.click(item);

    fireEvent.click(screen.getByText(/Apply Filters/i));
    const calledWith = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(calledWith.get("minYear")).toBe("2024");
  });

  it("clears minYear when 'any' is selected", () => {
    mockSearchParams.set("minYear", "2024");
    renderSidebar();

    const anyItem = screen.getAllByTestId("select-item-any")[0]; // minYear 'any'
    fireEvent.click(anyItem);

    fireEvent.click(screen.getByText(/Apply Filters/i));
    const calledWith = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(calledWith.has("minYear")).toBe(false);
  });

  it("updates maxYear and handles 'any' selection", () => {
    renderSidebar();
    const item = screen.getAllByTestId("select-item-2022")[1]; // maxYear '2022'
    fireEvent.click(item);
    fireEvent.click(screen.getAllByTestId("select-item-any")[1]); // maxYear 'any'

    fireEvent.click(screen.getByText(/Apply Filters/i));
    const calledWith = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(calledWith.has("maxYear")).toBe(false);
  });

  it("updates minPrice and handles 'any' selection", () => {
    renderSidebar();
    fireEvent.click(screen.getByTestId("select-item-100000"));
    fireEvent.click(screen.getAllByTestId("select-item-any")[2]); // minPrice 'any'

    fireEvent.click(screen.getByText(/Apply Filters/i));
    const calledWith = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(calledWith.has("minPrice")).toBe(false);
  });

  it("updates maxPrice and handles 'any' selection", () => {
    renderSidebar();
    fireEvent.click(screen.getByTestId("select-item-5000000"));
    fireEvent.click(screen.getAllByTestId("select-item-any")[3]); // maxPrice 'any'

    fireEvent.click(screen.getByText(/Apply Filters/i));
    const calledWith = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(calledWith.has("maxPrice")).toBe(false);
  });

  it("updates maxHours and handles 'any' selection", () => {
    renderSidebar();
    fireEvent.click(screen.getByTestId("select-item-5000"));
    fireEvent.click(screen.getAllByTestId("select-item-any")[4]); // maxHours 'any'

    fireEvent.click(screen.getByText(/Apply Filters/i));
    const calledWith = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(calledWith.has("maxHours")).toBe(false);
  });

  it("renders all filter sections", () => {
    renderSidebar();
    expect(screen.getByText("Manufacturer")).toBeInTheDocument();
    expect(screen.getByText("Year Model")).toBeInTheDocument();
    expect(screen.getByText("Price Range (ZAR)")).toBeInTheDocument();
    expect(screen.getByText("Max Operating Hours")).toBeInTheDocument();
    expect(screen.getByText("Auction Status")).toBeInTheDocument();
  });

  it("renders manufacturer select with correct options", () => {
    renderSidebar();
    const select = screen.getByLabelText(/Manufacturer/i);
    expect(select).toBeInTheDocument();
    expect(screen.getByText("All Manufacturers")).toBeInTheDocument();
    expect(screen.getByText("John Deere")).toBeInTheDocument();
  });

  it("renders auction status select with correct options", () => {
    renderSidebar();
    const select = screen.getByLabelText(/Auction Status/i);
    expect(select).toBeInTheDocument();
    expect(screen.getByText("Active Auctions")).toBeInTheDocument();
    expect(screen.getByText("Closed Auctions")).toBeInTheDocument();
  });

  it("applies filters when Apply button is clicked", () => {
    const onClose = vi.fn();
    renderSidebar(onClose);

    fireEvent.click(screen.getByText(/Apply Filters/i));

    expect(mockSetSearchParams).toHaveBeenCalled();
  });

  it("clears filters when Reset button is clicked", () => {
    mockSearchParams.set("minPrice", "5000");
    renderSidebar();

    fireEvent.click(screen.getByText(/Reset/i));

    expect(mockSetSearchParams).toHaveBeenCalled();
    const calledWith = mockSetSearchParams.mock
      .calls[0]?.[0] as URLSearchParams;
    expect(calledWith.get("minPrice")).toBeNull();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    renderSidebar(onClose);

    fireEvent.click(screen.getByLabelText(/Close filters/i));
    expect(onClose).toHaveBeenCalled();
  });

  it("initializes with local filters from search params", () => {
    mockSearchParams.set("status", "closed");
    mockSearchParams.set("make", "John Deere");
    renderSidebar();

    expect(screen.getByText("Auction Status")).toBeInTheDocument();
    const select = screen.getByLabelText(/Manufacturer/i);
    expect(select).toHaveTextContent("John Deere");
  });

  it("applyFilters deletes status if it is 'active'", () => {
    renderSidebar();
    fireEvent.click(screen.getByText(/Apply Filters/i));

    const calledWith = mockSetSearchParams.mock
      .calls[0]?.[0] as URLSearchParams;
    expect(calledWith.has("status")).toBe(false);
  });

  it("applyFilters deletes empty values", () => {
    // Set an empty value in mockSearchParams
    mockSearchParams.set("make", "");
    mockSearchParams.set("minYear", "2020");
    renderSidebar();

    // Click apply
    fireEvent.click(screen.getByText(/Apply Filters/i));

    const calledWith = mockSetSearchParams.mock
      .calls[0]?.[0] as URLSearchParams;
    // Empty values should be removed
    expect(calledWith.has("make")).toBe(false);
    // Non-empty values should stay
    expect(calledWith.get("minYear")).toBe("2020");
  });

  it("clearFilters preserves search query 'q'", () => {
    mockSearchParams.set("q", "tractor");
    mockSearchParams.set("make", "JD");
    renderSidebar();

    fireEvent.click(screen.getByText(/Reset/i));

    const calledWith = mockSetSearchParams.mock
      .calls[0]?.[0] as URLSearchParams;
    expect(calledWith.get("q")).toBe("tractor");
    expect(calledWith.has("make")).toBe(false);
  });

  it("disables reset button when no filters are active", () => {
    renderSidebar();
    const resetButton = screen.getByRole("button", { name: /reset/i });
    expect(resetButton).toBeDisabled();
  });

  it("handles applyFilters and clearFilters without onClose callback", () => {
    renderSidebar();

    fireEvent.click(screen.getByText(/Apply Filters/i));
    expect(mockSetSearchParams).toHaveBeenCalled();

    fireEvent.click(screen.getByText(/Reset/i));
  });

  it("handles undefined activeMakes", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    renderSidebar();
    expect(screen.getByText("All Manufacturers")).toBeInTheDocument();
  });

  it("does not render close button when onClose is missing", () => {
    renderSidebar();
    expect(screen.queryByLabelText(/Close filters/i)).not.toBeInTheDocument();
  });

  it("renders select triggers for all filters with accessible labels", () => {
    renderSidebar();
    expect(screen.getByLabelText(/Manufacturer/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Minimum year/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Maximum year/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Minimum price/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Maximum price/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Max Operating Hours/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Auction Status/i)).toBeInTheDocument();
  });

  it("updates local state when manufacturer changes", () => {
    renderSidebar();
    const select = screen.getByLabelText(/Manufacturer/i);
    fireEvent.change(select, { target: { value: "John Deere" } });

    fireEvent.click(screen.getByText(/Apply Filters/i));
    const calledWith = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(calledWith.get("make")).toBe("John Deere");
  });

  it("updates local state when auction status changes", () => {
    renderSidebar();
    const select = screen.getByLabelText(/Auction Status/i);
    fireEvent.change(select, { target: { value: "closed" } });

    fireEvent.click(screen.getByText(/Apply Filters/i));
    const calledWith = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(calledWith.get("status")).toBe("closed");
  });
  // requires more complex interaction if they are not mocked.
  // We can at least try to trigger the onValueChange if we can find the right way.
});
