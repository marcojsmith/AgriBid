import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { VatRateCard } from "./VatRateCard";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));
vi.mock("convex/_generated/api", () => ({
  api: {
    admin: {
      getVatRate: "admin:getVatRate",
      updateVatRate: "admin:updateVatRate",
    },
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockUpdate = vi.fn();

describe("VatRateCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useMutation as Mock).mockReturnValue(mockUpdate);
  });

  it("shows a loading line while the rate loads", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    render(<VatRateCard />);
    expect(screen.getByText(/Loading VAT rate/)).toBeInTheDocument();
  });

  it("starts from the stored rate with Save disabled", () => {
    (useQuery as Mock).mockReturnValue({ vatRatePct: 15 });
    render(<VatRateCard />);
    expect(screen.getByLabelText("VAT rate (%)")).toHaveValue(15);
    expect(
      screen.getByRole("button", { name: "Save VAT rate" })
    ).toBeDisabled();
  });

  it("saves a changed rate and confirms", async () => {
    (useQuery as Mock).mockReturnValue({ vatRatePct: 15 });
    mockUpdate.mockResolvedValue({ success: true });
    render(<VatRateCard />);

    fireEvent.change(screen.getByLabelText("VAT rate (%)"), {
      target: { value: "12.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save VAT rate" }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ vatRatePct: 12.5 });
    });
    expect(toast.success).toHaveBeenCalledWith("VAT rate saved");
  });

  it("blocks an out-of-range rate and explains why", () => {
    (useQuery as Mock).mockReturnValue({ vatRatePct: 15 });
    render(<VatRateCard />);

    fireEvent.change(screen.getByLabelText("VAT rate (%)"), {
      target: { value: "150" },
    });

    expect(
      screen.getByText("Enter a number between 0 and 100.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save VAT rate" })
    ).toBeDisabled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("shows the server error when saving fails", async () => {
    (useQuery as Mock).mockReturnValue({ vatRatePct: 15 });
    mockUpdate.mockRejectedValue(new Error("Not authorized"));
    render(<VatRateCard />);

    fireEvent.change(screen.getByLabelText("VAT rate (%)"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save VAT rate" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(toast.success).not.toHaveBeenCalled();
  });
});
