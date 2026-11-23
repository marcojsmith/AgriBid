import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { HomeFilters } from "./HomeFilters";

const base = {
  total: 85,
  categories: [
    { key: "c1", label: "Tractors", count: 48 },
    { key: "c2", label: "Implements", count: 22 },
  ],
  makes: [{ key: "Ford", label: "Ford", count: 8 }],
  priceRange: { min: 1000, max: 900000 },
  category: null,
  make: null,
  price: {},
  onCategory: vi.fn(),
  onMake: vi.fn(),
  onPrice: vi.fn(),
  onSearch: vi.fn(),
};

describe("HomeFilters", () => {
  it("shows All with the total, the categories and the makes with counts", () => {
    render(<HomeFilters {...base} />);
    expect(screen.getByRole("button", { name: "All 85" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Tractors 48" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Ford 8" })).toBeVisible();
  });

  it("selects and deselects a category and a make", () => {
    const onCategory = vi.fn();
    const onMake = vi.fn();
    const { rerender } = render(
      <HomeFilters {...base} onCategory={onCategory} onMake={onMake} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Tractors 48" }));
    expect(onCategory).toHaveBeenLastCalledWith("c1");
    fireEvent.click(screen.getByRole("button", { name: "Ford 8" }));
    expect(onMake).toHaveBeenLastCalledWith("Ford");
    fireEvent.click(screen.getByRole("button", { name: "All 85" }));
    expect(onCategory).toHaveBeenLastCalledWith(null);

    rerender(
      <HomeFilters
        {...base}
        category="c1"
        make="Ford"
        onCategory={onCategory}
        onMake={onMake}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Tractors 48" }));
    expect(onCategory).toHaveBeenLastCalledWith(null);
    fireEvent.click(screen.getByRole("button", { name: "Ford 8" }));
    expect(onMake).toHaveBeenLastCalledWith(null);
  });

  it("hides filters that have no options", () => {
    render(
      <HomeFilters
        {...base}
        categories={[]}
        makes={[]}
        priceRange={{ min: 500, max: 500 }}
      />
    );
    expect(screen.queryByRole("group", { name: "Makes" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Price/ })).toBeNull();
    expect(screen.getByRole("button", { name: "All 85" })).toBeVisible();
  });

  it("keeps the Price chip while a price filter is on so it can be cleared", () => {
    render(
      <HomeFilters
        {...base}
        priceRange={{ min: 500, max: 500 }}
        price={{ min: 100 }}
      />
    );
    expect(screen.getByRole("button", { name: /Price/ })).toBeVisible();
  });

  it("hides the Price chip without a price range", () => {
    render(<HomeFilters {...base} priceRange={null} />);
    expect(screen.queryByRole("button", { name: /Price/ })).toBeNull();
  });

  it("submits a trimmed search and ignores an empty one", () => {
    const onSearch = vi.fn();
    render(<HomeFilters {...base} onSearch={onSearch} />);
    const box = screen.getByRole("searchbox", { name: "Search make or model" });
    fireEvent.submit(box);
    expect(onSearch).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: "  John Deere " } });
    fireEvent.submit(box);
    expect(onSearch).toHaveBeenCalledWith("John Deere");
  });

  it("applies a price range from the sheet", () => {
    const onPrice = vi.fn();
    render(<HomeFilters {...base} onPrice={onPrice} />);
    fireEvent.click(screen.getByRole("button", { name: /Price/ }));
    expect(screen.getByText(/Current bids run from/)).toBeVisible();
    fireEvent.change(screen.getByLabelText("From (R)"), {
      target: { value: "10 000" },
    });
    fireEvent.change(screen.getByLabelText("To (R)"), {
      target: { value: "abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Show lots" }));
    expect(onPrice).toHaveBeenCalledWith({ min: 10000, max: undefined });
  });

  it("clears the price range", () => {
    const onPrice = vi.fn();
    render(<HomeFilters {...base} price={{ min: 5 }} onPrice={onPrice} />);
    expect(screen.getByRole("button", { name: /Price/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: /Price/ }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onPrice).toHaveBeenCalledWith({});
  });
});
