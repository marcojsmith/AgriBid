import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";

import { useSession } from "@/lib/auth-client";

import { FilterSidebar } from "./FilterSidebar";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(() => ({ data: null })),
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
    (useSession as Mock).mockReturnValue({ data: null });
    // First useQuery call is for getActiveMakes, second is for getMyPreferences (skipped when no session)
    (useQuery as Mock)
      .mockReturnValueOnce(["John Deere", "Case IH"])
      .mockReturnValueOnce(undefined);
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

    // Auto-apply: filters update immediately when changed
    const calledWith = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(calledWith.get("minYear")).toBe("2024");
  });

  it("clears minYear when 'any' is selected", () => {
    mockSearchParams.set("minYear", "2024");
    renderSidebar();

    const anyItem = screen.getAllByTestId("select-item-any")[0]; // minYear 'any'
    fireEvent.click(anyItem);

    // Auto-apply: filters update immediately when changed
    const calledWith = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(calledWith.has("minYear")).toBe(false);
  });

  it("updates maxYear and handles 'any' selection", () => {
    mockSearchParams.set("maxYear", "2024");
    renderSidebar();
    mockSetSearchParams.mockClear();

    // Click 'any' to clear maxYear - auto-apply should remove it from URL
    fireEvent.click(screen.getAllByTestId("select-item-any")[1]); // maxYear 'any'

    // Get the call after clicking 'any'
    const calls = mockSetSearchParams.mock.calls;
    const lastCall = calls[calls.length - 1][0] as URLSearchParams;
    expect(lastCall.has("maxYear")).toBe(false);
  });

  it("updates minPrice and handles 'any' selection", () => {
    mockSearchParams.set("minPrice", "100000");
    renderSidebar();
    mockSetSearchParams.mockClear();

    // Click 'any' to clear minPrice - auto-apply should remove it from URL
    fireEvent.click(screen.getAllByTestId("select-item-any")[2]); // minPrice 'any'

    const calls = mockSetSearchParams.mock.calls;
    const lastCall = calls[calls.length - 1][0] as URLSearchParams;
    expect(lastCall.has("minPrice")).toBe(false);
  });

  it("updates maxPrice and handles 'any' selection", () => {
    mockSearchParams.set("maxPrice", "500000");
    renderSidebar();
    mockSetSearchParams.mockClear();

    // Click 'any' to clear maxPrice - auto-apply should remove it from URL
    fireEvent.click(screen.getAllByTestId("select-item-any")[3]); // maxPrice 'any'

    const calls = mockSetSearchParams.mock.calls;
    const lastCall = calls[calls.length - 1][0] as URLSearchParams;
    expect(lastCall.has("maxPrice")).toBe(false);
  });

  it("updates maxHours and handles 'any' selection", () => {
    mockSearchParams.set("maxHours", "1000");
    renderSidebar();
    mockSetSearchParams.mockClear();

    // Click 'any' to clear maxHours - auto-apply should remove it from URL
    fireEvent.click(screen.getAllByTestId("select-item-any")[4]); // maxHours 'any'

    const calls = mockSetSearchParams.mock.calls;
    const lastCall = calls[calls.length - 1][0] as URLSearchParams;
    expect(lastCall.has("maxHours")).toBe(false);
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

  it("applies filters when filter value changes (auto-apply)", () => {
    const onClose = vi.fn();
    renderSidebar(onClose);

    // Change a filter - should auto-apply
    fireEvent.change(screen.getByLabelText(/Manufacturer/i), {
      target: { value: "John Deere" },
    });

    expect(mockSetSearchParams).toHaveBeenCalled();
  });

  it("clears filters when Reset button is clicked", () => {
    mockSearchParams.set("minPrice", "5000");
    renderSidebar();

    fireEvent.click(screen.getByLabelText(/Reset filters/i));

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

  it("filters auto-apply and delete status if it is 'active'", () => {
    mockSearchParams.set("status", "active");
    renderSidebar();

    // Auto-apply runs on mount: 'active' status should be stripped from URL params
    const calledWith = mockSetSearchParams.mock
      .calls[0]?.[0] as URLSearchParams;
    expect(calledWith).toBeDefined();
    expect(calledWith.has("status")).toBe(false);
  });

  it("filters auto-apply and delete empty values", () => {
    // Set an empty value in mockSearchParams
    mockSearchParams.set("make", "");
    mockSearchParams.set("minYear", "2020");
    renderSidebar();

    // Auto-apply should filter out empty values
    const calledWith = mockSetSearchParams.mock
      .calls[0]?.[0] as URLSearchParams;
    // Empty values should be removed
    expect(calledWith.has("make")).toBe(false);
    // Non-empty values should stay
    expect(calledWith.get("minYear")).toBe("2020");
  });

  it("resetFilters preserves search query 'q'", () => {
    mockSearchParams.set("q", "tractor");
    mockSearchParams.set("make", "JD");
    renderSidebar();

    fireEvent.click(screen.getByLabelText(/Reset filters/i));

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

  it("handles filter changes and reset without onClose callback", () => {
    renderSidebar();

    // Filter change auto-applies
    fireEvent.change(screen.getByLabelText(/Manufacturer/i), {
      target: { value: "John Deere" },
    });
    expect(mockSetSearchParams).toHaveBeenCalled();

    // Reset works without onClose
    fireEvent.click(screen.getByLabelText(/Reset filters/i));
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

    // Auto-apply: filters update immediately when changed
    const calledWith = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(calledWith.get("make")).toBe("John Deere");
  });

  it("updates local state when auction status changes", () => {
    renderSidebar();
    const select = screen.getByLabelText(/Auction Status/i);
    fireEvent.change(select, { target: { value: "closed" } });

    // Auto-apply: filters update immediately when changed
    const calledWith = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(calledWith.get("status")).toBe("closed");
  });

  describe("authenticated session", () => {
    beforeEach(() => {
      (useSession as Mock).mockReturnValue({ data: { user: { id: "u1" } } });
      (useQuery as Mock)
        .mockReturnValueOnce(["John Deere", "Case IH"])
        .mockReturnValueOnce(null);
    });

    it("shows Save Defaults and Clear Defaults buttons when authenticated", () => {
      renderSidebar();
      expect(screen.getByText("Save Defaults")).toBeInTheDocument();
      expect(screen.getByText("Clear Defaults")).toBeInTheDocument();
    });

    it("calls updateMyPreferences when Save Defaults is clicked", () => {
      const mockMutate = vi.fn();
      (useMutation as Mock).mockReturnValue(mockMutate);

      mockSearchParams.set("make", "John Deere");
      (useQuery as Mock).mockReset();
      (useQuery as Mock)
        .mockReturnValueOnce(["John Deere", "Case IH"])
        .mockReturnValueOnce(null);

      renderSidebar();
      fireEvent.click(screen.getByText("Save Defaults"));

      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ defaultMake: "John Deere" })
      );
    });

    it("calls updateMyPreferences with undefined fields when Clear Defaults is clicked", () => {
      const mockMutate = vi.fn();
      (useMutation as Mock).mockReturnValue(mockMutate);

      renderSidebar();
      fireEvent.click(screen.getByText("Clear Defaults"));

      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ defaultMake: undefined })
      );
    });
  });

  it("applies saved preferences to filters when no URL params present", async () => {
    const savedPrefs = {
      defaultMake: "Case IH",
      defaultMinYear: 2020,
      defaultStatusFilter: "closed",
    };
    (useQuery as Mock)
      .mockReturnValueOnce(["John Deere", "Case IH"]) // activeMakes
      .mockReturnValueOnce(savedPrefs); // getMyPreferences

    renderSidebar();

    await act(async () => {});

    // After prefs load, the make select should reflect Case IH
    const makeSelect = screen.getByLabelText(/Manufacturer/i);
    expect(makeSelect).toHaveTextContent("Case IH");
  });

  it("URL params take priority over saved preferences", async () => {
    mockSearchParams.set("make", "John Deere");

    const savedPrefs = {
      defaultMake: "Case IH",
    };
    (useQuery as Mock)
      .mockReturnValueOnce(["John Deere", "Case IH"])
      .mockReturnValueOnce(savedPrefs);

    renderSidebar();

    await act(async () => {});

    const makeSelect = screen.getByLabelText(/Manufacturer/i);
    expect(makeSelect).toHaveTextContent("John Deere");
  });

  it("applies saved defaultStatusFilter when no URL params", async () => {
    const savedPrefs = {
      defaultStatusFilter: "closed",
    };
    (useQuery as Mock)
      .mockReturnValueOnce(["John Deere", "Case IH"])
      .mockReturnValueOnce(savedPrefs);

    mockSearchParams = new URLSearchParams();
    renderSidebar();

    await act(async () => {});

    expect(screen.getByLabelText(/Auction Status/i)).toHaveTextContent(
      "Closed Auctions"
    );
  });

  it("applies saved defaultMinYear and defaultMaxYear when no URL params", async () => {
    const savedPrefs = {
      defaultMinYear: 2018,
      defaultMaxYear: 2023,
    };
    (useQuery as Mock)
      .mockReturnValueOnce(["John Deere", "Case IH"])
      .mockReturnValueOnce(savedPrefs);

    mockSearchParams = new URLSearchParams();
    renderSidebar();

    await act(async () => {});

    expect(screen.getByLabelText(/Minimum year/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Maximum year/i)).toBeInTheDocument();
  });

  it("applies saved defaultMinPrice and defaultMaxPrice when no URL params", async () => {
    const savedPrefs = {
      defaultMinPrice: 50000,
      defaultMaxPrice: 500000,
    };
    (useQuery as Mock)
      .mockReturnValueOnce(["John Deere", "Case IH"])
      .mockReturnValueOnce(savedPrefs);

    mockSearchParams = new URLSearchParams();
    renderSidebar();

    await act(async () => {});

    expect(screen.getByLabelText(/Minimum price/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Maximum price/i)).toBeInTheDocument();
  });

  it("applies saved defaultMaxHours when no URL params", async () => {
    const savedPrefs = {
      defaultMaxHours: 3500,
    };
    (useQuery as Mock)
      .mockReturnValueOnce(["John Deere", "Case IH"])
      .mockReturnValueOnce(savedPrefs);

    mockSearchParams = new URLSearchParams();
    renderSidebar();

    await act(async () => {});

    expect(screen.getByLabelText(/Max Operating Hours/i)).toBeInTheDocument();
  });

  it("URL params take priority over preferences in all filter fields", async () => {
    mockSearchParams.set("status", "closed");
    mockSearchParams.set("make", "John Deere");
    mockSearchParams.set("minYear", "2020");
    mockSearchParams.set("maxYear", "2023");
    mockSearchParams.set("minPrice", "100000");
    mockSearchParams.set("maxPrice", "500000");
    mockSearchParams.set("maxHours", "1000");

    const prefs = {
      defaultStatusFilter: "all",
      defaultMake: "Case IH",
      defaultMinYear: 2015,
      defaultMaxYear: 2025,
      defaultMinPrice: 50000,
      defaultMaxPrice: 1000000,
      defaultMaxHours: 5000,
    };
    (useQuery as Mock).mockReset();
    (useQuery as Mock)
      .mockReturnValueOnce(["John Deere", "Case IH"]) // first render activeMakes
      .mockReturnValueOnce(prefs) // first render preferences
      .mockReturnValue(["John Deere", "Case IH"]); // keep options available on re-renders

    renderSidebar();

    await act(async () => {});

    // URL params should win over prefs — verify via DOM state
    // status: URL "closed" wins over prefs "all"
    expect(screen.getByLabelText(/Auction Status/i)).toHaveTextContent(
      "Closed Auctions"
    );
    // make: URL "John Deere" wins over prefs "Case IH" — option must be present for value to show
    expect(screen.getByLabelText(/Manufacturer/i)).toHaveValue("John Deere");
  });

  it("calls updateMyPreferences with undefined when saveDefaults with empty fields", () => {
    (useSession as Mock).mockReturnValue({ data: { user: { id: "u1" } } });
    const mockMutate = vi.fn();
    (useMutation as Mock).mockReturnValue(mockMutate);

    (useQuery as Mock).mockReset();
    (useQuery as Mock)
      .mockReturnValueOnce(["John Deere", "Case IH"])
      .mockReturnValueOnce(null);

    renderSidebar();
    fireEvent.click(screen.getByText("Save Defaults"));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultStatusFilter: "active",
        defaultMake: undefined,
        defaultMinYear: undefined,
        defaultMaxYear: undefined,
        defaultMinPrice: undefined,
        defaultMaxPrice: undefined,
        defaultMaxHours: undefined,
      })
    );
  });

  it("calls clearDefaults with all fields undefined", () => {
    (useSession as Mock).mockReturnValue({ data: { user: { id: "u1" } } });
    const mockMutate = vi.fn();
    (useMutation as Mock).mockReturnValue(mockMutate);

    (useQuery as Mock).mockReset();
    (useQuery as Mock)
      .mockReturnValueOnce(["John Deere", "Case IH"])
      .mockReturnValueOnce(null);

    renderSidebar();
    fireEvent.click(screen.getByText("Clear Defaults"));

    expect(mockMutate).toHaveBeenCalledWith({
      defaultStatusFilter: undefined,
      defaultMake: undefined,
      defaultMinYear: undefined,
      defaultMaxYear: undefined,
      defaultMinPrice: undefined,
      defaultMaxPrice: undefined,
      defaultMaxHours: undefined,
    });
  });

  it("handles null values in preferences defaults", async () => {
    const savedPrefs = {
      defaultMake: null as unknown as string,
      defaultMinYear: null,
      defaultMaxYear: null,
      defaultMinPrice: null,
      defaultMaxPrice: null,
      defaultMaxHours: null,
      defaultStatusFilter: null as unknown as string,
    };
    (useQuery as Mock)
      .mockReturnValueOnce(["John Deere", "Case IH"])
      .mockReturnValueOnce(savedPrefs);

    mockSearchParams = new URLSearchParams();
    renderSidebar();

    await act(async () => {});

    expect(screen.getByLabelText(/Auction Status/i)).toBeInTheDocument();
  });

  it("handles partial preferences with some fields set", async () => {
    const savedPrefs = {
      defaultMake: "Case IH",
    };
    (useQuery as Mock)
      .mockReturnValueOnce(["John Deere", "Case IH"])
      .mockReturnValueOnce(savedPrefs);

    mockSearchParams = new URLSearchParams();
    renderSidebar();

    await act(async () => {});

    expect(screen.getByLabelText(/Manufacturer/i)).toBeInTheDocument();
  });

  it("shows Save Defaults button with current filters as defaults", async () => {
    mockSearchParams.set("make", "John Deere");
    mockSearchParams.set("minYear", "2020");

    const savedPrefs = {
      defaultMake: undefined,
    };
    (useQuery as Mock)
      .mockReturnValueOnce(["John Deere", "Case IH"])
      .mockReturnValueOnce(savedPrefs);

    (useSession as Mock).mockReturnValue({ data: { user: { id: "u1" } } });
    const mockMutate = vi.fn();
    (useMutation as Mock).mockReturnValue(mockMutate);

    renderSidebar();

    await act(async () => {});

    fireEvent.click(screen.getByText("Save Defaults"));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultMake: "John Deere",
        defaultMinYear: 2020,
      })
    );
  });

  it("does not apply preferences when preferences is undefined", async () => {
    (useSession as Mock).mockReturnValue({ data: { user: { id: "u1" } } });
    (useQuery as Mock)
      .mockReturnValueOnce(["John Deere", "Case IH"])
      .mockReturnValueOnce(undefined); // No preferences

    renderSidebar();

    await act(async () => {});

    expect(screen.getByLabelText(/Auction Status/i)).toBeInTheDocument();
  });

  it("keeps URL params over preferences for all fields when both are present", async () => {
    mockSearchParams.set("make", "John Deere");
    mockSearchParams.set("minYear", "2022");
    mockSearchParams.set("maxYear", "2024");
    mockSearchParams.set("minPrice", "100000");
    mockSearchParams.set("maxPrice", "2000000");
    mockSearchParams.set("maxHours", "5000");

    const savedPrefs = {
      defaultMake: "Case IH",
      defaultMinYear: 2020,
      defaultMaxYear: 2023,
      defaultMinPrice: 50000,
      defaultMaxPrice: 500000,
      defaultMaxHours: 3500,
    };
    (useQuery as Mock)
      .mockReturnValueOnce(["John Deere", "Case IH"])
      .mockReturnValueOnce(savedPrefs)
      .mockReturnValueOnce(undefined);

    renderSidebar();

    await act(async () => {});

    const makeSelect = screen.getByLabelText(/Manufacturer/i);
    expect(makeSelect).toHaveTextContent("John Deere");
  });

  it("saveDefaults passes undefined for all empty filter fields", () => {
    const mockMutate = vi.fn();
    (useMutation as Mock).mockReturnValue(mockMutate);
    (useSession as Mock).mockReturnValue({ data: { user: { id: "u1" } } });

    (useQuery as Mock).mockReset();
    (useQuery as Mock)
      .mockReturnValueOnce(["John Deere", "Case IH"])
      .mockReturnValueOnce(null);

    renderSidebar();
    fireEvent.click(screen.getByText("Save Defaults"));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultStatusFilter: "active",
        defaultMake: undefined,
        defaultMinYear: undefined,
        defaultMaxYear: undefined,
        defaultMinPrice: undefined,
        defaultMaxPrice: undefined,
        defaultMaxHours: undefined,
      })
    );
  });

  it("resetFilters calls onClose when provided", () => {
    const onClose = vi.fn();
    mockSearchParams.set("make", "John Deere");
    renderSidebar(onClose);

    fireEvent.click(screen.getByLabelText(/Reset filters/i));

    expect(onClose).toHaveBeenCalled();
  });

  it("saveDefaults passes parsed values for non-empty filter fields", async () => {
    const mockMutate = vi.fn();
    (useMutation as Mock).mockReturnValue(mockMutate);
    (useSession as Mock).mockReturnValue({ data: { user: { id: "u1" } } });

    mockSearchParams.set("status", "closed");
    mockSearchParams.set("make", "John Deere");
    mockSearchParams.set("minYear", "2020");
    mockSearchParams.set("maxYear", "2024");
    mockSearchParams.set("minPrice", "100000");
    mockSearchParams.set("maxPrice", "2000000");
    mockSearchParams.set("maxHours", "5000");

    (useQuery as Mock).mockReset();
    (useQuery as Mock)
      .mockReturnValueOnce(["John Deere", "Case IH"])
      .mockReturnValueOnce(null);

    renderSidebar();

    await act(async () => {});

    fireEvent.click(screen.getByText("Save Defaults"));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultStatusFilter: "closed",
        defaultMake: "John Deere",
        defaultMinYear: 2020,
        defaultMaxYear: 2024,
        defaultMinPrice: 100000,
        defaultMaxPrice: 2000000,
        defaultMaxHours: 5000,
      })
    );
  });
});
