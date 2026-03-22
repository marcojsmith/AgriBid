import { describe, it, expect, vi, beforeEach } from "vitest";

import { getAdminStats, initializeCounters } from "./statistics";
import * as auth from "../lib/auth";
import * as adminUtils from "../admin_utils";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

vi.mock("../lib/auth", () => ({
  requireAdmin: vi.fn(),
  requireAuth: vi.fn(),
  _getCallerRoleFromAuthUser: vi.fn(),
}));

vi.mock("../admin_utils", () => ({
  getCounter: vi.fn(),
  countQuery: vi.fn(),
  countUsers: vi.fn(),
  updateCounter: vi.fn(),
}));

vi.mock("../_generated/server", () => ({
  query: vi.fn((q) => q),
  mutation: vi.fn((m) => m),
}));

vi.mock("../presence", () => ({
  countOnlineUsers: vi.fn(),
}));

vi.mock("../admin_utils", () => ({
  getCounter: vi.fn(),
  countQuery: vi.fn(),
  countUsers: vi.fn(),
  updateCounter: vi.fn(),
}));

vi.mock("../_generated/server", () => ({
  query: vi.fn((q) => q),
  mutation: vi.fn((m) => m),
}));

vi.mock("../presence", () => ({
  countOnlineUsers: vi.fn(),
}));

interface MockQuery {
  withIndex: (index: string, cb?: (q: unknown) => unknown) => MockQuery;
  filter: (cb: (q: unknown) => unknown) => MockQuery;
  unique: ReturnType<typeof vi.fn>;
  collect: ReturnType<typeof vi.fn>;
  paginate: ReturnType<typeof vi.fn>;
}

interface MockCtx {
  db: {
    query: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
  };
}

describe("Admin Statistics", () => {
  let mockCtx: MockCtx;
  let queryMock: MockQuery;

  beforeEach(() => {
    vi.resetAllMocks();

    queryMock = {
      withIndex: vi.fn(() => queryMock),
      filter: vi.fn(() => queryMock),
      unique: vi.fn().mockResolvedValue(null),
      collect: vi.fn().mockResolvedValue([]),
      paginate: vi.fn().mockResolvedValue({
        page: [{ currentPrice: 500 }],
        continueCursor: null,
        isDone: true,
      }),
    };

    mockCtx = {
      db: {
        query: vi.fn(() => queryMock),
        insert: vi.fn().mockResolvedValue("id123"),
        patch: vi.fn().mockResolvedValue(undefined),
      },
    };
  });

  it("getAdminStats should return healthy status when counters are found", async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "u1",
    } as Awaited<ReturnType<typeof auth.requireAdmin>>);
    vi.mocked(adminUtils.getCounter).mockResolvedValue({
      total: 10,
      active: 5,
      pending: 2,
    } as Doc<"counters">);
    vi.mocked(adminUtils.countQuery).mockResolvedValue(0);

    const stats = await (
      getAdminStats as unknown as {
        handler: (...args: unknown[]) => Promise<unknown>;
      }
    ).handler(mockCtx as unknown as QueryCtx, {});

    expect(stats).toMatchObject({
      status: "healthy",
      totalAuctions: 10,
    });
  });

  it("getAdminStats should return partial status when counters are missing", async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "u1",
    } as Awaited<ReturnType<typeof auth.requireAdmin>>);
    vi.mocked(adminUtils.getCounter).mockResolvedValue(null);
    vi.mocked(adminUtils.countQuery).mockResolvedValue(0);

    const stats = await (
      getAdminStats as unknown as {
        handler: (...args: unknown[]) => Promise<unknown>;
      }
    ).handler(mockCtx as unknown as QueryCtx, {});

    expect(stats).toMatchObject({
      status: "partial",
    });
  });

  it("initializeCounters should initialize counters successfully", async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "u1",
    } as Awaited<ReturnType<typeof auth.requireAdmin>>);
    vi.mocked(adminUtils.countQuery).mockResolvedValue(5);
    vi.mocked(adminUtils.countUsers).mockResolvedValue(10);

    const result = await (
      initializeCounters as unknown as {
        handler: (...args: unknown[]) => Promise<unknown>;
      }
    ).handler(mockCtx as unknown as MutationCtx, {});

    expect(result).toMatchObject({ success: true });
  });
});
