import "@testing-library/jest-dom";
import { expect, vi } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

// Node-environment tests (api/, convex-test) have no window.
if (typeof window !== "undefined") {
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
}

// jsdom has no ResizeObserver; Radix primitives (e.g. Switch inside a form) need one.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe(): void {
      // no-op stub
    }
    unobserve(): void {
      // no-op stub
    }
    disconnect(): void {
      // no-op stub
    }
  };
}

/**
 * Creates a mock query result object for testing Convex queries.
 * @param results - Array of results to return
 * @returns Mock query object with chainable methods
 */
export const createMockQuery = (results: Record<string, unknown>[] = []) => ({
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

// Mock ConvexHttpClient for use in lib/error-reporter.ts
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    mutation = vi.fn().mockResolvedValue({ success: true });
    query = vi.fn().mockResolvedValue({});
  },
}));
