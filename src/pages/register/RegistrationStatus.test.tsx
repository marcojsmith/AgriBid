import { screen, within } from "@testing-library/react";
import { api } from "convex/_generated/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RegistrationStatus from "./RegistrationStatus";
import {
  makeDoc,
  makeRegistration,
  renderAt,
  resetConvexState,
  SA_DETAILS,
  setQuery,
} from "./testing";

vi.mock("convex/react", async () => {
  const t = await import("./testing");
  return { useQuery: t.mockUseQuery, useMutation: t.mockUseMutation };
});

// Testing Library collapses non-breaking spaces in rendered text, so match plain spaces.
const SP = String.fromCharCode(32);
const LOT_ID = "k57abcdefghjkmnpqrstvwxyz2345678";
const LOT_ENTRY = `/register/status?callbackUrl=${encodeURIComponent(`/auction/${LOT_ID}`)}`;
const SENT_AT = Date.UTC(2026, 10, 22, 6, 12);
const PENDING_DOCS = [
  makeDoc("id_front"),
  makeDoc("id_back"),
  makeDoc("proof_of_address"),
];

/**
 * Renders the status page.
 *
 * @param entry - The URL
 */
function renderStatus(entry = "/register/status") {
  renderAt(<RegistrationStatus />, "/register/status", entry);
}

/**
 * Finds a status row by its title.
 *
 * @param title - The row title
 * @returns The list item
 */
function row(title: string): HTMLElement {
  return screen
    .getByText(title, { selector: "b" })
    .closest("li") as HTMLElement;
}

