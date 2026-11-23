import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AdminProfile } from "@/hooks/admin/useUserManagement";

import { SellerVatProfileDialog } from "./SellerVatProfileDialog";

const seller = {
  _id: "p1",
  userId: "seller-1",
  name: "Greenfield",
  role: "seller",
} as AdminProfile;

describe("SellerVatProfileDialog", () => {
  it("saves the chosen VAT status and seller type", () => {
    const onSave = vi.fn();
    render(
      <SellerVatProfileDialog
        user={seller}
        isSaving={false}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );
    expect(screen.getByLabelText("VAT registered")).toHaveValue("unset");
    fireEvent.change(screen.getByLabelText("VAT registered"), {
      target: { value: "registered" },
    });
    fireEvent.change(screen.getByLabelText("Seller type"), {
      target: { value: "dealer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith({
      vatRegistered: true,
      sellerType: "dealer",
    });
  });

  it("does not turn an unset VAT status into 'not registered'", () => {
    const onSave = vi.fn();
    render(
      <SellerVatProfileDialog
        user={seller}
        isSaving={false}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );
    fireEvent.change(screen.getByLabelText("Seller type"), {
      target: { value: "dealer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith({
      vatRegistered: undefined,
      sellerType: "dealer",
    });
  });

  it("saves an explicit 'not VAT registered' choice and ignores unknown values", () => {
    const onSave = vi.fn();
    render(
      <SellerVatProfileDialog
        user={seller}
        isSaving={false}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );
    const select = screen.getByLabelText("VAT registered");
    fireEvent.change(select, { target: { value: "not_registered" } });
    expect(select).toHaveValue("not_registered");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith({
      vatRegistered: false,
      sellerType: undefined,
    });
    fireEvent.change(select, { target: { value: "" } });
    expect(select).toHaveValue("unset");
  });

  it("starts from stored values and can clear the seller type", () => {
    const onSave = vi.fn();
    render(
      <SellerVatProfileDialog
        user={{
          ...seller,
          name: " ",
          email: "g@example.com",
          vatRegistered: true,
          sellerType: "farming_business",
        }}
        isSaving={false}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );
    expect(screen.getByText("g@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText("VAT registered")).toHaveValue("registered");
    const select = screen.getByLabelText("Seller type");
    expect(select).toHaveValue("farming_business");
    fireEvent.change(select, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith({
      vatRegistered: true,
      sellerType: undefined,
    });
  });

  it("falls back to a generic label when the seller has no name or email", () => {
    render(
      <SellerVatProfileDialog
        user={{ ...seller, name: undefined }}
        isSaving={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByText("This seller")).toBeInTheDocument();
  });

  it("disables actions while saving and closes on cancel", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <SellerVatProfileDialog
        user={seller}
        isSaving
        onClose={onClose}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    rerender(
      <SellerVatProfileDialog
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
      <SellerVatProfileDialog
        user={null}
        isSaving={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(screen.queryByText("Seller VAT and type")).not.toBeInTheDocument();
  });
});
