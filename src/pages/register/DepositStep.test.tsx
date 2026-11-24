import { fireEvent, screen, waitFor } from "@testing-library/react";
import { api } from "convex/_generated/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DepositStep from "./DepositStep";
import {
  makeRegistration,
  mutationMock,
  renderAt,
  resetConvexState,
  SA_DETAILS,
  setQuery,
} from "./testing";

const showToast = vi.hoisted(() => vi.fn());
const branding = vi.hoisted(
  (): { value: { businessInfo: { whatsapp?: string } } } => ({
    value: { businessInfo: { whatsapp: "+27 83 700 0000" } },
  })
);
vi.mock("convex/react", async () => {
  const t = await import("./testing");
  return { useQuery: t.mockUseQuery, useMutation: t.mockUseMutation };
});
vi.mock("@/components/ds/showToast", () => ({ showToast }));
vi.mock("@/hooks/useBranding", () => ({ useBranding: () => branding.value }));

const BANK = {
  bank: "FNB",
  accountName: "AgriBid (Pty) Ltd",
  accountNumber: "62000000001",
  branchCode: "250655",
};
const NBSP = " ";
const UNDER_REVIEW = { kind: "under_review", depositReceived: false } as const;

/**
 * Renders the deposit step.
 *
 * @param entry - The URL
 */
function renderStep(entry = "/register/deposit") {
  renderAt(<DepositStep />, "/register/deposit", entry);
}

