import { screen } from "@testing-library/react";
import { api } from "convex/_generated/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RegisterIndex from "./RegisterIndex";
import {
  makeRegistration,
  renderAt,
  resetConvexState,
  setQuery,
} from "./testing";

vi.mock("convex/react", async () => {
  const t = await import("./testing");
  return { useQuery: t.mockUseQuery, useMutation: t.mockUseMutation };
});

const ELIGIBILITIES = [
  [{ kind: "incomplete", step: 1, totalSteps: 4 }, "/register/details"],
  [{ kind: "incomplete", step: 2, totalSteps: 3 }, "/register/id"],
  [{ kind: "incomplete", step: 3, totalSteps: 4 }, "/register/address"],
  [{ kind: "under_review", depositReceived: false }, "/register/status"],
  [{ kind: "needs_replacing", count: 1 }, "/register/status"],
  [{ kind: "deposit_due", amount: 5000 }, "/register/status"],
  [{ kind: "ok" }, "/register/status"],
] as const;

describe("RegisterIndex", () => {
  beforeEach(() => {
    resetConvexState();
  });

  it.each(ELIGIBILITIES)("sends %j to %s", (eligibility, expected) => {
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({ eligibility })
    );
    renderAt(<RegisterIndex />, "/register", "/register");
    expect(screen.getByTestId("loc")).toHaveTextContent(expected);
  });

  it("keeps a safe callbackUrl", () => {
    setQuery(api.registration.getMyRegistration, makeRegistration());
    renderAt(
      <RegisterIndex />,
      "/register",
      "/register?callbackUrl=%2Fauction%2Fabc"
    );
    expect(screen.getByTestId("loc")).toHaveTextContent(
      "/register/details?callbackUrl=%2Fauction%2Fabc"
    );
  });

  it("drops an unsafe callbackUrl", () => {
    setQuery(api.registration.getMyRegistration, makeRegistration());
    renderAt(
      <RegisterIndex />,
      "/register",
      "/register?callbackUrl=%2F%2Fevil.com"
    );
    expect(screen.getByTestId("loc")).toHaveTextContent(
      /^\/register\/details$/
    );
  });

  it("shows a loading state until the registration arrives", () => {
    renderAt(<RegisterIndex />, "/register", "/register");
    expect(
      screen.getByLabelText("Loading registration...")
    ).toBeInTheDocument();
  });

  it("keeps loading when the user has no profile yet", () => {
    setQuery(api.registration.getMyRegistration, null);
    renderAt(<RegisterIndex />, "/register", "/register");
    expect(
      screen.getByLabelText("Loading registration...")
    ).toBeInTheDocument();
  });
});
