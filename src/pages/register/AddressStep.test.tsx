import { fireEvent, screen, waitFor } from "@testing-library/react";
import { api } from "convex/_generated/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AddressStep from "./AddressStep";
import {
  makeDoc,
  makeRegistration,
  mutationMock,
  renderAt,
  resetConvexState,
  SA_DETAILS,
  setQuery,
} from "./testing";

const showToast = vi.hoisted(() => vi.fn());
vi.mock("convex/react", async () => {
  const t = await import("./testing");
  return { useQuery: t.mockUseQuery, useMutation: t.mockUseMutation };
});
vi.mock("@/components/ds/showToast", () => ({ showToast }));
vi.mock("@/hooks/useRegistrationUpload", () => ({
  useRegistrationUpload: () => ({
    upload: vi.fn(),
    uploadingKind: null,
    error: null,
  }),
}));

const STEP3 = { kind: "incomplete", step: 3, totalSteps: 4 } as const;
const ID_DOCS = [makeDoc("id_front"), makeDoc("id_back")];

/**
 * Renders the address step.
 *
 * @param entry - The URL
 */
function renderStep(entry = "/register/address") {
  renderAt(<AddressStep />, "/register/address", entry);
}

describe("AddressStep", () => {
  beforeEach(() => {
    resetConvexState();
    showToast.mockReset();
    mutationMock(api.registration.submitMyDocuments).mockResolvedValue({
      submittedAt: 1,
    });
  });

  it("shows the proof of address copy and checklist", () => {
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({ eligibility: STEP3, details: SA_DETAILS })
    );
    renderStep();
    expect(
      screen.getByRole("group", { name: "Step 3 of 4, Address" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Proof of address" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "A utility bill, bank statement or lease, not older than 3 months. Photo or PDF."
      )
    ).toBeInTheDocument();
    for (const item of [
      "Your name and address are visible",
      "All 4 corners visible",
      "Issued in the last 3 months",
    ]) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });

  it("keeps Next: deposit disabled until the proof is uploaded", () => {
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        eligibility: STEP3,
        details: SA_DETAILS,
        documents: ID_DOCS,
      })
    );
    renderStep();
    expect(
      screen.getByRole("button", { name: "Next: deposit" })
    ).toBeDisabled();
  });

  it("submits and goes to the deposit step", async () => {
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        eligibility: STEP3,
        details: SA_DETAILS,
        documents: [...ID_DOCS, makeDoc("proof_of_address")],
      })
    );
    renderStep("/register/address?callbackUrl=%2Fauction%2Fabc");
    fireEvent.click(screen.getByRole("button", { name: "Next: deposit" }));
    await waitFor(() => {
      expect(screen.getByTestId("loc")).toHaveTextContent(
        "/register/deposit?callbackUrl=%2Fauction%2Fabc"
      );
    });
    expect(
      mutationMock(api.registration.submitMyDocuments)
    ).toHaveBeenCalledOnce();
  });

  it("with the deposit off: 3 steps, 'Send documents', then the status page", async () => {
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        eligibility: { kind: "incomplete", step: 3, totalSteps: 3 },
        details: SA_DETAILS,
        documents: [...ID_DOCS, makeDoc("proof_of_address")],
        depositSettings: { enabled: false, amount: 5000, refundDays: 3 },
      })
    );
    renderStep();
    expect(
      screen.getByRole("group", { name: "Step 3 of 3, Address" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next: deposit" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Send documents" }));
    await waitFor(() => {
      expect(screen.getByTestId("loc")).toHaveTextContent("/register/status");
    });
  });

  it("shows an error toast and stays when submitting fails", async () => {
    mutationMock(api.registration.submitMyDocuments).mockRejectedValue(
      new Error("boom")
    );
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        eligibility: STEP3,
        details: SA_DETAILS,
        documents: [...ID_DOCS, makeDoc("proof_of_address")],
      })
    );
    renderStep();
    fireEvent.click(screen.getByRole("button", { name: "Next: deposit" }));
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(expect.any(String), "error");
    });
    expect(screen.queryByTestId("loc")).toBeNull();
  });

  it("never submits twice: a submitted registration goes to the status page", () => {
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        eligibility: { kind: "under_review", depositReceived: false },
        details: SA_DETAILS,
        documents: [...ID_DOCS, makeDoc("proof_of_address")],
      })
    );
    renderStep();
    expect(screen.getByTestId("loc")).toHaveTextContent("/register/status");
    expect(
      mutationMock(api.registration.submitMyDocuments)
    ).not.toHaveBeenCalled();
  });

  it.each([
    [1, "/register/details"],
    [2, "/register/id"],
  ] as const)("redirects an earlier step %i to %s", (step, expected) => {
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        eligibility: { kind: "incomplete", step, totalSteps: 4 },
      })
    );
    renderStep();
    expect(screen.getByTestId("loc")).toHaveTextContent(expected);
  });

  it("replace mode: reason above an empty slot, no Next, back to status after upload", () => {
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        eligibility: { kind: "needs_replacing", count: 1 },
        details: SA_DETAILS,
        documents: [
          ...ID_DOCS,
          makeDoc("proof_of_address", "rejected", {
            rejectionReason: "The bill is older than 3 months.",
            reviewedAt: Date.UTC(2026, 10, 22, 9, 40),
          }),
        ],
      })
    );
    renderStep("/register/address?replace=1");
    expect(
      screen.getByText("The bill is older than 3 months.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Take photo, Proof of address" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Next|Send/ })).toBeNull();
  });
});
