import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LotProvinceDialog } from "./LotProvinceDialog";

const lot = { _id: "l1", title: "John Deere 8R", province: undefined };

describe("LotProvinceDialog", () => {
  it("renders nothing when no lot is selected", () => {
    render(
      <LotProvinceDialog
        lot={null}
        isSaving={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onClear={vi.fn()}
      />
    );
    expect(screen.queryByText("Lot province")).not.toBeInTheDocument();
  });

  it("disables Save until a province is chosen, then saves it", () => {
    const onSave = vi.fn();
    render(
      <LotProvinceDialog
        lot={lot}
        isSaving={false}
        onClose={vi.fn()}
        onSave={onSave}
        onClear={vi.fn()}
      />
    );
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Province"), {
      target: { value: "western_cape" },
    });
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledWith("western_cape");
  });

  it("offers Clear province only when the lot has one, and calls onClear", () => {
    const onClear = vi.fn();
    const { rerender } = render(
      <LotProvinceDialog
        lot={lot}
        isSaving={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onClear={onClear}
      />
    );
    expect(
      screen.queryByRole("button", { name: "Clear province" })
    ).not.toBeInTheDocument();

    rerender(
      <LotProvinceDialog
        lot={{ ...lot, province: "gauteng" }}
        isSaving={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onClear={onClear}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear province" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("starts from the stored province and closes on cancel", () => {
    const onClose = vi.fn();
    render(
      <LotProvinceDialog
        lot={{ ...lot, province: "gauteng" }}
        isSaving={false}
        onClose={onClose}
        onSave={vi.fn()}
        onClear={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Province")).toHaveValue("gauteng");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});
