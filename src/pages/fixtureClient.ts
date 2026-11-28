import type { ConvexReactClient } from "convex/react";
import { getFunctionName, type FunctionReference } from "convex/server";

/** What a fixture frame answers for the queries the page reads. */
export type Answers = Record<string, unknown>;

/**
 * A stand-in for the Convex client that answers every query from fixtures and
 * never talks to a backend: queries read the answers (one page for a paginated
 * query), mutations resolve at once. It lets the real My bids page render each
 * of its states on the dev-only design-system page, with no sign-in and no
 * data from any deployment.
 *
 * @param answers - Fixture answers keyed by function name
 * @returns A client that implements the few members the React hooks use
 */
export function fixtureClient(answers: Answers): ConvexReactClient {
  const cache = new Map<string, unknown>();
  const answer = (ref: FunctionReference<"query">, args: unknown): unknown => {
    const name = getFunctionName(ref);
    const key = `${name}:${JSON.stringify(args)}`;
    if (!cache.has(key)) {
      const raw = new Map(Object.entries(answers)).get(name);
      const isPaged =
        typeof args === "object" && args !== null && "paginationOpts" in args;
      cache.set(
        key,
        isPaged ? { page: raw ?? [], isDone: true, continueCursor: "end" } : raw
      );
    }
    return cache.get(key);
  };
  const logger = {
    logVerbose: () => undefined,
    log: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
  const client = {
    logger,
    watchQuery: (ref: FunctionReference<"query">, args: unknown) => ({
      onUpdate: () => () => undefined,
      localQueryResult: () => answer(ref, args),
      journal: () => undefined,
    }),
    mutation: () => Promise.resolve(null),
    setAuth: () => undefined,
    clearAuth: () => undefined,
  };
  return client as unknown as ConvexReactClient;
}

/**
 * A signed-in auth state for the fixture client (no token is ever fetched).
 *
 * @returns The auth state the Convex provider reads
 */
export function useFixtureAuth() {
  return {
    isLoading: false,
    isAuthenticated: true,
    fetchAccessToken: () => Promise.resolve(null),
  };
}
