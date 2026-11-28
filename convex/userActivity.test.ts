import { describe, it, expect, vi, beforeEach } from "vitest";

import { getSellerActivityHandler, logActivity } from "./userActivity";
import * as viewerLib from "./lib/viewer";
import type { QueryCtx, MutationCtx } from "./_generated/server";

vi.mock("./lib/viewer", () => ({
  getViewer: vi.fn(),
}));

/**
 * Sets who the mocked caller is.
 *
 * @param userId - The caller's id, or null for a guest
 * @param isAdmin - Whether the caller is an admin
 */
function asViewer(userId: string | null, isAdmin = false): void {
  vi.mocked(viewerLib.getViewer).mockResolvedValue({ userId, isAdmin });
}

interface ActivityRow {
  _id: string;
  _creationTime: number;
  userId: string;
  type: string;
  description?: string;
  relatedId?: string;
  createdAt: number;
}

const makeRow = (overrides: Partial<ActivityRow>): ActivityRow => ({
  _id: "activity1",
  _creationTime: 1000,
  userId: "user1",
  type: "bid_placed",
  description: "Bid placed: R1 500",
  relatedId: "auction1",
  createdAt: 1000,
  ...overrides,
});

interface MockQuery {
  withIndex: (index: string, cb?: (q: unknown) => unknown) => MockQuery;
  order: (direction: string) => MockQuery;
  take: ReturnType<typeof vi.fn>;
}

interface MockCtx {
  db: {
    insert: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
  auth: {
    getUserIdentity: ReturnType<typeof vi.fn>;
  };
}

describe("userActivity", () => {
  let mockCtx: MockCtx;
  let queryMock: MockQuery;
  let takenRows: ActivityRow[];

  beforeEach(() => {
    vi.resetAllMocks();

    takenRows = [];
    const q: MockQuery = {
      withIndex: vi.fn((_idx: unknown, cb?: (q: unknown) => unknown) => {
        if (cb) cb({ eq: vi.fn().mockReturnThis() });
        return q;
      }),
      order: vi.fn(() => q),
      take: vi.fn((n: number) => Promise.resolve(takenRows.slice(0, n))),
    };
    queryMock = q;

    mockCtx = {
      db: {
        insert: vi.fn().mockResolvedValue("id123"),
        query: vi.fn(() => queryMock),
      },
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue(null),
      },
    };

    asViewer(null);
  });

  describe("logActivity", () => {
    it("inserts a userActivity row with createdAt", async () => {
      const dateSpy = vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);

      await logActivity(mockCtx as unknown as MutationCtx, {
        userId: "user1",
        type: "account_created",
        description: "Account created",
      });

      expect(mockCtx.db.insert).toHaveBeenCalledWith("userActivity", {
        userId: "user1",
        type: "account_created",
        description: "Account created",
        createdAt: 1_700_000_000_000,
      });
      dateSpy.mockRestore();
    });

    it("omits optional fields when not provided", async () => {
      await logActivity(mockCtx as unknown as MutationCtx, {
        userId: "user1",
        type: "bid_won",
      });

      const [, inserted] = vi.mocked(mockCtx.db.insert).mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(inserted.description).toBeUndefined();
      expect(inserted.relatedId).toBeUndefined();
    });
  });

  describe("getSellerActivityHandler", () => {
    it("returns an empty array for the owner with no activity", async () => {
      asViewer("user1");

      const result = await getSellerActivityHandler(
        mockCtx as unknown as QueryCtx,
        { userId: "user1" }
      );

      expect(result).toEqual([]);
      expect(mockCtx.db.query).toHaveBeenCalledWith("userActivity");
      expect(queryMock.take).toHaveBeenCalledWith(10);
    });

    it("returns all activity types for the profile owner", async () => {
      asViewer("user1");

      takenRows = [
        makeRow({
          _id: "a1",
          type: "verification_rejected",
          description: "Verification rejected: blurry photos",
          createdAt: 3000,
        }),
        makeRow({
          _id: "a2",
          type: "role_changed",
          description: "Promoted to admin",
          createdAt: 2000,
        }),
        makeRow({
          _id: "a3",
          type: "listing_sold",
          description: "Listing sold for R450 000",
          createdAt: 1000,
        }),
      ];

      const result = await getSellerActivityHandler(
        mockCtx as unknown as QueryCtx,
        { userId: "user1" }
      );

      expect(result.map((r) => r.type)).toEqual([
        "verification_rejected",
        "role_changed",
        "listing_sold",
      ]);
    });

    it("returns the feed of another user to an admin", async () => {
      asViewer("admin1", true);
      takenRows = [makeRow({ _id: "a1", type: "bid_won" })];

      const result = await getSellerActivityHandler(
        mockCtx as unknown as QueryCtx,
        { userId: "user1" }
      );

      expect(result.map((r) => r._id)).toEqual(["a1"]);
    });

    it("returns nothing to another signed-in user, without reading the feed", async () => {
      asViewer("viewer");
      takenRows = [
        makeRow({ _id: "a1", type: "bid_won" }),
        makeRow({ _id: "a2", type: "bid_placed" }),
      ];

      const result = await getSellerActivityHandler(
        mockCtx as unknown as QueryCtx,
        { userId: "user1" }
      );

      expect(result).toEqual([]);
      expect(mockCtx.db.query).not.toHaveBeenCalled();
    });

    it("returns nothing to a guest, without reading the feed", async () => {
      takenRows = [makeRow({ _id: "a1", type: "listing_sold" })];

      const result = await getSellerActivityHandler(
        mockCtx as unknown as QueryCtx,
        { userId: "user1" }
      );

      expect(result).toEqual([]);
      expect(mockCtx.db.query).not.toHaveBeenCalled();
    });

    it("respects the limit", async () => {
      asViewer("user1");

      takenRows = [
        makeRow({ _id: "a1", createdAt: 5000 }),
        makeRow({ _id: "a2", createdAt: 4000 }),
        makeRow({ _id: "a3", createdAt: 3000 }),
        makeRow({ _id: "a4", createdAt: 2000 }),
        makeRow({ _id: "a5", createdAt: 1000 }),
      ];

      const result = await getSellerActivityHandler(
        mockCtx as unknown as QueryCtx,
        { userId: "user1", limit: 2 }
      );

      expect(queryMock.take).toHaveBeenCalledWith(2);
      expect(result.map((r) => r._id)).toEqual(["a1", "a2"]);
    });

    it("does not return the userId field", async () => {
      asViewer("user1");
      takenRows = [makeRow({ _id: "a1" })];

      const result = await getSellerActivityHandler(
        mockCtx as unknown as QueryCtx,
        { userId: "user1" }
      );

      expect(result[0]).toEqual({
        _id: "a1",
        _creationTime: 1000,
        type: "bid_placed",
        description: "Bid placed: R1 500",
        relatedId: "auction1",
        createdAt: 1000,
      });
      expect(Object.keys(result[0])).not.toContain("userId");
    });
  });
});
