import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PhotoAngleList } from "./PhotoAngleList";

describe("PhotoAngleList", () => {
  it("renders nothing when no photos are uploaded", () => {
    const { container } = render(
      <PhotoAngleList photos={[]} angles={undefined} onChange={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("offers the fixed shot list per photo", () => {
    render(
      <PhotoAngleList
        photos={[{ ref: "s1", label: "Front 45° View" }]}
        angles={{ s1: "front" }}
        onChange={vi.fn()}
      />
    );
    const select = screen.getByLabelText("Angle for Front 45° View");
    expect(select).toHaveValue("front");
    expect(
      screen.getByRole("option", { name: "Serial plate (optional)" })
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Cab interior" })).toBeVisible();
  });

  it("reports a chosen angle and a cleared one", () => {
    const onChange = vi.fn();
    render(
      <PhotoAngleList
        photos={[{ ref: "s1", label: "Additional 1" }]}
        angles={undefined}
        onChange={onChange}
      />
    );
    const select = screen.getByLabelText("Angle for Additional 1");
    expect(select).toHaveValue("");
    fireEvent.change(select, { target: { value: "tyres" } });
    expect(onChange).toHaveBeenLastCalledWith("s1", "tyres");
    fireEvent.change(select, { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith("s1", undefined);
  });
});
