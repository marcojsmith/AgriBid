import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PROVINCES } from "@/lib/provinces";

import { ProvinceSelect } from "./ProvinceSelect";

describe("ProvinceSelect", () => {
  it("lists all nine provinces plus a placeholder", () => {
    render(<ProvinceSelect id="p" value={undefined} onChange={vi.fn()} />);
    expect(screen.getAllByRole("option")).toHaveLength(PROVINCES.length + 1);
    expect(screen.getByRole("combobox")).toHaveValue("");
  });

  it("reflects the selected province and reports changes", () => {
    const onChange = vi.fn();
    render(<ProvinceSelect id="p" value="gauteng" onChange={onChange} />);
    const select = screen.getByRole("combobox");
    expect(select).toHaveValue("gauteng");

    fireEvent.change(select, { target: { value: "limpopo" } });
    expect(onChange).toHaveBeenCalledWith("limpopo");
  });

  it("ignores values that are not provinces", () => {
    const onChange = vi.fn();
    render(<ProvinceSelect id="p" value="gauteng" onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "" },
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
