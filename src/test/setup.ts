import "@testing-library/jest-dom";
import { expect, vi } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

export * from "./factories";

/**
 * Creates a mock query result object for testing Convex queries.
 * @template T - The type of results
 * @param results - Array of results to return
 * @returns Mock query object with chainable methods
 */
export const createMockQuery = <T extends Record<string, unknown>>(
  results: T[] = []
) => ({
  collect: vi.fn().mockResolvedValue(results),
  unique: vi.fn(),
  withIndex: vi.fn().mockReturnThis(),
  filter: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  take: vi.fn().mockResolvedValue(results),
  first: vi.fn().mockResolvedValue(results[0]),
});

/**
 * Creates a mock mutation object for testing Convex mutations.
 * @returns Mock mutation object with mutate and mutateAsync methods
 */
export const createMockMutation = () => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({ success: true }),
});

/**
 * Creates a mock Convex context object for testing.
 * @returns Mock context with auth, db, and storage
 */
export const createMockCtx = () => ({
  auth: {
    getUserIdentity: vi.fn(),
  },
  db: {
    get: vi.fn(),
    query: vi.fn(),
    insert: vi.fn().mockResolvedValue("newId"),
    patch: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
  storage: {
    getUrl: vi.fn(),
    getMetadata: vi.fn(),
  },
});
