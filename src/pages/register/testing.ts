/**
 * Shared test helpers for the registration pages: a stand-in for Convex's
 * `useQuery` / `useMutation` that answers by function name, a registration
 * fixture builder, and a router harness that shows where the page navigated.
 */

import { createElement, type ReactElement } from "react";
import { render } from "@testing-library/react";
import { getFunctionName, type FunctionReference } from "convex/server";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { vi, type Mock } from "vitest";

import type { Registration } from "@/lib/registrationCopy";

/** What the mocked Convex hooks return, keyed by function name. */
export const convexState: {
  queries: Record<string, unknown>;
  mutations: Record<string, Mock>;
} = { queries: {}, mutations: {} };

/**
 * Clears the query answers and mutation mocks.
 */
export function resetConvexState(): void {
  convexState.queries = {};
  convexState.mutations = {};
}

/**
 * Stand-in for `useQuery`: returns the answer registered for the function, or
 * undefined for "skip".
 *
 * @param ref - The function reference
 * @param args - The arguments, or "skip"
 * @returns The registered answer
 */
export function mockUseQuery(
  ref: FunctionReference<"query">,
  args?: unknown
): unknown {
  if (args === "skip") return undefined;
  return convexState.queries[getFunctionName(ref)];
}

/**
 * Stand-in for `useMutation`: returns the mock registered for the function.
 *
 * @param ref - The function reference
 * @returns The mutation mock (created on first use)
 */
export function mockUseMutation(ref: FunctionReference<"mutation">): Mock {
  const name = getFunctionName(ref);
  convexState.mutations[name] ??= vi.fn().mockResolvedValue(null);
  return convexState.mutations[name];
}

/**
 * Registers the answer of a query.
 *
 * @param ref - The query
 * @param value - What it returns
 */
export function setQuery(
  ref: FunctionReference<"query">,
  value: unknown
): void {
  convexState.queries[getFunctionName(ref)] = value;
}

/**
 * Returns (creating it if needed) the mock behind a mutation.
 *
 * @param ref - The mutation
 * @returns The mock
 */
export function mutationMock(ref: FunctionReference<"mutation">): Mock {
  return mockUseMutation(ref);
}

/**
 * Builds a registration for a buyer who has not started, with overrides.
 *
 * @param overrides - Fields to replace
 * @returns The registration
 */
export function makeRegistration(
  overrides: Omit<Partial<Registration>, "deposit"> & {
    deposit?: {
      reference: string;
      status: NonNullable<Registration["deposit"]>["status"];
      amount: number;
      receivedAt?: number;
      refundedAt?: number;
    } | null;
  } = {}
): Registration {
  const { deposit, ...rest } = overrides;
  return {
    eligibility: { kind: "incomplete", step: 1, totalSteps: 4 },
    details: makeDetails(),
    documents: [],
    deposit: deposit
      ? { receivedAt: undefined, refundedAt: undefined, ...deposit }
      : null,
    depositSettings: { enabled: true, amount: 5000, refundDays: 3 },
    submittedAt: undefined,
    ...rest,
  };
}

/**
 * Builds registration details with every field unset, then applies overrides.
 *
 * @param overrides - Fields to set
 * @returns The details
 */
export function makeDetails(
  overrides: Partial<Registration["details"]> = {}
): Registration["details"] {
  return {
    idType: undefined,
    fullName: undefined,
    phoneNumber: undefined,
    idNumber: undefined,
    passportNumber: undefined,
    countryOfIssue: undefined,
    streetAddress: undefined,
    town: undefined,
    postalCode: undefined,
    ...overrides,
  };
}

/** Saved SA ID details used by the later steps. */
export const SA_DETAILS: Registration["details"] = makeDetails({
  idType: "sa_id",
  fullName: "Thandi Naidoo",
  phoneNumber: "+27825550147",
  idNumber: "8001015009087",
  streetAddress: "14 Kerk Street",
  town: "Malmesbury",
  postalCode: "7300",
});

/**
 * Builds a stored document row.
 *
 * @param kind - The document kind
 * @param status - Its review status
 * @param extra - Other fields to set
 * @returns The row
 */
export function makeDoc(
  kind: Registration["documents"][number]["kind"],
  status: Registration["documents"][number]["status"] = "pending",
  extra: Partial<Registration["documents"][number]> = {}
): Registration["documents"][number] {
  return {
    id: `doc_${kind}` as Registration["documents"][number]["id"],
    kind,
    status,
    fileName: `${kind}.jpg`,
    fileSize: 1_200_000,
    contentType: "image/jpeg",
    rejectionReason: undefined,
    reviewedAt: undefined,
    ...extra,
  };
}

/**
 * Shows the current location so a test can assert where a page navigated.
 *
 * @returns The path and query in a test id
 */
function LocationProbe() {
  const location = useLocation();
  return createElement(
    "div",
    { "data-testid": "loc" },
    `${location.pathname}${location.search}`
  );
}

/**
 * Renders a page at a route inside a router that shows any other location.
 *
 * @param element - The page
 * @param route - The route pattern the page is mounted on
 * @param entry - The initial URL
 * @returns The Testing Library render result
 */
export function renderAt(element: ReactElement, route: string, entry: string) {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [entry] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: route, element }),
        createElement(Route, {
          path: "*",
          element: createElement(LocationProbe),
        })
      )
    )
  );
}
