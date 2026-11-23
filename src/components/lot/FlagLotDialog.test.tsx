import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "convex/_generated/dataModel";

import { FlagLotDialog } from "./FlagLotDialog";

const flagLot = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("convex/react", () => ({ useMutation: () => flagLot }));
vi.mock("convex/_generated/api", () => ({
  api: { auctions: { mutations: { publish: { flagLot: "flagLot" } } } },
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/ui/select", () => ({
  Select: ({
    onValueChange,
    children,
  }: {
    onValueChange: (v: string) => void;
    children: React.ReactNode;
  }) => (
    <div>
      <button
        type="button"
        onClick={() => {
          onValueChange("suspicious");
        }}
      >
        pick suspicious
      </button>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const LOT = "l1" as Id<"lots">;

function open() {
  render(<FlagLotDialog lotId={LOT} />);
  fireEvent.click(screen.getByRole("button", { name: /Report this lot/ }));
}

describe("FlagLotDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asks for a reason first", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    expect(toast.error).toHaveBeenCalledWith(
      "Please select a reason for flagging"
    );
    expect(flagLot).not.toHaveBeenCalled();
  });

  it("sends the report and thanks the user", async () => {
    flagLot.mockResolvedValue({ hideTriggered: false });
    open();
    fireEvent.click(screen.getByText("pick suspicious"));
    fireEvent.change(screen.getByLabelText(/Details/), {
      target: { value: " odd " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    await waitFor(() => {
      expect(flagLot).toHaveBeenCalledWith({
        lotId: LOT,
        reason: "suspicious",
        details: "odd",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Thank you for your report");
  });

  it("says when the lot was hidden for review", async () => {
    flagLot.mockResolvedValue({ hideTriggered: true });
    open();
    fireEvent.click(screen.getByText("pick suspicious"));
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "This lot has been flagged and hidden for review"
      );
    });
  });

  it("shows the server's error", async () => {
    flagLot.mockRejectedValue(new Error("Too many reports"));
    open();
    fireEvent.click(screen.getByText("pick suspicious"));
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Too many reports");
    });
  });

  it("cancel closes the dialog", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
