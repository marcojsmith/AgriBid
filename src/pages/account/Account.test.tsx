import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { api } from "convex/_generated/api";
import type { FunctionReference } from "convex/server";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, matchPath } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeDetails,
  makeDoc,
  makeRegistration,
  resetConvexState,
  setQuery,
} from "@/pages/register/testing";

import Account from "./Account";

const hooks = vi.hoisted(
  (): {
    user: unknown;
    push: { state: string; busy: boolean };
    signOut: ReturnType<typeof vi.fn>;
    won: unknown[];
  } => ({
    user: undefined,
    push: { state: "on", busy: false },
    signOut: vi.fn(),
    won: [],
  })
);

vi.mock("convex/react", async () => {
  const t = await import("@/pages/register/testing");
  return {
    useQuery: t.mockUseQuery,
    useMutation: t.mockUseMutation,
    useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
    usePaginatedQuery: (_ref: FunctionReference<"query">, args: unknown) => ({
      results: args === "skip" ? [] : hooks.won,
      status: "Exhausted",
      loadMore: vi.fn(),
    }),
  };
});
vi.mock("@/hooks/useUserProfile", () => ({
  useUserProfile: () => hooks.user,
}));
vi.mock("@/hooks/usePushStatus", () => ({
  usePushStatus: () => hooks.push,
}));
vi.mock("@/hooks/useSignOut", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/useSignOut")>()),
  useSignOut: () => hooks.signOut,
}));
vi.mock("@/hooks/useBranding", () => ({
  useBranding: () => ({ businessInfo: { whatsapp: "+27 83 700 0000" } }),
}));

const NOW = Date.now();
const user = {
  _id: "u",
  userId: "user_1",
  name: "Thandi Naidoo",
  email: "thandi@example.co.za",
  profile: {
    userId: "user_1",
    companyName: "Naidoo Landbou",
    vatRegistered: true,
  },
};
const details = makeDetails({
  idType: "sa_id",
  fullName: "Thandi Naidoo",
  phoneNumber: "+27825550147",
  idNumberLast3: "084",
  streetAddress: "14 Kerk Street",
  town: "Malmesbury",
  postalCode: "7300",
});

/** What a test can change about the signed-in user. */
interface SeedOptions {
  eligibility?: ReturnType<typeof makeRegistration>["eligibility"];
  stats?: { all: number; active: number; sold: number };
  awaiting?: number;
  deposit?: {
    reference: string;
    status: "received" | "refund_requested" | "refunded";
    amount: number;
    receivedAt?: number;
  };
  documents?: ReturnType<typeof makeRegistration>["documents"];
}

/**
 * Registers the queries of a signed-in user.
 *
 * @param over - Overrides
 */
function seed(over: SeedOptions = {}) {
  hooks.user = user;
  setQuery(
    api.registration.getMyRegistration,
    makeRegistration({
      eligibility: over.eligibility ?? { kind: "ok" },
      details,
      documents: over.documents ?? [],
      deposit: over.deposit ?? {
        reference: "AB-1",
        status: "received",
        amount: 5000,
        receivedAt: NOW,
      },
    })
  );
  setQuery(api.lotPayments.getMyPaymentSummary, {
    unpaidCount: over.awaiting ?? 0,
    awaitingCount: over.awaiting ?? 0,
    claimedCount: 0,
    nextPayBy: over.awaiting ? NOW + 86_400_000 : null,
    nextAmountDue: over.awaiting ? 113_496 : null,
    nextLotId: null,
  });
  setQuery(
    api.auctions.getMyListingsStats,
    over.stats ?? { all: 3, active: 2, sold: 1 }
  );
  setQuery(api.userPreferences.getMyPreferences, null);
  setQuery(api.sellers.getSellerSlugByUserId, "naidoo-landbou");
}

/** Renders the page. */
function renderPage() {
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/account"]}>
        <Account />
      </MemoryRouter>
    </HelmetProvider>
  );
}

beforeEach(() => {
  resetConvexState();
  hooks.user = undefined;
  hooks.push = { state: "on", busy: false };
  hooks.won = [];
  hooks.signOut.mockReset().mockResolvedValue(undefined);
});

