import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SortControl } from "./SortControl";

const media = vi.hoisted(() => ({ desktop: false }));
vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: () => media.desktop,
}));

describe("SortControl", () => {
  beforeEach(() => {
    media.desktop = false;
  });

  it("shows the count and the current sort", () => {
    render(
      <SortControl countText="85 lots" value="lot_number" onChange={vi.fn()} />
    );
    expect(screen.getByText("85 lots")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Sort: Lot number/ })
    ).toBeVisible();
  });

  it("opens a sheet on phones and picks an option", () => {
    const onChange = vi.fn();
    render(
      <SortControl countText="4 lots" value="lot_number" onChange={onChange} />
    );
    fireEvent.click(screen.getByRole("button", { name: /Sort: Lot number/ }));
    expect(screen.getByRole("radio", { name: "Lot number" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    fireEvent.click(screen.getByRole("radio", { name: "Most watched" }));
    expect(onChange).toHaveBeenCalledWith("most_watched");
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("opens a menu on desktop and picks an option", async () => {
    media.desktop = true;
    const onChange = vi.fn();
    render(
      <SortControl countText="4 lots" value="price_asc" onChange={onChange} />
    );
    const trigger = screen.getByRole("button", {
      name: /Sort: Price low–high/,
    });
    fireEvent.keyDown(trigger, { key: "Enter", code: "Enter" });
    const item = await screen.findByRole("menuitemradio", {
      name: "Most watched",
    });
    fireEvent.click(item);
    expect(onChange).toHaveBeenCalledWith("most_watched");
  });
});
