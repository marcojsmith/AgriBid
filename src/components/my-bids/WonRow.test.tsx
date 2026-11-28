import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { api } from "convex/_generated/api";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  mutationMock,
  resetConvexState,
  setQuery,
} from "@/pages/register/testing";

import { fixtureLotId, makeWonRow } from "./fixtures";
import { WonRow } from "./WonRow";

const showToast = vi.hoisted(() => vi.fn());
const branding = vi.hoisted(
  (): { value: { businessInfo: { whatsapp?: string } } } => ({
    value: { businessInfo: { whatsapp: "+27 83 700 0000" } },
  })
);
vi.mock("convex/react", async () => {
  const t = await import("@/pages/register/testing");
  return {
    useQuery: t.mockUseQuery,
    useMutation: t.mockUseMutation,
    useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  };
});
vi.mock("@/components/ds/showToast", () => ({ showToast }));
vi.mock("@/hooks/useBranding", () => ({ useBranding: () => branding.value }));

const NOW = Date.UTC(2026, 10, 25, 6, 30);
const BANK = {
  bank: "FNB",
  accountName: "AgriBid (Pty) Ltd",
  accountNumber: "62000000001",
  branchCode: "250655",
};

/**
 * Renders a won row.
 *
 * @param row - The row
 */
function renderRow(row: ReturnType<typeof makeWonRow>) {
  render(
    <MemoryRouter>
      <WonRow row={row} />
    </MemoryRouter>
  );
}

