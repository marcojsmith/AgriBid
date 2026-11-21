import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { FilterChips } from "./FilterChips";

describe("FilterChips", () => {
  it("renders nothing without filters", () => {
    const { container } = render(
      <FilterChips filters={[]} onRemove={vi.fn()} onClear={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("removes a single filter and clears all", () => {
    const onRemove = vi.fn();
    const onClear = vi.fn();
    render(
      <FilterChips
        filters={[
          { key: "cat", label: "Tractors" },
          { key: "prov", label: "Free State" },
        ]}
        onRemove={onRemove}
        onClear={onClear}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Remove filter: Free State" })
    );
    expect(onRemove).toHaveBeenCalledWith("prov");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
