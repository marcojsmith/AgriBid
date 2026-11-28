import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { api } from "convex/_generated/api";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  mutationMock,
  resetConvexState,
  setQuery,
} from "@/pages/register/testing";

import { fixtureLotId, makeWatchedLot } from "./fixtures";
import { WatchingPanel } from "./WatchingPanel";

const showToast = vi.hoisted(() => vi.fn());
const paginated = vi.hoisted(
  (): {
    value: { results: unknown[]; status: string; loadMore: Mock };
  } => ({
    value: { results: [], status: "Exhausted", loadMore: vi.fn() },
  })
);
vi.mock("convex/react", async () => {
  const t = await import("@/pages/register/testing");
  return {
    useQuery: t.mockUseQuery,
    useMutation: t.mockUseMutation,
    usePaginatedQuery: () => paginated.value,
  };
});
vi.mock("@/components/ds/showToast", () => ({ showToast }));

const NOW = Date.UTC(2026, 10, 25, 6, 30);

/**
 * Renders the panel.
 */
function renderPanel() {
  render(
    <MemoryRouter>
      <WatchingPanel />
    </MemoryRouter>
  );
}

describe("WatchingPanel", () => {
  beforeEach(() => {
    resetConvexState();
    showToast.mockReset();
    paginated.value = { results: [], status: "Exhausted", loadMore: vi.fn() };
    setQuery(api.userPreferences.getMyPreferences, null);
  });

  it("shows skeletons while the first page loads", () => {
    paginated.value = {
      results: [],
      status: "LoadingFirstPage",
      loadMore: vi.fn(),
    };
    renderPanel();
    expect(screen.queryByText("Lots you bid on are added here.")).toBeNull();
  });

  it("says nothing is watched yet", () => {
    renderPanel();
    expect(screen.getByText("Lots you bid on are added here.")).toBeVisible();
    expect(screen.getByText("No watched lots")).toBeVisible();
    expect(
      screen.getByText("Tap the heart on a lot to watch it.")
    ).toBeVisible();
  });

  it("shows watched lots as cards and the alerts row", () => {
    paginated.value = {
      results: [
        makeWatchedLot(NOW),
        makeWatchedLot(NOW, {
          _id: fixtureLotId("case"),
          title: "Case JX45T",
          currentPrice: 99_000,
          startingPrice: 95_000,
          reserveState: "not_met",
        }),
        makeWatchedLot(NOW, {
          _id: fixtureLotId("sold"),
          title: "Sold lot",
          status: "sold",
        }),
      ],
      status: "Exhausted",
      loadMore: vi.fn(),
    };
    renderPanel();
    expect(screen.getByText("Alerts on")).toBeInTheDocument();
    expect(screen.getByText("John Deere 8370RT")).toBeVisible();
    expect(screen.getByText("Opening bid")).toBeVisible();
    expect(screen.getByText("Current bid")).toBeVisible();
    expect(screen.getByText("Sold for")).toBeVisible();
    expect(screen.getAllByRole("button", { name: /Watching/ })).toHaveLength(3);
  });

  it("stops watching with the heart and reports a failure", async () => {
    const toggle = mutationMock(api.watchlist.toggleWatchlist);
    toggle.mockRejectedValueOnce(new Error("Nope"));
    paginated.value = {
      results: [makeWatchedLot(NOW)],
      status: "Exhausted",
      loadMore: vi.fn(),
    };
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Watching/ }));
    await waitFor(() => {
      expect(toggle).toHaveBeenCalledWith({ lotId: fixtureLotId("jd8370") });
    });
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(expect.any(String), "error");
    });
  });

  it("loads more on request", () => {
    const loadMore = vi.fn();
    paginated.value = {
      results: [makeWatchedLot(NOW)],
      status: "CanLoadMore",
      loadMore,
    };
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(loadMore).toHaveBeenCalledWith(12);
  });

  it("disables the button while more load", () => {
    paginated.value = {
      results: [makeWatchedLot(NOW)],
      status: "LoadingMore",
      loadMore: vi.fn(),
    };
    renderPanel();
    expect(screen.getByRole("button", { name: "Loading…" })).toBeDisabled();
  });

  it("lets a sold or unsold lot be removed from Watching", async () => {
    const toggle = mutationMock(api.watchlist.toggleWatchlist);
    toggle.mockResolvedValue(false);
    paginated.value = {
      results: [
        makeWatchedLot(NOW, { _id: fixtureLotId("sold"), status: "sold" }),
        makeWatchedLot(NOW, { _id: fixtureLotId("unsold"), status: "unsold" }),
      ],
      status: "Exhausted",
      loadMore: vi.fn(),
    };
    renderPanel();
    const hearts = screen.getAllByRole("button", { name: /Watching/ });
    expect(hearts).toHaveLength(2);
    fireEvent.click(hearts[0]);
    await waitFor(() => {
      expect(toggle).toHaveBeenCalledWith({ lotId: fixtureLotId("sold") });
    });
  });

  it("ignores a second tap while the first is in flight", async () => {
    const toggle = mutationMock(api.watchlist.toggleWatchlist);
    let finish: (value: boolean) => void = () => undefined;
    toggle.mockReset();
    toggle.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        })
    );
    paginated.value = {
      results: [makeWatchedLot(NOW)],
      status: "Exhausted",
      loadMore: vi.fn(),
    };
    renderPanel();
    const heart = screen.getByRole("button", { name: /Watching/ });
    fireEvent.click(heart);
    fireEvent.click(heart);
    expect(toggle).toHaveBeenCalledTimes(1);
    finish(false);
    await waitFor(() => {
      fireEvent.click(heart);
      expect(toggle).toHaveBeenCalledTimes(2);
    });
  });
});
