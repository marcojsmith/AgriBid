import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import type { Id } from "convex/_generated/dataModel";

import { ConsiderationActions } from "./ConsiderationActions";

vi.mock("convex/react", () => ({ useMutation: vi.fn() }));

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    auctions: {
      acceptTopBid: { name: "auctions:acceptTopBid" },
      declineTopBid: { name: "auctions:declineTopBid" },
    },
  },
}));

vi.mock("convex/_generated/api", () => ({ api: mockApi }));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const LOT_ID = "lot1" as Id<"lots">;
const HOUR = 60 * 60 * 1000;

describe("ConsiderationActions", () => {
  const accept = vi.fn();
  const decline = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    accept.mockResolvedValue({ status: "sold", expired: false });
    decline.mockResolvedValue({ status: "unsold", expired: false });
    (useMutation as Mock).mockImplementation((ref) =>
      ref === mockApi.auctions.acceptTopBid ? accept : decline
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the buttons while the deadline is ahead", () => {
    render(
      <ConsiderationActions
        lotId={LOT_ID}
        amount={250000}
        deadline={Date.now() + HOUR}
      />
    );
    expect(
      screen.getByRole("button", { name: /Accept R/ })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
  });

  it("hides the buttons once the deadline has passed", () => {
    render(
      <ConsiderationActions
        lotId={LOT_ID}
        amount={250000}
        deadline={Date.now() - 1000}
      />
    );
    expect(screen.queryByRole("button", { name: /Accept R/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Decline" })).toBeNull();
    expect(screen.getByText(/time to decide has passed/i)).toBeInTheDocument();
  });

  it("swaps the buttons for the note when the deadline arrives", () => {
    vi.useFakeTimers();
    render(
      <ConsiderationActions
        lotId={LOT_ID}
        amount={250000}
        deadline={Date.now() + 5000}
      />
    );
    expect(
      screen.getByRole("button", { name: /Accept R/ })
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.queryByRole("button", { name: /Accept R/ })).toBeNull();
    expect(screen.getByText(/time to decide has passed/i)).toBeInTheDocument();
  });

  it("keeps the buttons when there is no deadline", () => {
    render(
      <ConsiderationActions
        lotId={LOT_ID}
        amount={250000}
        deadline={undefined}
      />
    );
    expect(
      screen.getByRole("button", { name: /Accept R/ })
    ).toBeInTheDocument();
  });

  it("tells the seller when the server settled the lot as expired", async () => {
    accept.mockResolvedValue({ status: "unsold", expired: true });
    render(
      <ConsiderationActions
        lotId={LOT_ID}
        amount={250000}
        deadline={Date.now() + HOUR}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Accept R/ }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, accept" }));

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith(
        expect.stringContaining("48 hours had passed")
      );
    });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("tells the seller when a decline landed after the deadline", async () => {
    decline.mockResolvedValue({ status: "unsold", expired: true });
    render(
      <ConsiderationActions
        lotId={LOT_ID}
        amount={250000}
        deadline={Date.now() + HOUR}
        layout="inline"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, decline" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("48 hours had passed")
      );
    });
  });

  it("falls back to a generic message when the error has none", async () => {
    accept.mockRejectedValue("boom");
    render(
      <ConsiderationActions
        lotId={LOT_ID}
        amount={250000}
        deadline={Date.now() + HOUR}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Accept R/ }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, accept" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Couldn't save your decision. Please try again."
      );
    });
  });
});