describe("RegistrationStatus", () => {
  beforeEach(() => {
    resetConvexState();
    setQuery(api.auctions.getLotHeadline, {
      lotNumber: 3,
      title: "New Holland T6070",
      closesAt: Date.UTC(2026, 10, 25, 9, 0),
    });
  });

  it("pending: info banner, rows, Pay now, footnote and Back to Lot 3", () => {
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        eligibility: { kind: "under_review", depositReceived: false },
        details: SA_DETAILS,
        documents: PENDING_DOCS,
        submittedAt: SENT_AT,
      })
    );
    renderStatus(LOT_ENTRY);

    expect(
      screen.getByRole("heading", { name: "Your registration" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Documents sent Sun 22 Nov, 08:12. We check them within 2 business days."
      )
    ).toBeInTheDocument();
    expect(within(row("Your details")).getByText("Saved")).toBeInTheDocument();
    expect(within(row("ID")).getByText("Under review")).toBeInTheDocument();
    expect(
      within(row("Proof of address")).getByText("Under review")
    ).toBeInTheDocument();
    expect(
      within(row("Deposit")).getByText(`R${SP}5${SP}000 · not yet received`)
    ).toBeInTheDocument();
    expect(
      within(row("Deposit")).getByRole("link", { name: "Pay now" })
    ).toHaveAttribute(
      "href",
      `/register/deposit?callbackUrl=${encodeURIComponent(`/auction/${LOT_ID}`)}`
    );
    expect(
      screen.getByText("We notify you when it's done.")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Lot 3" })).toHaveAttribute(
      "href",
      `/auction/${LOT_ID}`
    );
    expect(screen.queryByRole("link", { name: /Bid on/ })).toBeNull();
  });

  it("rejected: warning banner, Replace action and the reason", () => {
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        eligibility: { kind: "needs_replacing", count: 1 },
        details: SA_DETAILS,
        documents: [
          makeDoc("id_front", "approved"),
          makeDoc("id_back", "approved"),
          makeDoc("proof_of_address", "rejected", {
            rejectionReason: "The bill is older than 3 months.",
            reviewedAt: Date.UTC(2026, 10, 22, 9, 40),
          }),
        ],
      })
    );
    renderStatus(LOT_ENTRY);

    expect(
      screen.getByText("One document needs replacing")
    ).toBeInTheDocument();
    expect(within(row("ID")).getByText("Approved")).toBeInTheDocument();
    expect(
      within(row("Proof of address")).getByText("Needs replacing")
    ).toBeInTheDocument();
    expect(
      within(row("Proof of address")).getByRole("link", { name: "Replace" })
    ).toHaveAttribute(
      "href",
      `/register/address?callbackUrl=${encodeURIComponent(`/auction/${LOT_ID}`)}&replace=1`
    );
    expect(
      screen.getByText("The bill is older than 3 months.")
    ).toBeInTheDocument();
    expect(screen.getByText("Checked Sun 22 Nov, 11:40")).toBeInTheDocument();
    expect(screen.queryByText("We notify you when it's done.")).toBeNull();
  });

  it("two rejected documents: plural banner and titled reasons", () => {
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        eligibility: { kind: "needs_replacing", count: 2 },
        details: SA_DETAILS,
        documents: [
          makeDoc("id_front", "rejected", {
            rejectionReason: "Too dark.",
            reviewedAt: 1,
          }),
          makeDoc("id_back", "approved"),
          makeDoc("proof_of_address", "rejected", {
            rejectionReason: "Too old.",
            reviewedAt: 1,
          }),
        ],
      })
    );
    renderStatus();
    expect(screen.getByText("2 documents need replacing")).toBeInTheDocument();
    expect(screen.getByText("ID front: Too dark.")).toBeInTheDocument();
    expect(screen.getByText("Proof of address: Too old.")).toBeInTheDocument();
  });

  it("deposit received: ok banner, dated row and the bidding note", () => {
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        eligibility: { kind: "under_review", depositReceived: true },
        details: SA_DETAILS,
        documents: PENDING_DOCS,
        deposit: {
          reference: "AB-7K3F2",
          status: "received",
          amount: 5000,
          receivedAt: Date.UTC(2026, 10, 22, 8, 40),
        },
      })
    );
    renderStatus(LOT_ENTRY);
    expect(screen.getByText("Deposit received")).toBeInTheDocument();
    expect(
      within(row("Deposit")).getByText(
        `R${SP}5${SP}000 received Sun 22 Nov, 10:40`
      )
    ).toBeInTheDocument();
    expect(within(row("Deposit")).queryByRole("link")).toBeNull();
    expect(
      screen.getByText("Bidding opens when your documents are approved.")
    ).toBeInTheDocument();
  });

  it("approved: You can bid and a Bid on Lot 3 button", () => {
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        eligibility: { kind: "ok" },
        details: SA_DETAILS,
        documents: [
          makeDoc("id_front", "approved"),
          makeDoc("id_back", "approved"),
          makeDoc("proof_of_address", "approved"),
        ],
        deposit: {
          reference: "AB-7K3F2",
          status: "received",
          amount: 5000,
          receivedAt: 1,
        },
      })
    );
    renderStatus(LOT_ENTRY);
    expect(screen.getByText("You can bid")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bid on Lot 3" })).toHaveAttribute(
      "href",
      `/auction/${LOT_ID}`
    );
    expect(screen.queryByRole("link", { name: /Back to/ })).toBeNull();
  });

  it("deposit off: no deposit row and no deposit lines", () => {
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        eligibility: { kind: "under_review", depositReceived: false },
        details: SA_DETAILS,
        documents: PENDING_DOCS,
        submittedAt: SENT_AT,
        depositSettings: { enabled: false, amount: 5000, refundDays: 3 },
      })
    );
    renderStatus(LOT_ENTRY);
    expect(screen.queryByText("Deposit", { selector: "b" })).toBeNull();
    expect(screen.queryByText(/deposit, refunded/)).toBeNull();
  });

  it("without a callback: See auctions", () => {
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        eligibility: { kind: "under_review", depositReceived: false },
        details: SA_DETAILS,
        documents: PENDING_DOCS,
      })
    );
    renderStatus();
    expect(screen.getByRole("link", { name: "See auctions" })).toHaveAttribute(
      "href",
      "/"
    );
  });

  it("without a lot number the buttons say 'lot'", () => {
    setQuery(api.auctions.getLotHeadline, { title: "Baler" });
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        eligibility: { kind: "ok" },
        details: SA_DETAILS,
        documents: [],
      })
    );
    renderStatus(LOT_ENTRY);
    expect(
      screen.getByRole("link", { name: "Bid on lot" })
    ).toBeInTheDocument();
  });

  it("deposit due: asks for the deposit", () => {
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        eligibility: { kind: "deposit_due", amount: 5000 },
        details: SA_DETAILS,
        documents: [
          makeDoc("id_front", "approved"),
          makeDoc("id_back", "approved"),
          makeDoc("proof_of_address", "approved"),
        ],
      })
    );
    renderStatus(LOT_ENTRY);
    expect(
      screen.getByText(`Pay your R${SP}5${SP}000 deposit to bid.`)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to Lot 3" })
    ).toBeInTheDocument();
  });

  it("redirects an unfinished registration to its step", () => {
    setQuery(api.registration.getMyRegistration, makeRegistration());
    renderStatus();
    expect(screen.getByTestId("loc")).toHaveTextContent("/register/details");
  });
});
