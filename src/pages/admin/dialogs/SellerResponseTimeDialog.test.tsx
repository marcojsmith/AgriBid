import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AdminProfile } from "@/hooks/admin/useUserManagement";

import { SellerResponseTimeDialog } from "./SellerResponseTimeDialog";

const seller = {
  _id: "p1",
  userId: "seller-1",
  name: "Greenfield",
  role: "seller",
} as AdminProfile;

describe("SellerResponseTimeDialog", () => {
  it("saves the chosen response time", () => {
    const onSave = vi.fn();
    render(
      <SellerResponseTimeDialog
        user={seller}
        isSaving={false}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );
    fireEvent.change(screen.getByLabelText("Typical reply time"), {
      target: { value: "within_2_days" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith("within_2_days");
  });

  it("clears the value when set to not set", () => {
    const onSave = vi.fn();
    render(
      <SellerResponseTimeDialog
        user={{ ...seller, sellerResponseTime: "within_day" }}
        isSaving={false}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );
    const select = screen.getByLabelText("Typical reply time");
    expect(select).toHaveValue("within_day");
    fireEvent.change(select, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith(null);
  });

  it("disables actions while saving and closes on cancel", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <SellerResponseTimeDialog
        user={seller}
        isSaving
        onClose={onClose}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    rerender(
      <SellerResponseTimeDialog
        user={seller}
        isSaving={false}
        onClose={onClose}
        onSave={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing without a user", () => {
    render(
      <SellerResponseTimeDialog
        user={null}
        isSaving={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(screen.queryByText("Seller response time")).not.toBeInTheDocument();
  });
});
