import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LotSpecsDialog } from "./LotSpecsDialog";

const lot = { _id: "lot1", title: "John Deere 6155R" };

describe("LotSpecsDialog", () => {
  it("saves only the filled-in fields", () => {
    const onSave = vi.fn();
    render(
      <LotSpecsDialog
        lot={lot}
        isSaving={false}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Power (kW)"), {
      target: { value: "129" },
    });
    fireEvent.change(screen.getByLabelText("Drive"), {
      target: { value: "4wd" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith({ powerKw: 129, drive: "4wd" });
  });

  it("starts from the lot's stored specs", () => {
    render(
      <LotSpecsDialog
        lot={{ ...lot, serialNumber: "SN1", rearTyrePct: 40 }}
        isSaving={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Serial number")).toHaveValue("SN1");
    expect(screen.getByLabelText("Rear tyre (%)")).toHaveValue(40);
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("blocks saving an out-of-range value", () => {
    render(
      <LotSpecsDialog
        lot={lot}
        isSaving={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText("Power (kW)"), {
      target: { value: "5000" },
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("disables actions while saving and closes on cancel", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <LotSpecsDialog
        lot={{ ...lot, powerKw: 100 }}
        isSaving
        onClose={onClose}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    rerender(
      <LotSpecsDialog
        lot={{ ...lot, powerKw: 100 }}
        isSaving={false}
        onClose={onClose}
        onSave={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing without a lot", () => {
    render(
      <LotSpecsDialog
        lot={null}
        isSaving={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(screen.queryByText("Lot specs")).not.toBeInTheDocument();
  });
});
