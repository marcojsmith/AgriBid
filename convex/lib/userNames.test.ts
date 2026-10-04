import { describe, it, expect, vi, beforeEach } from "vitest";

import { resolveDisplayNames, UNKNOWN_USER_NAME } from "./userNames";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

/** Chainable stand-in for the index range Convex hands to `withIndex`. */
interface MockIndexBuilder {
  eq: ReturnType<typeof vi.fn>;
}

/** Index range reads recorded while serving profile lookups. */
type RecordedRanges = { field: string; value: unknown }[];

/**
 * Builds a profiles query double that runs the index callback production code
 * supplies and resolves `unique()` with the profile registered for the userId
 * the callback last equated.
 *
 * @param profiles - Profiles to serve, keyed by their `userId`.
 * @returns The query double plus the index ranges it recorded.
 */
const makeProfilesQuery = (profiles: Map<string, Doc<"profiles">>) => {
  const ranges: RecordedRanges = [];
  const indexBuilder: MockIndexBuilder = {
    eq: vi.fn((field: string, value: unknown) => {
      ranges.push({ field, value });
      return indexBuilder;
    }),
  };
  const chain = {
    withIndex: vi.fn(
      (_index: string, cb?: (q: MockIndexBuilder) => unknown) => {
        if (cb) cb(indexBuilder);
        return chain;
      }
    ),
    unique: vi.fn(() => {
      const userId = ranges[ranges.length - 1]?.value;
      return Promise.resolve(
        typeof userId === "string" ? (profiles.get(userId) ?? null) : null
      );
    }),
  };
  return { chain, ranges };
};

/**
 * Casts a partial profile shape into a profile document.
 *
 * @param userId - The profile's userId.
 * @param name - The optional display name.
 * @returns The profile document.
 */
const asProfile = (userId: string, name?: string) =>
  ({
    _id: `p_${userId}`,
    userId,
    name,
  }) as unknown as Doc<"profiles">;

describe("resolveDisplayNames", () => {
  let mockCtx: { db: { query: ReturnType<typeof vi.fn> } };
  let ranges: RecordedRanges;

  beforeEach(() => {
    vi.resetAllMocks();
    ranges = [];
    mockCtx = { db: { query: vi.fn() } };
  });

  /**
   * Serves the supplied profiles to the resolver under test.
   *
   * @param profiles - Profiles to serve, keyed by their `userId`.
   */
  const setup = (profiles: Map<string, Doc<"profiles">>) => {
    const built = makeProfilesQuery(profiles);
    ranges = built.ranges;
    mockCtx.db.query.mockReturnValue(built.chain);
  };

  it("resolves a profile name for each requested id", async () => {
    setup(
      new Map([
        ["u1", asProfile("u1", "Alice")],
        ["u2", asProfile("u2", "Bob")],
      ])
    );

    const names = await resolveDisplayNames(mockCtx as unknown as QueryCtx, [
      "u1",
      "u2",
    ]);

    expect(names.get("u1")).toBe("Alice");
    expect(names.get("u2")).toBe("Bob");
    expect(ranges).toEqual([
      { field: "userId", value: "u1" },
      { field: "userId", value: "u2" },
    ]);
  });

  it("reads each distinct id only once", async () => {
    setup(new Map([["u1", asProfile("u1", "Alice")]]));

    const names = await resolveDisplayNames(mockCtx as unknown as QueryCtx, [
      "u1",
      "u1",
      "u1",
    ]);

    expect(names.get("u1")).toBe("Alice");
    expect(ranges).toHaveLength(1);
  });

  it("falls back to the default placeholder for a missing profile", async () => {
    setup(new Map());

    const names = await resolveDisplayNames(mockCtx as unknown as QueryCtx, [
      "ghost",
    ]);

    expect(UNKNOWN_USER_NAME).toBe("Unknown User");
    expect(names.get("ghost")).toBe(UNKNOWN_USER_NAME);
  });

  it("falls back for a profile without a name", async () => {
    setup(new Map([["u1", asProfile("u1")]]));

    const names = await resolveDisplayNames(mockCtx as unknown as QueryCtx, [
      "u1",
    ]);

    expect(names.get("u1")).toBe(UNKNOWN_USER_NAME);
  });

  it("uses the caller's placeholder when given one", async () => {
    setup(new Map());

    const names = await resolveDisplayNames(
      mockCtx as unknown as QueryCtx,
      ["ghost"],
      { fallback: "Anonymous" }
    );

    expect(names.get("ghost")).toBe("Anonymous");
  });

  it("does not query for a blank id and falls back instead", async () => {
    setup(new Map([["", asProfile("", "Nameless Ghost")]]));

    const names = await resolveDisplayNames(
      mockCtx as unknown as QueryCtx,
      [""],
      { fallback: "Anonymous" }
    );

    expect(names.get("")).toBe("Anonymous");
    expect(ranges).toHaveLength(0);
  });

  it("returns an empty map without querying when no ids are given", async () => {
    setup(new Map());

    const names = await resolveDisplayNames(mockCtx as unknown as QueryCtx, []);

    expect(names.size).toBe(0);
    expect(mockCtx.db.query).not.toHaveBeenCalled();
  });

  it("accepts any iterable of ids", async () => {
    setup(new Map([["u1", asProfile("u1", "Alice")]]));

    const names = await resolveDisplayNames(
      mockCtx as unknown as QueryCtx,
      new Set(["u1"])
    );

    expect(names.get("u1")).toBe("Alice");
  });
});
