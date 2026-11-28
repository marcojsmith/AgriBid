import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { api } from "convex/_generated/api";
import type { FunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Registration } from "@/lib/registrationCopy";
import {
  makeRegistration,
  mutationMock,
  resetConvexState,
  setQuery,
} from "@/pages/register/testing";

import DepositPage from "./DepositPage";

const state = vi.hoisted(
  (): { won: unknown[]; toast: ReturnType<typeof vi.fn> } => ({
    won: [],
    toast: vi.fn(),
  })
);

vi.mock("convex/react", async () => {
  const t = await import("@/pages/register/testing");
  return {
    useQuery: t.mockUseQuery,
    useMutation: t.mockUseMutation,
    usePaginatedQuery: (_ref: FunctionReference<"query">, args: unknown) => ({
      results: args === "skip" ? [] : state.won,
      status: "Exhausted",
      loadMore: vi.fn(),
    }),
  };
});
vi.mock("@/components/ds/showToast", () => ({ showToast: state.toast }));

interface Deposit {
  reference: string;
  status: NonNullable<Registration["deposit"]>["status"];
  amount: number;
  receivedAt?: number;
  refundRequestedAt?: number;
  refundedAt?: number;
  refundableAmount?: number;
}

/**
 * Renders the page for a deposit.
 *
 * @param deposit - The deposit row, or null
 * @param unpaid - Won lots not yet paid
 * @param enabled - Whether the platform takes a deposit
 */
function renderPage(deposit: Deposit | null, unpaid = 0, enabled = true) {
  setQuery(
    api.registration.getMyRegistration,
    makeRegistration({
      eligibility: { kind: "ok" },
      deposit,
      depositSettings: { enabled, amount: 5000, refundDays: 3 },
    })
  );
  setQuery(api.lotPayments.getMyPaymentSummary, {
    unpaidCount: unpaid,
    awaitingCount: unpaid,
    claimedCount: 0,
    nextPayBy: null,
    nextAmountDue: null,
    nextLotId: null,
  });
  render(
    <HelmetProvider>
      <MemoryRouter>
        <DepositPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

const received: Deposit = {
  reference: "AB-1",
  status: "received",
  amount: 5000,
  receivedAt: Date.now(),
};

beforeEach(() => {
  resetConvexState();
  state.won = [];
  state.toast.mockReset();
});

describe("DepositPage", () => {
  it("shows a skeleton while loading", () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <DepositPage />
        </MemoryRouter>
      </HelmetProvider>
    );
    expect(
      screen.getByRole("status", { name: "Loading deposit" })
    ).toBeInTheDocument();
  });

  it("explains when there is no registration", () => {
    setQuery(api.registration.getMyRegistration, null);
    setQuery(api.lotPayments.getMyPaymentSummary, { unpaidCount: 0 });
    render(
      <HelmetProvider>
        <MemoryRouter>
          <DepositPage />
        </MemoryRouter>
      </HelmetProvider>
    );
    expect(screen.getByText(/Finish registering/)).toBeInTheDocument();
  });

  it("shows the credited lot and no refund button while a lot is unpaid", () => {
    state.won = [
      {
        title: "JCB 3CX 4×4 TLB",
        lotNumber: 1,
        depositCredit: 5000,
        amountDue: 113_496,
      },
    ];
    renderPage(received, 1);
    expect(screen.getByText("Received")).toBeInTheDocument();
    expect(screen.getByText(/Credited to Lot 1 JCB 3CX/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask for refund" })).toBeNull();
    expect(
      screen.getByText(/only when you have no unpaid lots/)
    ).toBeInTheDocument();
  });

  it("asks for a refund and shows a toast", async () => {
    renderPage(received);
    expect(
      screen.getByText(/Refunded within 3 working days/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Refunds go back to the account you paid from/)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ask for refund" }));
    await waitFor(() => {
      expect(state.toast).toHaveBeenCalledWith("Refund requested");
    });
    expect(
      mutationMock(api.registration.requestDepositRefund)
    ).toHaveBeenCalled();
  });

  it("shows the server's message when the refund is refused", async () => {
    mutationMock(api.registration.requestDepositRefund).mockRejectedValue(
      new ConvexError(
        "You're the top bidder on a lot. You can ask once it's decided."
      )
    );
    renderPage(received);
    fireEvent.click(screen.getByRole("button", { name: "Ask for refund" }));
    await waitFor(() => {
      expect(state.toast).toHaveBeenCalledWith(
        "You're the top bidder on a lot. You can ask once it's decided.",
        "error"
      );
    });
  });

  it("says nothing is left to refund when it was all used", () => {
    renderPage({ ...received, refundableAmount: 0 });
    expect(
      screen.getByText("There is nothing left to refund.")
    ).toBeInTheDocument();
  });

  it("shows a requested refund and cancels it", async () => {
    renderPage({
      ...received,
      status: "refund_requested",
      refundRequestedAt: Date.now(),
    });
    expect(screen.getByText("Refund requested")).toBeInTheDocument();
    expect(
      screen.getByText(/To bid again you pay the deposit again/)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel request" }));
    await waitFor(() => {
      expect(state.toast).toHaveBeenCalledWith("Request cancelled");
    });
  });

  it("reports a failed cancel", async () => {
    mutationMock(api.registration.cancelDepositRefundRequest).mockRejectedValue(
      new Error("boom")
    );
    renderPage({ ...received, status: "refund_requested" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel request" }));
    await waitFor(() => {
      expect(state.toast).toHaveBeenCalledWith("boom", "error");
    });
  });

  it("shows a refunded deposit with a way to pay again", () => {
    renderPage({ ...received, status: "refunded", refundedAt: Date.now() });
    expect(screen.getByText("Refunded")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pay deposit" })).toHaveAttribute(
      "href",
      "/register/deposit?callbackUrl=%2Faccount"
    );
  });

  it("links to payment when no deposit exists or it is awaited", () => {
    renderPage(null);
    expect(screen.getByRole("link", { name: "Pay deposit" })).toHaveAttribute(
      "href",
      "/register/deposit?callbackUrl=%2Faccount"
    );
    cleanup();
    renderPage({ ...received, status: "awaiting" });
    expect(
      screen.getByRole("link", { name: "Pay deposit" })
    ).toBeInTheDocument();
  });

  it("shows the checking state", () => {
    renderPage({ ...received, status: "paid_claimed" });
    expect(screen.getByText(/We're checking your/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "See payment details" })
    ).toBeInTheDocument();
  });

  it("says no deposit is needed when the platform takes none", () => {
    renderPage(null, 0, false);
    expect(
      screen.getByText("No deposit is needed right now.")
    ).toBeInTheDocument();
  });
});