describe("DepositStep", () => {
  beforeEach(() => {
    resetConvexState();
    showToast.mockReset();
    branding.value = { businessInfo: { whatsapp: "+27 83 700 0000" } };
    setQuery(api.admin.platformSettings.getDepositBankDetails, BANK);
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        eligibility: UNDER_REVIEW,
        details: SA_DETAILS,
        deposit: { reference: "AB-7K3F2", status: "awaiting", amount: 5000 },
      })
    );
    mutationMock(api.registration.startMyDeposit).mockResolvedValue({
      reference: "AB-NEW99",
    });
    mutationMock(api.registration.claimMyDepositPaid).mockResolvedValue({
      success: true,
    });
  });

  it("shows the heading, refund copy and 4-step progress", () => {
    renderStep();
    expect(
      screen.getByRole("group", { name: "Step 4 of 4, Deposit" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: `Pay your R${NBSP}5${NBSP}000 deposit`,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Refunded within 3 working days if you don't buy. If you win, it counts towards payment."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("Refunds go back to the account you paid from.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/Sample data/)).toBeNull();
  });

  it("renders the bank details and the reference with copy buttons", () => {
    renderStep();
    expect(
      screen.getByRole("heading", { name: "Pay by EFT" })
    ).toBeInTheDocument();
    for (const value of Object.values(BANK)) {
      expect(screen.getByText(value)).toBeInTheDocument();
    }
    expect(screen.getByText("AB-7K3F2")).toBeInTheDocument();
    for (const label of [
      "Bank",
      "Account name",
      "Account number",
      "Branch code",
      "Reference. Use exactly",
    ]) {
      expect(
        screen.getByRole("button", { name: `Copy ${label}` })
      ).toBeInTheDocument();
    }
  });

  it("does not start a deposit when one already exists", () => {
    renderStep();
    expect(
      mutationMock(api.registration.startMyDeposit)
    ).not.toHaveBeenCalled();
  });

  it("starts the deposit on mount when there is none and shows the new reference", async () => {
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({ eligibility: UNDER_REVIEW, details: SA_DETAILS })
    );
    renderStep();
    expect(await screen.findByText("AB-NEW99")).toBeInTheDocument();
    expect(
      mutationMock(api.registration.startMyDeposit)
    ).toHaveBeenCalledOnce();
  });

  it("shows an error toast when the reference can't be created", async () => {
    mutationMock(api.registration.startMyDeposit).mockRejectedValue(
      new Error("nope")
    );
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({ eligibility: UNDER_REVIEW, details: SA_DETAILS })
    );
    renderStep();
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(expect.any(String), "error");
    });
    expect(screen.getByRole("button", { name: "I've paid" })).toBeDisabled();
  });

  it("builds the WhatsApp link from the business number and the reference", () => {
    renderStep();
    const link = screen.getByRole("link", {
      name: /Send proof of payment on WhatsApp/,
    });
    expect(link).toHaveAttribute(
      "href",
      "https://wa.me/27837000000?text=Proof%20of%20payment%20AB-7K3F2"
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("hides the WhatsApp button when no number is set", () => {
    branding.value = { businessInfo: {} };
    renderStep();
    expect(
      screen.queryByRole("link", { name: /Send proof of payment/ })
    ).toBeNull();
  });

  it("replaces the bank rows with a warning when any field is missing, keeping the reference", () => {
    setQuery(api.admin.platformSettings.getDepositBankDetails, {
      ...BANK,
      branchCode: null,
    });
    renderStep();
    const banner = screen.getByText(
      "Bank details aren't set up yet. WhatsApp us and we'll send them."
    );
    expect(banner.closest("[data-slot=banner]")).toHaveAttribute(
      "data-kind",
      "warn"
    );
    expect(screen.queryByText("FNB")).toBeNull();
    expect(screen.queryByRole("button", { name: "Copy Bank" })).toBeNull();
    expect(screen.getByText("AB-7K3F2")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Send proof of payment/ })
    ).toBeInTheDocument();
  });

  it("I've paid calls the mutation and goes to the status page", async () => {
    renderStep("/register/deposit?callbackUrl=%2Fauction%2Fabc");
    fireEvent.click(screen.getByRole("button", { name: "I've paid" }));
    await waitFor(() => {
      expect(screen.getByTestId("loc")).toHaveTextContent(
        "/register/status?callbackUrl=%2Fauction%2Fabc"
      );
    });
    expect(
      mutationMock(api.registration.claimMyDepositPaid)
    ).toHaveBeenCalledOnce();
  });

  it("shows an error toast and stays when I've paid fails", async () => {
    mutationMock(api.registration.claimMyDepositPaid).mockRejectedValue(
      new Error("x")
    );
    renderStep();
    fireEvent.click(screen.getByRole("button", { name: "I've paid" }));
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(expect.any(String), "error");
    });
    expect(screen.queryByTestId("loc")).toBeNull();
  });

  it("I'll pay later links to the status page", () => {
    renderStep("/register/deposit?callbackUrl=%2Fauction%2Fabc");
    expect(
      screen.getByRole("link", { name: "I'll pay later" })
    ).toHaveAttribute("href", "/register/status?callbackUrl=%2Fauction%2Fabc");
  });

  it("redirects to status when the deposit is off", () => {
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        eligibility: UNDER_REVIEW,
        depositSettings: { enabled: false, amount: 5000, refundDays: 3 },
      })
    );
    renderStep();
    expect(screen.getByTestId("loc")).toHaveTextContent("/register/status");
  });

  it("redirects to status once the deposit is received", () => {
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        eligibility: UNDER_REVIEW,
        deposit: { reference: "AB-7K3F2", status: "received", amount: 5000 },
      })
    );
    renderStep();
    expect(screen.getByTestId("loc")).toHaveTextContent("/register/status");
  });

  it("redirects an unfinished registration to its step without creating a deposit", () => {
    setQuery(api.registration.getMyRegistration, makeRegistration());
    renderStep();
    expect(screen.getByTestId("loc")).toHaveTextContent("/register/details");
    expect(
      mutationMock(api.registration.startMyDeposit)
    ).not.toHaveBeenCalled();
  });

  it("shows a loading state while the bank details load", () => {
    resetConvexState();
    setQuery(api.registration.getMyRegistration, makeRegistration());
    renderStep();
    expect(screen.getByLabelText("Loading deposit...")).toBeInTheDocument();
  });
});
