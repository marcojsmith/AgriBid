import { act, renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "convex/_generated/dataModel";

import type { LotLiveWindowInput } from "./useLotLiveWindow";
import { useLotBid } from "./useLotBid";

const placeBid = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ success: vi.fn() }));

vi.mock("convex/react", () => ({ useMutation: () => placeBid }));
vi.mock("convex/_generated/api", () => ({
  api: {
    auctions: { mutations: { bidding: { placeBid: "placeBid" } } },
  },
}));
vi.mock("sonner", () => ({ toast }));

const LOT = "lot1" as Id<"lots">;
const liveWindow: LotLiveWindowInput = {
  status: "assigned",
  auctionStatus: "published",
  auctionStartTime: Date.now() - 3_600_000,
  auctionEndTime: Date.now() + 3_600_000,
};
const closedWindow: LotLiveWindowInput = { ...liveWindow, status: "sold" };

function setup(
  minimum = 414_000,
  window: LotLiveWindowInput | null = liveWindow,
  lotId: Id<"lots"> | null = LOT
) {
  return renderHook(
    (props: { minimum: number }) =>
      useLotBid({ lotId: lotId ?? undefined, minimum: props.minimum, window }),
    { initialProps: { minimum } }
  );
}

describe("useLotBid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts at the minimum and follows it until the user chooses", () => {
    const { result, rerender } = setup(414_000);
    expect(result.current.amount).toBe(414_000);
    rerender({ minimum: 417_500 });
    expect(result.current.amount).toBe(417_500);
    act(() => {
      result.current.setAmount(430_000);
    });
    rerender({ minimum: 421_000 });
    expect(result.current.amount).toBe(430_000);
  });

  it("freezes the amount under review when the minimum moves while the sheet is open", () => {
    const { result, rerender } = setup(414_000);
    act(() => {
      result.current.startBid();
    });
    rerender({ minimum: 420_000 });
    expect(result.current.amount).toBe(414_000);
  });

  it("opens the confirm sheet, optionally at an amount, and closes it", () => {
    const { result } = setup();
    act(() => {
      result.current.startBid();
    });
    expect(result.current.confirmOpen).toBe(true);
    act(() => {
      result.current.closeConfirm();
    });
    expect(result.current.confirmOpen).toBe(false);
    act(() => {
      result.current.startBid(420_000);
    });
    expect(result.current.amount).toBe(420_000);
  });

  it("places the bid without a maximum, thanks the user and resets", async () => {
    placeBid.mockResolvedValue({ success: true });
    const { result } = setup();
    act(() => {
      result.current.startBid(420_000);
    });
    await act(async () => {
      await result.current.confirm();
    });
    expect(placeBid).toHaveBeenCalledWith({ lotId: LOT, amount: 420_000 });
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringMatching(/Bid of R\s420\s000 placed/)
    );
    expect(result.current.confirmOpen).toBe(false);
    expect(result.current.amount).toBe(414_000);
    expect(result.current.busy).toBe(false);
  });

  it("someone bid in between: keeps the sheet open with the new minimum, and revising re-prices", async () => {
    placeBid.mockRejectedValue(
      new ConvexError("Bid amount must be at least R417500")
    );
    const { result } = setup(414_000);
    act(() => {
      result.current.startBid();
    });
    await act(async () => {
      await result.current.confirm();
    });
    expect(result.current.confirmOpen).toBe(true);
    expect(result.current.error).toMatchObject({
      kind: "outbid",
      minimum: 417_500,
    });
    act(() => {
      result.current.reviseBid(417_500);
    });
    expect(result.current.error).toBeNull();
    expect(result.current.amount).toBe(417_500);
  });

  it("a bid below the minimum the user saw is below-minimum, not outbid", async () => {
    placeBid.mockRejectedValue(
      new ConvexError("Bid amount must be at least R414000")
    );
    const { result } = setup(414_000);
    act(() => {
      result.current.startBid(400_000);
    });
    await act(async () => {
      await result.current.confirm();
    });
    expect(result.current.error?.kind).toBe("below-minimum");
  });

  it("reports a closed sale and an unverified account in plain words", async () => {
    const { result } = setup();
    placeBid.mockRejectedValueOnce(new ConvexError("Auction ended"));
    act(() => {
      result.current.startBid();
    });
    await act(async () => {
      await result.current.confirm();
    });
    expect(result.current.error?.kind).toBe("closed");
    placeBid.mockRejectedValueOnce(
      new ConvexError(
        "Account verification required. Please complete KYC verification."
      )
    );
    await act(async () => {
      await result.current.confirm();
    });
    expect(result.current.error?.kind).toBe("unverified");
  });

  it("does not call the server when the window has closed", async () => {
    const { result } = setup(414_000, closedWindow);
    act(() => {
      result.current.startBid();
    });
    await act(async () => {
      await result.current.confirm();
    });
    expect(placeBid).not.toHaveBeenCalled();
    expect(result.current.error?.kind).toBe("closed");
  });

  it("does not call the server without a lot or a window", async () => {
    const noLot = setup(414_000, liveWindow, null);
    await act(async () => {
      await noLot.result.current.confirm();
    });
    const noWindow = setup(414_000, null);
    await act(async () => {
      await noWindow.result.current.confirm();
    });
    expect(placeBid).not.toHaveBeenCalled();
  });

  it("falls back to a generic message for an unknown failure", async () => {
    placeBid.mockRejectedValue("nope");
    const { result } = setup();
    act(() => {
      result.current.startBid();
    });
    await act(async () => {
      await result.current.confirm();
    });
    expect(result.current.error).toEqual({
      kind: "other",
      message: "Couldn't place your bid.",
    });
  });
});
