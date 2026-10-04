import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { BidFilters } from "./BidFilters";

// Radix's Tabs and Select are awkward to drive in JSDOM, so they are replaced
// with plain elements that forward their change handlers.
const { tabs, select } = vi.hoisted(() => ({
  tabs: { onValueChange: undefined as ((value: string) => void) | undefined },
  select: {
    onValueChange: undefined as ((value: string) => void) | undefined,
  },
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (value: string) => void;
  }) => {
    tabs.onValueChange = onValueChange;
    return (
      <div data-testid="tabs" data-value={value}>
        {children}
      </div>
    );
  },
  TabsList: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tabs-list">{children}</div>
  ),
  TabsTrigger: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => (
    <button type="button" onClick={() => tabs.onValueChange?.(value)}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (value: string) => void;
  }) => {
    select.onValueChange = onValueChange;
    return (
      <div data-testid="select" data-value={value}>
        {children}
      </div>
    );
  },
  SelectTrigger: ({
    children,
    "aria-label": ariaLabel,
  }: {
    children: React.ReactNode;
    "aria-label"?: string;
  }) => <div aria-label={ariaLabel}>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <option value={value}>{children}</option>,
}));

describe("BidFilters", () => {
  const renderFilters = (
    props: Partial<React.ComponentProps<typeof BidFilters>> = {}
  ) => {
    const onFilterChange = vi.fn();
    const onSortChange = vi.fn();
    render(
      <BidFilters
        filter="all"
        sortBy="ending"
        onFilterChange={onFilterChange}
        onSortChange={onSortChange}
        {...props}
      />
    );
    return { onFilterChange, onSortChange };
  };

  it("offers every status filter", () => {
    renderFilters();

    ["All", "Winning", "Outbid", "Ended"].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it("offers every sort order", () => {
    renderFilters();

    ["Ending Soon", "Recent Activity", "Highest Bid"].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it("marks the active filter", () => {
    renderFilters({ filter: "winning" });

    expect(screen.getByTestId("tabs")).toHaveAttribute("data-value", "winning");
  });

  it("reports the picked filter to the caller", () => {
    const { onFilterChange } = renderFilters();

    fireEvent.click(screen.getByText("Outbid"));

    expect(onFilterChange).toHaveBeenCalledWith("outbid");
  });

  it("reports the picked sort order to the caller", () => {
    const { onSortChange } = renderFilters();

    select.onValueChange?.("bid");

    expect(onSortChange).toHaveBeenCalledWith("bid");
  });

  it("keeps the select labelled for assistive technology", () => {
    renderFilters();

    expect(screen.getByLabelText("Sort bids")).toBeInTheDocument();
  });
});
