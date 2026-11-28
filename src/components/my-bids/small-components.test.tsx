import { render, screen } from "@testing-library/react";
import { api } from "convex/_generated/api";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeRegistration,
  resetConvexState,
  setQuery,
} from "@/pages/register/testing";

import { AlertsSummary } from "./AlertsSummary";
import { makeBidRow } from "./fixtures";
import { LostRow } from "./LostRow";
import { RegistrationBanner } from "./RegistrationBanner";
import { RegistrationRail } from "./RegistrationRail";
import { TabEmpty } from "./TabEmpty";

vi.mock("convex/react", async () => {
  const t = await import("@/pages/register/testing");
  return { useQuery: t.mockUseQuery };
});

const NOW = Date.UTC(2026, 10, 25, 6, 30);

describe("LostRow", () => {
  it("shows a lot sold to someone else with what it sold for", () => {
    render(
      <MemoryRouter>
        <LostRow
          row={makeBidRow(NOW, {
            title: "Ford 5000",
            status: "sold",
            myHighestBid: 58_000,
            currentPrice: 61_000,
            auctionEndTime: Date.UTC(2026, 10, 24, 9, 0),
          })}
        />
      </MemoryRouter>
    );
    expect(screen.getByText("Lost")).toBeVisible();
    expect(screen.getByText("Sold for")).toBeVisible();
    expect(screen.getByText("Closed Tue 24 Nov, 11:00")).toBeVisible();
  });

  it("shows an unsold lot with the highest bid and the reserve", () => {
    render(
      <MemoryRouter>
        <LostRow
          row={makeBidRow(NOW, {
            status: "unsold",
            myHighestBid: 62_000,
            auctionEndTime: undefined,
          })}
        />
      </MemoryRouter>
    );
    expect(screen.getByText("Not sold")).toBeVisible();
    expect(screen.getByText("Your highest bid")).toBeVisible();
    expect(screen.getByText("Not met")).toBeVisible();
    expect(screen.queryByText(/^Closed/)).toBeNull();
  });

  it("uses the soft-close end as the closing time", () => {
    render(
      <MemoryRouter>
        <LostRow
          row={makeBidRow(NOW, {
            status: "sold",
            extendedEndTime: Date.UTC(2026, 10, 24, 9, 2),
          })}
        />
      </MemoryRouter>
    );
    expect(screen.getByText("Closed Tue 24 Nov, 11:02")).toBeVisible();
  });
});

describe("RegistrationBanner", () => {
  it("renders nothing for a buyer who can bid", () => {
    const { container } = render(
      <MemoryRouter>
        <RegistrationBanner eligibility={{ kind: "ok" }} />
      </MemoryRouter>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("asks an unfinished buyer to continue", () => {
    render(
      <MemoryRouter>
        <RegistrationBanner
          eligibility={{ kind: "incomplete", step: 2, totalSteps: 4 }}
        />
      </MemoryRouter>
    );
    expect(
      screen.getByText("Finish registration to bid. Step 2 of 4.")
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Continue registration" })
    ).toHaveAttribute("href", "/register");
  });

  it("links a buyer under review to the status page", () => {
    render(
      <MemoryRouter>
        <RegistrationBanner
          eligibility={{ kind: "under_review", depositReceived: false }}
        />
      </MemoryRouter>
    );
    expect(
      screen.getByRole("link", { name: "See my registration" })
    ).toHaveAttribute("href", "/register/status");
  });
});

describe("TabEmpty", () => {
  it("shows the title, text and a Browse auctions link", () => {
    render(
      <MemoryRouter>
        <TabEmpty
          title="No bids yet"
          text="Lots you bid on show here."
          browse
          primary
        />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "No bids yet" })).toBeVisible();
    expect(screen.getByText("Lots you bid on show here.")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Browse auctions" })
    ).toHaveAttribute("href", "/auctions");
  });

  it("can be just a title", () => {
    render(
      <MemoryRouter>
        <TabEmpty title="No lost lots" />
      </MemoryRouter>
    );
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("AlertsSummary", () => {
  beforeEach(() => {
    resetConvexState();
  });

  it("shows a skeleton while preferences load", () => {
    render(
      <MemoryRouter>
        <AlertsSummary />
      </MemoryRouter>
    );
    expect(screen.queryByText(/Alerts/)).toBeNull();
  });

  it("is on by default (no saved preferences)", () => {
    setQuery(api.userPreferences.getMyPreferences, null);
    render(
      <MemoryRouter>
        <AlertsSummary />
      </MemoryRouter>
    );
    expect(screen.getByText("Alerts on")).toBeVisible();
    expect(screen.getByRole("link", { name: "Change" })).toHaveAttribute(
      "href",
      "/settings"
    );
  });

  it("says when the buyer turned them off", () => {
    setQuery(api.userPreferences.getMyPreferences, {
      notificationsWatchedLots: false,
    });
    render(
      <MemoryRouter>
        <AlertsSummary />
      </MemoryRouter>
    );
    expect(screen.getByText("Alerts off")).toBeVisible();
  });
});

describe("RegistrationRail", () => {
  beforeEach(() => {
    resetConvexState();
    setQuery(api.userPreferences.getMyPreferences, null);
  });

  it("shows the registration status and alerts", () => {
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({ eligibility: { kind: "ok" } })
    );
    render(
      <MemoryRouter>
        <RegistrationRail />
      </MemoryRouter>
    );
    expect(
      screen.getByRole("heading", { name: "Your registration" })
    ).toBeInTheDocument();
    expect(screen.getByText("You can bid")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Alerts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Registration/ })).toHaveAttribute(
      "href",
      "/register/status"
    );
  });

  it("shows only alerts for a user with no registration yet", () => {
    setQuery(api.registration.getMyRegistration, null);
    render(
      <MemoryRouter>
        <RegistrationRail />
      </MemoryRouter>
    );
    expect(screen.queryByText("Your registration")).toBeNull();
    expect(screen.getByText("Alerts")).toBeInTheDocument();
  });

  it("is hidden below lg", () => {
    setQuery(api.registration.getMyRegistration, null);
    render(
      <MemoryRouter>
        <RegistrationRail />
      </MemoryRouter>
    );
    expect(screen.getByRole("complementary", { hidden: true })).toHaveClass(
      "hidden",
      "lg:block"
    );
  });
});
