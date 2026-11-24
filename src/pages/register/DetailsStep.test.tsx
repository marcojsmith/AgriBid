import { fireEvent, screen, waitFor } from "@testing-library/react";
import { api } from "convex/_generated/api";
import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DetailsStep from "./DetailsStep";
import {
  makeRegistration,
  mutationMock,
  renderAt,
  resetConvexState,
  SA_DETAILS,
  setQuery,
} from "./testing";

vi.mock("convex/react", async () => {
  const t = await import("./testing");
  return { useQuery: t.mockUseQuery, useMutation: t.mockUseMutation };
});

/**
 * Renders the details step.
 *
 * @param entry - The URL
 */
function renderStep(entry = "/register/details") {
  renderAt(<DetailsStep />, "/register/details", entry);
}

/**
 * Types into a labelled field.
 *
 * @param label - The field label
 * @param value - The text
 */
function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("DetailsStep", () => {
  beforeEach(() => {
    resetConvexState();
    setQuery(api.registration.getMyRegistration, makeRegistration());
    mutationMock(api.registration.saveMyDetails).mockResolvedValue({
      success: true,
    });
  });

  it("shows the SA ID form with 4 steps", () => {
    renderStep();
    expect(
      screen.getByRole("group", { name: "Step 1 of 4, Details" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Your details" })
    ).toBeInTheDocument();
    expect(screen.getByText("As they appear on your ID.")).toBeInTheDocument();
    expect(screen.getByText("+27")).toBeInTheDocument();
    expect(screen.getByLabelText("ID number")).toBeInTheDocument();
    expect(screen.getByText("13 digits.")).toBeInTheDocument();
    expect(
      screen.getByText("We call you about lots you win.")
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Passport number")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Next: upload ID" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SA ID" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("passport mode swaps the fields, intro and button", () => {
    renderStep();
    fireEvent.click(screen.getByRole("button", { name: "Passport" }));

    expect(
      screen.getByText("As they appear on your passport.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Passport number")).toBeInTheDocument();
    expect(screen.getByLabelText("Country of issue")).toBeInTheDocument();
    expect(screen.queryByLabelText("ID number")).toBeNull();
    expect(screen.queryByText("13 digits.")).toBeNull();
    expect(screen.queryByText("+27")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Next: upload passport" })
    ).toBeInTheDocument();
  });

  it("uses 3 steps when the deposit is off", () => {
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        depositSettings: { enabled: false, amount: 5000, refundDays: 3 },
      })
    );
    renderStep();
    expect(
      screen.getByRole("group", { name: "Step 1 of 3, Details" })
    ).toBeInTheDocument();
  });

  it("prefills saved details and strips +27 from the phone", () => {
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({
        details: SA_DETAILS,
        eligibility: { kind: "incomplete", step: 2, totalSteps: 4 },
      })
    );
    renderStep();
    expect(screen.getByLabelText("Full name")).toHaveValue("Thandi Naidoo");
    expect(screen.getByLabelText("Mobile number")).toHaveValue("825550147");
    expect(screen.getByLabelText("ID number")).toHaveValue("8001015009087");
    expect(screen.getByLabelText("Postal code")).toHaveValue("7300");
  });

  it("shows no errors while typing, only on submit", () => {
    renderStep();
    type("ID number", "123");
    type("Postal code", "7");
    expect(screen.queryByRole("alert")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next: upload ID" }));
    expect(
      screen.getByText("Enter a valid 13-digit ID number.")
    ).toBeInTheDocument();
    expect(screen.getByText("Enter a valid postal code.")).toBeInTheDocument();
    expect(screen.getByText("Enter your full name.")).toBeInTheDocument();
    expect(mutationMock(api.registration.saveMyDetails)).not.toHaveBeenCalled();
  });

  it("flags a bad passport number on submit", () => {
    renderStep();
    fireEvent.click(screen.getByRole("button", { name: "Passport" }));
    type("Passport number", "!");
    fireEvent.click(
      screen.getByRole("button", { name: "Next: upload passport" })
    );
    expect(
      screen.getByText("Enter a valid passport number.")
    ).toBeInTheDocument();
    expect(screen.getByText("Enter the country of issue.")).toBeInTheDocument();
  });

  it("saves valid SA ID details and goes to the ID step, keeping the callback", async () => {
    renderStep("/register/details?callbackUrl=%2Fauction%2Fabc");
    type("Full name", "Thandi Naidoo");
    type("Mobile number", "82 555 0147");
    type("ID number", "8001 0150 0908 7");
    type("Street address", "14 Kerk Street");
    type("Town", "Malmesbury");
    type("Postal code", "7300");
    fireEvent.click(screen.getByRole("button", { name: "Next: upload ID" }));

    await waitFor(() => {
      expect(screen.getByTestId("loc")).toHaveTextContent(
        "/register/id?callbackUrl=%2Fauction%2Fabc"
      );
    });
    expect(mutationMock(api.registration.saveMyDetails)).toHaveBeenCalledWith({
      idType: "sa_id",
      fullName: "Thandi Naidoo",
      phoneNumber: "+27825550147",
      idNumber: "8001015009087",
      streetAddress: "14 Kerk Street",
      town: "Malmesbury",
      postalCode: "7300",
    });
  });

  it("saves passport details with the full phone number", async () => {
    renderStep();
    fireEvent.click(screen.getByRole("button", { name: "Passport" }));
    type("Full name", "Anna Schmidt");
    type("Mobile number", "+264 81 555 0147");
    type("Passport number", "n0123456");
    type("Country of issue", "Namibia");
    type("Street address", "22 Beethoven Street");
    type("Town", "Windhoek");
    type("Postal code", "10005");
    fireEvent.click(
      screen.getByRole("button", { name: "Next: upload passport" })
    );

    await waitFor(() => {
      expect(mutationMock(api.registration.saveMyDetails)).toHaveBeenCalledWith(
        {
          idType: "passport",
          fullName: "Anna Schmidt",
          phoneNumber: "+264815550147",
          passportNumber: "N0123456",
          countryOfIssue: "Namibia",
          streetAddress: "22 Beethoven Street",
          town: "Windhoek",
          postalCode: "10005",
        }
      );
    });
  });

  it("shows a server error such as 'under review' as a warning banner and stays", async () => {
    mutationMock(api.registration.saveMyDetails).mockRejectedValue(
      new ConvexError("Your details are under review.")
    );
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({ details: SA_DETAILS })
    );
    renderStep();
    fireEvent.click(screen.getByRole("button", { name: "Next: upload ID" }));

    const banner = await screen.findByText("Your details are under review.");
    expect(banner.closest("[data-slot=banner]")).toHaveAttribute(
      "data-kind",
      "warn"
    );
    expect(screen.queryByTestId("loc")).toBeNull();
  });

  it.each([
    { kind: "under_review", depositReceived: false },
    { kind: "needs_replacing", count: 1 },
    { kind: "ok" },
  ] as const)(
    "sends a submitted registration (%j) to the status page",
    (eligibility) => {
      setQuery(
        api.registration.getMyRegistration,
        makeRegistration({ details: SA_DETAILS, eligibility })
      );
      renderStep();
      expect(screen.getByTestId("loc")).toHaveTextContent("/register/status");
    }
  );

  it("shows a loading state until the registration arrives", () => {
    resetConvexState();
    renderStep();
    expect(
      screen.getByLabelText("Loading registration...")
    ).toBeInTheDocument();
  });
});
