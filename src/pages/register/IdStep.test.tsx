import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { api } from "convex/_generated/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

import IdStep from "./IdStep";
import {
  makeDoc,
  makeRegistration,
  renderAt,
  resetConvexState,
  SA_DETAILS,
  setQuery,
} from "./testing";

const upload = vi.hoisted(() => vi.fn());
vi.mock("convex/react", async () => {
  const t = await import("./testing");
  return { useQuery: t.mockUseQuery, useMutation: t.mockUseMutation };
});
vi.mock("@/hooks/useRegistrationUpload", () => ({
  useRegistrationUpload: () => ({
    upload,
    uploadingKind: null,
    error: null,
  }),
}));

const STEP2 = { kind: "incomplete", step: 2, totalSteps: 4 } as const;

/**
 * Picks a file in a slot through its "Choose file" input.
 *
 * @param label - The slot label
 */
function pickFile(label: string) {
  const slot = screen
    .getByRole("button", { name: `Choose file, ${label}` })
    .closest("[data-slot=upload-slot]");
  const input = slot?.querySelector("input[accept='image/*,application/pdf']");
  if (!(input instanceof HTMLInputElement)) throw new Error("No file input");
  fireEvent.change(input, {
    target: { files: [new File(["x"], "scan.jpg", { type: "image/jpeg" })] },
  });
}

/**
 * Renders the ID step.
 *
 * @param entry - The URL
 */
function renderStep(entry = "/register/id") {
  renderAt(<IdStep />, "/register/id", entry);
}

describe("IdStep (SA ID)", () => {
  beforeEach(() => {
    resetConvexState();
    upload.mockReset();
    upload.mockResolvedValue(true);
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({ eligibility: STEP2, details: SA_DETAILS })
    );
  });

  it("shows the ID copy, two slots and the checklist", () => {
    renderStep();
    expect(
      screen.getByRole("group", { name: "Step 2 of 4, ID" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Upload your ID" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Smart ID card: front and back. ID book: the photo page."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("ID front")).toBeInTheDocument();
    expect(screen.getByText("ID back")).toBeInTheDocument();
    for (const item of [
      "Names match your ID",
      "In colour",
      "All 4 corners visible",
      "Not expired",
    ]) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });

  it("keeps Next disabled until both slots are filled", () => {
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        eligibility: STEP2,
        details: SA_DETAILS,
        documents: [makeDoc("id_front")],
      })
    );
    renderStep();
    expect(
      screen.getByRole("button", { name: "Next: proof of address" })
    ).toBeDisabled();
    expect(
      screen.getByText("id_front.jpg ·", { exact: false })
    ).toBeInTheDocument();
  });

  it("uploads through the hook and enables Next once complete", async () => {
    renderStep();
    pickFile("ID front");
    await waitFor(() => {
      expect(upload).toHaveBeenCalledWith("id_front", expect.any(File));
    });
  });

  it("goes to the address step, keeping the callback", () => {
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        eligibility: { kind: "incomplete", step: 3, totalSteps: 4 },
        details: SA_DETAILS,
        documents: [makeDoc("id_front"), makeDoc("id_back")],
      })
    );
    renderStep("/register/id?callbackUrl=%2Fauction%2Fabc");
    const next = screen.getByRole("button", { name: "Next: proof of address" });
    expect(next).toBeEnabled();
    fireEvent.click(next);
    return waitFor(() => {
      expect(screen.getByTestId("loc")).toHaveTextContent(
        "/register/address?callbackUrl=%2Fauction%2Fabc"
      );
    });
  });

  it("sends a submitted registration to the status page", () => {
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        eligibility: { kind: "ok" },
        details: SA_DETAILS,
        documents: [
          makeDoc("id_front", "approved"),
          makeDoc("id_back", "approved"),
        ],
      })
    );
    renderStep();
    expect(screen.getByTestId("loc")).toHaveTextContent("/register/status");
  });

  it("redirects to step 1 until the details are saved", () => {
    setQuery(api.registration.getMyRegistration, makeRegistration());
    renderStep();
    expect(screen.getByTestId("loc")).toHaveTextContent("/register/details");
  });
});

describe("IdStep (passport)", () => {
  beforeEach(() => {
    resetConvexState();
    upload.mockReset();
    upload.mockResolvedValue(true);
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        eligibility: STEP2,
        details: { ...SA_DETAILS, idType: "passport", passportNumber: "N1" },
      })
    );
  });

  it("swaps the copy, the label and the slots", () => {
    renderStep();
    expect(
      screen.getByRole("group", { name: "Step 2 of 4, Passport" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Passport photo page" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("The page with your photo and details.")
    ).toBeInTheDocument();
    expect(screen.getByText("Names match your passport")).toBeInTheDocument();
    expect(screen.queryByText("ID back")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Choose file, Passport photo page" })
    ).toBeInTheDocument();
  });
});

describe("IdStep (replace mode)", () => {
  beforeEach(() => {
    resetConvexState();
    upload.mockReset();
    upload.mockResolvedValue(true);
  });

  it("shows the reason above an empty slot, has no Next, and returns to status after upload", async () => {
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        eligibility: { kind: "needs_replacing", count: 1 },
        details: SA_DETAILS,
        documents: [
          makeDoc("id_front", "approved"),
          makeDoc("id_back", "rejected", {
            rejectionReason: "The back is blurry.",
            reviewedAt: Date.UTC(2026, 10, 22, 9, 40),
          }),
        ],
      })
    );
    renderStep("/register/id?replace=1&callbackUrl=%2Fauction%2Fabc");

    expect(screen.getByText("The back is blurry.")).toBeInTheDocument();
    expect(screen.getByText("Checked Sun 22 Nov, 11:40")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Take photo, ID back" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Next:/ })).toBeNull();

    pickFile("ID back");
    await waitFor(() => {
      expect(screen.getByTestId("loc")).toHaveTextContent(
        "/register/status?callbackUrl=%2Fauction%2Fabc"
      );
    });
    expect(upload).toHaveBeenCalledWith("id_back", expect.any(File));
  });

  it("stays on the step while another document is still rejected", async () => {
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        eligibility: { kind: "needs_replacing", count: 2 },
        details: SA_DETAILS,
        documents: [
          makeDoc("id_front", "rejected", {
            reviewedAt: 1,
            rejectionReason: "a",
          }),
          makeDoc("id_back", "rejected", {
            reviewedAt: 1,
            rejectionReason: "b",
          }),
        ],
      })
    );
    renderStep("/register/id?replace=1");
    pickFile("ID front");
    await waitFor(() => {
      expect(upload).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("loc")).toBeNull();
    expect(within(document.body).getAllByText("Why")).toHaveLength(2);
  });

  it("stays put when the upload fails", async () => {
    upload.mockResolvedValue(false);
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        eligibility: { kind: "needs_replacing", count: 1 },
        details: SA_DETAILS,
        documents: [
          makeDoc("id_front", "approved"),
          makeDoc("id_back", "rejected", {
            reviewedAt: 1,
            rejectionReason: "a",
          }),
        ],
      })
    );
    renderStep("/register/id?replace=1");
    pickFile("ID back");
    await waitFor(() => {
      expect(upload).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("loc")).toBeNull();
  });
});
