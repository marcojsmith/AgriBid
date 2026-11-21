import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { SegmentedControl } from "./SegmentedControl";

const OPTIONS = [
  { value: "live", label: "Live & upcoming", count: 4 },
  { value: "soon", label: "Closing soon" },
  { value: "results", label: "Results" },
] as const;

describe("SegmentedControl", () => {
  it("is a labelled radiogroup with the selected option checked", () => {
    render(
      <SegmentedControl
        options={OPTIONS}
        value="soon"
        onChange={vi.fn()}
        ariaLabel="Auction view"
      />
    );
    expect(
      screen.getByRole("radiogroup", { name: "Auction view" })
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Closing soon" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Closing soon" })).toHaveAttribute(
      "tabindex",
      "0"
    );
    expect(screen.getByRole("radio", { name: /Results/ })).toHaveAttribute(
      "tabindex",
      "-1"
    );
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("keeps the group reachable by keyboard when the value matches no option", () => {
    render(
      <SegmentedControl
        options={OPTIONS}
        value={"stale" as never}
        onChange={vi.fn()}
        ariaLabel="v"
      />
    );
    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toHaveAttribute("tabindex", "0");
    expect(radios[1]).toHaveAttribute("tabindex", "-1");
  });

  it("is 44px on phone", () => {
    render(
      <SegmentedControl
        options={OPTIONS}
        value="live"
        onChange={vi.fn()}
        ariaLabel="v"
      />
    );
    expect(screen.getAllByRole("radio")[0]).toHaveClass("min-h-11");
  });

  it("calls onChange on click", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        options={OPTIONS}
        value="live"
        onChange={onChange}
        ariaLabel="v"
      />
    );
    fireEvent.click(screen.getByRole("radio", { name: "Results" }));
    expect(onChange).toHaveBeenCalledWith("results");
  });

  it("moves with arrow keys and wraps around", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        options={OPTIONS}
        value="live"
        onChange={onChange}
        ariaLabel="v"
      />
    );
    const first = screen.getByRole("radio", { name: /Live/ });
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("soon");
    fireEvent.keyDown(first, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith("results");
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(onChange).toHaveBeenLastCalledWith("soon");
    fireEvent.keyDown(first, { key: "ArrowUp" });
    expect(onChange).toHaveBeenLastCalledWith("results");
    onChange.mockClear();
    fireEvent.keyDown(first, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });
});
