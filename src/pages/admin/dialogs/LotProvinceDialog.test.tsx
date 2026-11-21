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

  it("starts from the stored province and closes on cancel", () => {
    const onClose = vi.fn();
    render(
      <LotProvinceDialog
        lot={{ ...lot, province: "gauteng" }}
        isSaving={false}
        onClose={onClose}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Province")).toHaveValue("gauteng");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});