describe("WonRow", () => {
  beforeEach(() => {
    resetConvexState();
    showToast.mockReset();
    branding.value = { businessInfo: { whatsapp: "+27 83 700 0000" } };
    setQuery(api.admin.platformSettings.getDepositBankDetails, BANK);
  });

  it("shows the pay summary, the steps and the collection note for an unpaid lot", () => {
    renderRow(makeWonRow(NOW));
    expect(screen.getByText("Won")).toBeVisible();
    expect(screen.getByText("Lot 1")).toBeVisible();
    expect(screen.getByText("1998 · Mthatha")).toBeVisible();
    expect(screen.getByText("Closed Tue 24 Nov, 12:30")).toBeVisible();
    const summary = screen.getByText("Your bid").closest("dl");
    expect(summary?.textContent.replaceAll(" ", " ")).toBe(
      "Your bidR 92 000Buyer's premiumR 11 040VATR 15 456TotalR 118 496Deposit paid−R 5 000To payR 113 496"
    );
    const steps = screen.getByRole("list", { name: "Payment steps" });
    expect(steps.textContent).toContain("Pay");
    expect(steps.textContent).toContain("by Thu 26 Nov, 10:30");
    expect(steps.textContent).toContain("within 7 days of payment");
    expect(
      screen.getByText("Collection details show once we confirm your payment.")
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Pay by EFT" })).toBeVisible();
  });

  it("leaves the deposit line out when no deposit was credited", () => {
    renderRow(makeWonRow(NOW, { depositCredit: 0, amountDue: 118_496 }));
    expect(screen.queryByText("Deposit paid")).toBeNull();
  });

  it("opens the EFT sheet with the bank rows and the lot's own reference", () => {
    renderRow(makeWonRow(NOW));
    fireEvent.click(screen.getByRole("button", { name: "Pay by EFT" }));
    expect(screen.getByText(/^Pay R.113.496$/)).toBeVisible();
    expect(
      screen.getByText(
        /By EFT before Thu 26 Nov, 10:30\. Your R.5.000 deposit is already counted\./
      )
    ).toBeVisible();
    expect(screen.getByText("FNB")).toBeVisible();
    expect(screen.getByText("62000000001")).toBeVisible();
    expect(screen.getByText("AB-1042")).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Send proof of payment on WhatsApp/ })
    ).toHaveAttribute(
      "href",
      `https://wa.me/27837000000?text=${encodeURIComponent("Proof of payment AB-1042")}`
    );
  });

  it("says so when the bank details are not set up", () => {
    setQuery(api.admin.platformSettings.getDepositBankDetails, {
      ...BANK,
      accountNumber: null,
    });
    renderRow(makeWonRow(NOW));
    fireEvent.click(screen.getByRole("button", { name: "Pay by EFT" }));
    expect(
      screen.getByText(
        "Bank details aren't set up yet. WhatsApp us and we'll send them."
      )
    ).toBeVisible();
    expect(screen.getByText("AB-1042")).toBeVisible();
  });

  it("shows a skeleton while the bank details load and no WhatsApp link without a number", () => {
    setQuery(api.admin.platformSettings.getDepositBankDetails, undefined);
    renderRow(makeWonRow(NOW));
    fireEvent.click(screen.getByRole("button", { name: "Pay by EFT" }));
    expect(screen.queryByText("FNB")).toBeNull();
    expect(screen.getByRole("button", { name: "I've paid" })).toBeVisible();
  });

  it("omits the deposit sentence and the WhatsApp link when there is neither", () => {
    branding.value = { businessInfo: {} };
    renderRow(makeWonRow(NOW, { depositCredit: 0 }));
    fireEvent.click(screen.getByRole("button", { name: "Pay by EFT" }));
    expect(screen.queryByText(/deposit is already counted/)).toBeNull();
    expect(screen.queryByRole("link", { name: /WhatsApp/ })).toBeNull();
  });

  it('records the payment with "I\'ve paid" and closes the sheet', async () => {
    const claim = mutationMock(api.lotPayments.claimLotPaid);
    claim.mockResolvedValue({ success: true });
    renderRow(makeWonRow(NOW));
    fireEvent.click(screen.getByRole("button", { name: "Pay by EFT" }));
    fireEvent.click(screen.getByRole("button", { name: "I've paid" }));
    await waitFor(() => {
      expect(claim).toHaveBeenCalledWith({ lotId: fixtureLotId("jcb3cx") });
    });
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        "Thanks. We'll confirm when we receive it."
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "I've paid" })).toBeNull();
    });
  });

  it("keeps the sheet open and shows an error when the claim fails", async () => {
    mutationMock(api.lotPayments.claimLotPaid).mockRejectedValue(
      new Error("Nope")
    );
    renderRow(makeWonRow(NOW));
    fireEvent.click(screen.getByRole("button", { name: "Pay by EFT" }));
    fireEvent.click(screen.getByRole("button", { name: "I've paid" }));
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(expect.any(String), "error");
    });
    expect(screen.getByRole("button", { name: "I've paid" })).toBeVisible();
  });

  it("shows a claimed payment as being checked, with no Pay button", () => {
    renderRow(
      makeWonRow(NOW, {
        status: "paid_claimed",
        paidClaimedAt: Date.UTC(2026, 10, 24, 13, 10),
      })
    );
    expect(screen.queryByRole("button", { name: "Pay by EFT" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Payment details" }));
    expect(screen.getByText("AB-1042")).toBeVisible();
    expect(screen.queryByRole("button", { name: "I've paid" })).toBeNull();
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    const steps = screen.getByRole("list", { name: "Payment steps" });
    expect(steps.textContent).toContain("Tue 24 Nov, 15:10");
    expect(steps.querySelector('[aria-current="step"]')?.textContent).toContain(
      "We confirm"
    );
  });

  it("shows a paid lot with its collection card", () => {
    setQuery(api.lotPayments.getMyCollectionDetails, {
      sellerName: "Thandi N.",
      sellerPhone: "082 555 0188",
      collectionAddress: "Farm Rietfontein, Mthatha, Eastern Cape",
      collectBy: Date.UTC(2026, 11, 1, 9, 0),
    });
    renderRow(
      makeWonRow(NOW, {
        status: "confirmed",
        paidClaimedAt: Date.UTC(2026, 10, 24, 13, 10),
        confirmedAt: Date.UTC(2026, 10, 24, 13, 10),
        collectBy: Date.UTC(2026, 11, 1, 9, 0),
      })
    );
    expect(screen.getAllByText("Paid")).toHaveLength(2);
    expect(screen.getByText("Won at")).toBeVisible();
    expect(
      screen.getByText("Payment received Tue 24 Nov, 15:10")
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Pay by EFT" })).toBeNull();
    expect(
      screen.queryByText(
        "Collection details show once we confirm your payment."
      )
    ).toBeNull();
    expect(screen.getByText("Tue 1 Dec")).toBeVisible();
    expect(
      screen.getByText("Farm Rietfontein, Mthatha, Eastern Cape")
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "082 555 0188" })).toHaveAttribute(
      "href",
      "tel:0825550188"
    );
  });

  it("opens the transport quote sheet for the lot", () => {
    renderRow(makeWonRow(NOW));
    fireEvent.click(
      screen.getByRole("button", { name: "Request a transport quote" })
    );
    expect(screen.getByText("JCB 3CX 4x4 TLB · Lot 1")).toBeVisible();
  });

  it("shows the VAT rate in the breakdown when it is known", () => {
    setQuery(api.admin.getVatRate, { vatRatePct: 15 });
    renderRow(makeWonRow(NOW));
    expect(screen.getByText("VAT 15%")).toBeVisible();
    expect(screen.getByText("Buyer's premium")).toBeVisible();
  });

  it("says the VAT is on the premium for a private seller", () => {
    setQuery(api.admin.getVatRate, { vatRatePct: 15 });
    renderRow(makeWonRow(NOW, { vatKind: "private" }));
    expect(screen.getByText("VAT 15% on the premium")).toBeVisible();
  });

  it("closes the pay sheet when the payment gets confirmed underneath it", () => {
    const row = makeWonRow(NOW);
    const view = render(
      <MemoryRouter>
        <WonRow row={row} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("button", { name: "Pay by EFT" }));
    expect(screen.getByRole("button", { name: "I've paid" })).toBeVisible();
    view.rerender(
      <MemoryRouter>
        <WonRow row={{ ...row, status: "confirmed", confirmedAt: NOW }} />
      </MemoryRouter>
    );
    expect(screen.queryByRole("button", { name: "I've paid" })).toBeNull();
  });
});
