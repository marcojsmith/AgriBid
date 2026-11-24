import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import type { Id } from "convex/_generated/dataModel";

const mocks = vi.hoisted(() => ({
  useConvexAuth: vi.fn(),
  useMutation: vi.fn(),
  useQuery: vi.fn(),
  showToast: vi.fn(),
  requestQuote: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: mocks.useConvexAuth,
  useMutation: mocks.useMutation,
  useQuery: mocks.useQuery,
}));
vi.mock("convex/_generated/api", () => ({
  api: {
    transport: { requestQuote: "transport:requestQuote" },
    users: { getMyKYCDetails: "users:getMyKYCDetails" },
  },
}));
vi.mock("@/components/ds/showToast", () => ({ showToast: mocks.showToast }));

import { useTransportQuote } from "./useTransportQuote";

const values = {
  deliveryTown: "Bloem",
  deliveryProvince: "free_state" as const,
  name: "Thandi",
  phone: "0837000000",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useConvexAuth.mockReturnValue({ isAuthenticated: false });
  mocks.useMutation.mockReturnValue(mocks.requestQuote);
  mocks.useQuery.mockReturnValue(undefined);
  mocks.requestQuote.mockResolvedValue(null);
});

describe("useTransportQuote", () => {
  it("skips the profile query for a guest", () => {
    const { result } = renderHook(() => useTransportQuote());
    act(() => {
      result.current.setOpen(true);
    });
    expect(mocks.useQuery).toHaveBeenLastCalledWith(
      "users:getMyKYCDetails",
      "skip"
    );
  });

  it("skips the query while closed and prefills when signed in and open", () => {
    mocks.useConvexAuth.mockReturnValue({ isAuthenticated: true });
    mocks.useQuery.mockImplementation((_ref: string, args: unknown) =>
      args === "skip"
        ? undefined
        : {
            firstName: " Thandi",
            lastName: "Nkosi ",
            phoneNumber: " 0837000000",
          }
    );
    const { result } = renderHook(() => useTransportQuote());
    expect(result.current.sheetProps.defaultName).toBeUndefined();
    act(() => {
      result.current.setOpen(true);
    });
    expect(result.current.sheetProps.defaultName).toBe("Thandi Nkosi");
    expect(result.current.sheetProps.defaultPhone).toBe("0837000000");
  });

  it("sends with the lot id, toasts and closes on success", async () => {
    const lotId = "lot_1" as Id<"lots">;
    const { result } = renderHook(() => useTransportQuote(lotId));
    act(() => {
      result.current.setOpen(true);
    });
    act(() => {
      result.current.sheetProps.onSubmit(values);
    });
    await waitFor(() => {
      expect(result.current.open).toBe(false);
    });
    expect(mocks.requestQuote).toHaveBeenCalledWith({ ...values, lotId });
    expect(mocks.showToast).toHaveBeenCalledWith(
      "Request sent. We'll call you with a quote."
    );
    expect(result.current.sheetProps.busy).toBe(false);
  });

  it("surfaces an error, stays open and clears it on reopen", async () => {
    mocks.requestQuote.mockRejectedValue(
      new ConvexError("Too many requests. Try again later.")
    );
    const { result } = renderHook(() => useTransportQuote());
    act(() => {
      result.current.setOpen(true);
    });
    act(() => {
      result.current.sheetProps.onSubmit(values);
    });
    await waitFor(() => {
      expect(result.current.sheetProps.error).toBe(
        "Too many requests. Try again later."
      );
    });
    expect(result.current.open).toBe(true);
    expect(mocks.showToast).not.toHaveBeenCalled();
    act(() => {
      result.current.setOpen(false);
    });
    act(() => {
      result.current.setOpen(true);
    });
    expect(result.current.sheetProps.error).toBeNull();
  });
});
