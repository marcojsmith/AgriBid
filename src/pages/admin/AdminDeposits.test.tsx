import type { ReactNode } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { formatRand } from "@/lib/currency";

/**
 * Rand text as the DOM matcher sees it (no-break spaces normalised).
 *
 * @param amount - Rand amount
 * @returns The display text with plain spaces
 */
function rand(amount: number): string {
  return formatRand(amount).replace(/\u00A0/g, " ");
}

import AdminDeposits from "./AdminDeposits";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  usePaginatedQuery: vi.fn(),
  useMutation: vi.fn(),
}));
vi.mock("convex/_generated/api", () => ({
  api: {
    admin: {
      registration: {
        listDeposits: "reg:list",
        findDepositByReference: "reg:find",
        markDepositReceived: "reg:received",
        markDepositRefunded: "reg:refunded",
      },
    },
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/admin/AdminLayout", () => ({
  AdminLayout: ({
    children,
    title,
  }: {
    children: ReactNode;
    title: string;
  }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

const claimed = {
  userId: "u1",
  name: "Thandi",
  reference: "AB-7K3F2",
  status: "paid_claimed" as const,
  amount: 5000,
  paidClaimedAt: Date.UTC(2026, 10, 20, 10, 0),
  updatedAt: 1,
};
const received = {
  userId: "u2",
  reference: "AB-2R9XM",
  status: "received" as const,
  amount: 5000,
  receivedAmount: 5200,
  receivedAt: Date.UTC(2026, 10, 21, 10, 0),
  updatedAt: 2,
};

const listQuery = vi.fn();
const mutations: Record<string, Mock> = {};
let found: unknown;

/**
 * Sets what the paginated list returns.
 *
 * @param results - The rows
 * @param status - The pagination status
 */
function setList(
  results: unknown[],
  status: "LoadingFirstPage" | "CanLoadMore" | "Exhausted" = "Exhausted"
): void {
  (usePaginatedQuery as Mock).mockImplementation(
    (ref: string, args: { status: string }) => {
      listQuery(ref, args);
      return { results, status, loadMore: vi.fn(), isLoading: false };
    }
  );
}

describe("AdminDeposits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    found = undefined;
    for (const key of ["reg:received", "reg:refunded"]) {
      mutations[key] = vi.fn().mockResolvedValue({ success: true });
    }
    (useMutation as Mock).mockImplementation((ref: string) => mutations[ref]);
    (useQuery as Mock).mockImplementation((_ref: string, args: unknown) =>
      args === "skip" ? undefined : found
    );
    setList([claimed]);
  });

  it("defaults to the Paid claimed tab and switches tabs", () => {
    render(<AdminDeposits />);
    expect(
      screen.getByRole("heading", { name: "Deposits" })
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Paid claimed" })).toBeChecked();
    expect(listQuery).toHaveBeenLastCalledWith("reg:list", {
      status: "paid_claimed",
    });
    expect(screen.getByText("AB-7K3F2")).toBeInTheDocument();
    expect(screen.getByText("Thandi")).toBeInTheDocument();

    for (const [label, status] of [
      ["Awaiting", "awaiting"],
      ["Received", "received"],
      ["Refunded", "refunded"],
    ] as const) {
      fireEvent.click(screen.getByRole("radio", { name: label }));
      expect(listQuery).toHaveBeenLastCalledWith("reg:list", { status });
    }
  });

  it("shows a loading indicator and an empty state", () => {
    setList([], "LoadingFirstPage");
    const { unmount } = render(<AdminDeposits />);
    expect(screen.queryByText("No deposits here")).not.toBeInTheDocument();
    unmount();

    setList([]);
    render(<AdminDeposits />);
    expect(screen.getByText("No deposits here")).toBeInTheDocument();
  });

  it("falls back to the user id when there is no name and offers load more", () => {
    const loadMore = vi.fn();
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [{ ...claimed, name: undefined }],
      status: "CanLoadMore",
      loadMore,
    });
    render(<AdminDeposits />);
    expect(screen.getByText("u1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(loadMore).toHaveBeenCalledWith(50);
  });

  it("searches by reference and shows the match or an empty result", () => {
    found = { ...received };
    render(<AdminDeposits />);
    fireEvent.change(screen.getByLabelText("Search by reference"), {
      target: { value: " ab-2r9xm " },
    });
    expect(useQuery).toHaveBeenLastCalledWith("reg:find", {
      reference: "ab-2r9xm",
    });
    expect(screen.getByText("AB-2R9XM")).toBeInTheDocument();
    expect(screen.queryByText("AB-7K3F2")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Load more" })
    ).not.toBeInTheDocument();
  });

  it("says when no deposit matches the reference", () => {
    found = null;
    render(<AdminDeposits />);
    fireEvent.change(screen.getByLabelText("Search by reference"), {
      target: { value: "AB-NOPE9" },
    });
    expect(
      screen.getByText("No deposit with that reference")
    ).toBeInTheDocument();
  });

  it("marks a deposit received with the default amount", async () => {
    render(<AdminDeposits />);
    fireEvent.click(screen.getByRole("button", { name: "Mark received" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Amount received (R)")).toHaveValue(
      5000
    );
    fireEvent.change(within(dialog).getByLabelText("Amount received (R)"), {
      target: { value: "5200" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirm received" })
    );
    await waitFor(() => {
      expect(mutations["reg:received"]).toHaveBeenCalledWith({
        userId: "u1",
        receivedAmount: 5200,
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Deposit marked received");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("blocks an amount below the deposit", () => {
    render(<AdminDeposits />);
    fireEvent.click(screen.getByRole("button", { name: "Mark received" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Amount received (R)"), {
      target: { value: "100" },
    });
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      `Enter at least ${rand(5000)}.`
    );
    expect(
      within(dialog).getByRole("button", { name: "Confirm received" })
    ).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Amount received (R)"), {
      target: { value: "" },
    });
    expect(within(dialog).getByRole("alert")).toBeInTheDocument();
  });

  it("shows the server error and keeps the dialog open when saving fails", async () => {
    mutations["reg:received"].mockRejectedValue(
      new Error("Amount is less than the deposit.")
    );
    render(<AdminDeposits />);
    fireEvent.click(screen.getByRole("button", { name: "Mark received" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm received" }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Amount is less than the deposit."
      );
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("can cancel the received dialog", () => {
    render(<AdminDeposits />);
    fireEvent.click(screen.getByRole("button", { name: "Mark received" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mutations["reg:received"]).not.toHaveBeenCalled();
  });

  it("confirms a refund with the amount that came in", async () => {
    setList([received]);
    render(<AdminDeposits />);
    expect(
      screen.queryByRole("button", { name: "Mark received" })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark refunded" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(
      `Refund ${rand(5200)} to the account it came from?`
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirm refund" })
    );
    await waitFor(() => {
      expect(mutations["reg:refunded"]).toHaveBeenCalledWith({ userId: "u2" });
    });
    expect(toast.success).toHaveBeenCalledWith("Deposit marked refunded");
  });

  it("shows no actions for a refunded deposit", () => {
    setList([
      { ...received, status: "refunded", refundedAt: Date.UTC(2026, 10, 22) },
    ]);
    render(<AdminDeposits />);
    expect(
      screen.queryByRole("button", { name: /Mark/ })
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Refunded /)).toBeInTheDocument();
  });

  it("shows a dash when a deposit has no relevant date yet", () => {
    setList([{ ...claimed, status: "awaiting", paidClaimedAt: undefined }]);
    render(<AdminDeposits />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