describe("Account", () => {
  it("shows a skeleton while loading", () => {
    renderPage();
    expect(
      screen.getByRole("status", { name: "Loading account" })
    ).toBeInTheDocument();
  });

  it("renders every section in order for a seller with a payment due", () => {
    seed({ awaiting: 1 });
    hooks.won = [
      {
        title: "JCB 3CX",
        lotNumber: 1,
        depositCredit: 5000,
        amountDue: 113_496,
      },
    ];
    renderPage();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Account"
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/Pay R/);
    expect(screen.getByRole("link", { name: "Pay now" })).toHaveAttribute(
      "href",
      "/dashboard/bids?tab=won"
    );
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(headings).toEqual([
      "Selling",
      "Bidding",
      "Notifications",
      "Details",
    ]);
    expect(screen.getByText("2 live · 1 sold")).toBeInTheDocument();
    expect(
      screen.getByText("Naidoo Landbou · VAT registered")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /View my public page/ })
    ).toHaveAttribute("href", "/profile/user_1");
    expect(screen.getByText("You can bid")).toBeInTheDocument();
    expect(screen.getByText(/Credited to Lot 1 JCB 3CX/)).toBeInTheDocument();
    expect(screen.getByText("On · 3 alerts")).toBeInTheDocument();
    expect(screen.getByText("Ends in 084")).toBeInTheDocument();
    expect(
      screen.getByText("14 Kerk Street, Malmesbury 7300")
    ).toBeInTheDocument();
    expect(
      screen.getByText("thandi@example.co.za", { selector: "span" })
    ).toBeInTheDocument();
  });

  it("keeps the skeleton until the payment summary and preferences arrive", () => {
    seed();
    setQuery(api.lotPayments.getMyPaymentSummary, undefined);
    renderPage();
    expect(
      screen.getByRole("status", { name: "Loading account" })
    ).toBeInTheDocument();
  });

  it("marks the first section, then the one scrolled into view", () => {
    seed();
    const observers: ((entries: unknown[]) => void)[] = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: (entries: unknown[]) => void) {
          observers.push(cb);
        }
        observe = vi.fn();
        disconnect = vi.fn();
      }
    );
    renderPage();
    const nav = screen.getByRole("navigation", { name: "Account sections" });
    expect(within(nav).getByRole("link", { name: "Selling" })).toHaveAttribute(
      "aria-current",
      "location"
    );
    act(() => {
      observers[0]?.([
        {
          isIntersecting: true,
          boundingClientRect: { top: 10 },
          target: { id: "details" },
        },
        {
          isIntersecting: true,
          boundingClientRect: { top: 400 },
          target: { id: "bidding" },
        },
        {
          isIntersecting: false,
          boundingClientRect: { top: 0 },
          target: { id: "selling" },
        },
      ]);
    });
    expect(within(nav).getByRole("link", { name: "Details" })).toHaveAttribute(
      "aria-current",
      "location"
    );
    fireEvent.click(within(nav).getByRole("link", { name: "Bidding" }));
    expect(within(nav).getByRole("link", { name: "Bidding" })).toHaveAttribute(
      "aria-current",
      "location"
    );
    vi.unstubAllGlobals();
  });

  it("links the public page to a route that exists today", () => {
    seed();
    renderPage();
    const href =
      screen
        .getByRole("link", { name: /View my public page/ })
        .getAttribute("href") ?? "";
    // App.test.tsx renders /profile/:userId; /sellers/:slug arrives with M6.
    expect(matchPath("/profile/:userId", href)).not.toBeNull();
  });

  it("hides the public page link when there is no slug", () => {
    seed();
    setQuery(api.sellers.getSellerSlugByUserId, null);
    renderPage();
    expect(screen.queryByText(/View my public page/)).toBeNull();
  });

  it("has no banner when all is well", () => {
    seed();
    renderPage();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("puts Sell equipment under Bidding for a buyer who never sold", () => {
    seed({ stats: { all: 0, active: 0, sold: 0 } });
    renderPage();
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(headings).toEqual(["Bidding", "Notifications", "Details"]);
    const bidding = screen.getByRole("region", { name: "Bidding" });
    expect(
      within(bidding).getByRole("link", { name: /Sell equipment/ })
    ).toHaveAttribute("href", "/sell");
  });

  it("offers Replace for a rejected document", () => {
    seed({
      eligibility: { kind: "needs_replacing", count: 1 },
      documents: [makeDoc("id_front", "rejected")],
    });
    renderPage();
    expect(
      screen.getByRole("link", { name: "Replace document" })
    ).toHaveAttribute("href", "/register/id?callbackUrl=%2Faccount&replace=1");
    expect(screen.getByRole("link", { name: "Replace" })).toHaveAttribute(
      "href",
      "/register/id?callbackUrl=%2Faccount&replace=1"
    );
  });

  it("links the Details rows to registration while it is unfinished", () => {
    seed({ eligibility: { kind: "incomplete", step: 2, totalSteps: 4 } });
    renderPage();
    const details = screen.getByRole("region", { name: "Details" });
    expect(within(details).getByRole("link", { name: /Name/ })).toHaveAttribute(
      "href",
      "/register/details?callbackUrl=%2Faccount"
    );
    expect(
      within(details).getByText(/we check your documents again/)
    ).toBeInTheDocument();
  });

  it("makes Details read-only after registration, with a WhatsApp line", () => {
    seed();
    renderPage();
    const details = screen.getByRole("region", { name: "Details" });
    expect(within(details).queryByRole("link", { name: /Name/ })).toBeNull();
    expect(
      within(details).queryByText(/check your documents again/)
    ).toBeNull();
    expect(
      within(details).getByRole("link", { name: /WhatsApp us/ })
    ).toHaveAttribute("href", "https://wa.me/27837000000");
  });

  it("links the deposit row to the deposit page", () => {
    seed();
    renderPage();
    expect(screen.getByRole("link", { name: /Deposit/ })).toHaveAttribute(
      "href",
      "/account/deposit"
    );
  });

  it("links an unpaid deposit to payment", () => {
    seed({
      deposit: { reference: "AB-1", status: "received", amount: 5000 },
    });
    setQuery(
      api.registration.getMyRegistration,
      makeRegistration({ eligibility: { kind: "ok" }, details, deposit: null })
    );
    renderPage();
    expect(screen.getByRole("link", { name: /Deposit/ })).toHaveAttribute(
      "href",
      "/register/deposit?callbackUrl=%2Faccount"
    );
  });

  it("signs out", () => {
    seed();
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(hooks.signOut).toHaveBeenCalled();
  });

  it("copes with a user who has no registration yet", () => {
    seed({ stats: { all: 0, active: 0, sold: 0 } });
    setQuery(api.registration.getMyRegistration, null);
    renderPage();
    expect(
      screen.getByRole("link", { name: "Sell equipment" })
    ).toHaveAttribute("href", "/sell");
    expect(screen.queryByRole("link", { name: /Name/ })).toBeNull();
  });
});
