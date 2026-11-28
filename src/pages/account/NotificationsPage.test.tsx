import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { api } from "convex/_generated/api";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  mutationMock,
  resetConvexState,
  setQuery,
} from "@/pages/register/testing";

import NotificationsPage from "./NotificationsPage";

const m = vi.hoisted(
  (): {
    push: {
      state: string;
      busy: boolean;
      turnOn: ReturnType<typeof vi.fn>;
      turnOff: ReturnType<typeof vi.fn>;
    };
    toast: ReturnType<typeof vi.fn>;
  } => ({
    push: { state: "on", busy: false, turnOn: vi.fn(), turnOff: vi.fn() },
    toast: vi.fn(),
  })
);

vi.mock("convex/react", async () => {
  const t = await import("@/pages/register/testing");
  return { useQuery: t.mockUseQuery, useMutation: t.mockUseMutation };
});
vi.mock("@/hooks/usePushStatus", () => ({ usePushStatus: () => m.push }));
vi.mock("@/components/ds/showToast", () => ({ showToast: m.toast }));

/**
 * Renders the page for a push state.
 *
 * @param state - The push state
 * @param prefs - Saved preferences
 * @param settings - Platform setting overrides
 */
function renderPage(
  state: string,
  prefs: Record<string, boolean> | null = null,
  settings: Record<string, boolean> = {}
) {
  m.push.state = state;
  setQuery(api.userPreferences.getMyPreferences, prefs);
  setQuery(api.admin.platformSettings.getPlatformSettings, {
    watchAlertsEnabled: true,
    pushRemindersEnabled: true,
    ...settings,
  });
  render(
    <HelmetProvider>
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

beforeEach(() => {
  resetConvexState();
  vi.clearAllMocks();
  m.push.busy = false;
  m.push.turnOn.mockResolvedValue("on");
  m.push.turnOff.mockResolvedValue(undefined);
});

describe("NotificationsPage", () => {
  it("shows a skeleton while loading", () => {
    m.push.state = "loading";
    render(
      <HelmetProvider>
        <MemoryRouter>
          <NotificationsPage />
        </MemoryRouter>
      </HelmetProvider>
    );
    expect(
      screen.getByRole("status", { name: "Loading notifications" })
    ).toBeInTheDocument();
  });

  it("on: three switches, all on by default, and turn off", async () => {
    renderPage("on");
    expect(screen.getByText("On for this phone")).toBeInTheDocument();
    const switches = screen.getAllByRole("switch");
    expect(switches.map((s) => s.getAttribute("aria-checked"))).toEqual([
      "true",
      "true",
      "true",
    ]);
    expect(
      screen.getByText("We only send push notifications, never SMS or email.")
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Turn off on this phone" })
    );
    await waitFor(() => {
      expect(m.push.turnOff).toHaveBeenCalled();
    });
    expect(m.toast).toHaveBeenCalledWith(
      "Notifications are off for this phone."
    );
  });

  it("reports a failed turn off", async () => {
    m.push.turnOff.mockRejectedValue(new Error("x"));
    renderPage("on");
    fireEvent.click(
      screen.getByRole("button", { name: "Turn off on this phone" })
    );
    await waitFor(() => {
      expect(m.toast).toHaveBeenCalledWith(
        "Couldn't turn off notifications. Try again.",
        "error"
      );
    });
  });

  it("saves a switch", async () => {
    renderPage("on", { notificationsLotsWon: false });
    const win = screen.getByRole("switch", { name: /Lots you win/ });
    expect(win).toHaveAttribute("aria-checked", "false");
    fireEvent.click(win);
    await waitFor(() => {
      expect(
        mutationMock(api.userPreferences.updateMyPreferences)
      ).toHaveBeenCalledWith({ notificationsLotsWon: true });
    });
    fireEvent.click(screen.getByRole("switch", { name: /Watched lots/ }));
    fireEvent.click(screen.getByRole("switch", { name: /Sales opening/ }));
    await waitFor(() => {
      expect(
        mutationMock(api.userPreferences.updateMyPreferences)
      ).toHaveBeenCalledWith({ notificationsSalesOpening: false });
    });
  });

  it("shows Watched lots off while a retired setting blocks it, and turning it on clears them", async () => {
    renderPage("on", { notificationsBidOutbid: false });
    const watched = screen.getByRole("switch", { name: /Watched lots/ });
    expect(watched).toHaveAttribute("aria-checked", "false");
    fireEvent.click(watched);
    await waitFor(() => {
      expect(
        mutationMock(api.userPreferences.updateMyPreferences)
      ).toHaveBeenCalledWith({
        notificationsWatchedLots: true,
        notificationsBidOutbid: true,
        notificationsWatchlistEnding: "1h",
      });
    });
  });

  it("turning Watched lots off only sets the new switch", async () => {
    renderPage("on");
    fireEvent.click(screen.getByRole("switch", { name: /Watched lots/ }));
    await waitFor(() => {
      expect(
        mutationMock(api.userPreferences.updateMyPreferences)
      ).toHaveBeenCalledWith({ notificationsWatchedLots: false });
    });
  });

  it("shows an error when a switch fails to save", async () => {
    mutationMock(api.userPreferences.updateMyPreferences).mockRejectedValue(
      new Error("x")
    );
    renderPage("on");
    fireEvent.click(screen.getByRole("switch", { name: /Watched lots/ }));
    await waitFor(() => {
      expect(m.toast).toHaveBeenCalledWith(
        "Couldn't save that. Try again.",
        "error"
      );
    });
  });

  it("notes switches an admin has paused", () => {
    renderPage("on", null, {
      watchAlertsEnabled: false,
      pushRemindersEnabled: false,
    });
    expect(
      screen.getByText(/Alerts for watched lots are paused/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Sale reminders are paused/)).toBeInTheDocument();
  });

  it("off: dimmed switches and a turn-on button", async () => {
    renderPage("off");
    expect(
      screen.getByText("Notifications are off on this phone")
    ).toBeInTheDocument();
    for (const s of screen.getAllByRole("switch")) expect(s).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Turn on notifications" })
    );
    await waitFor(() => {
      expect(m.toast).toHaveBeenCalledWith(
        "Notifications are on for this phone."
      );
    });
  });

  it.each([
    ["blocked", "Still blocked. Allow notifications in your browser settings."],
    ["unsupported", "This browser can't receive notifications."],
    ["failed", "Couldn't turn on notifications. Try again."],
  ])("turn on %s explains why", async (result, text) => {
    m.push.turnOn.mockResolvedValue(result);
    renderPage("off");
    fireEvent.click(
      screen.getByRole("button", { name: "Turn on notifications" })
    );
    await waitFor(() => {
      expect(m.toast).toHaveBeenCalledWith(text, "error");
    });
  });

  it("opens the Home Screen guide when turn on needs it", async () => {
    m.push.turnOn.mockResolvedValue("install");
    renderPage("off");
    fireEvent.click(
      screen.getByRole("button", { name: "Turn on notifications" })
    );
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("blocked: how to allow it, no switches, and the iPhone guide", async () => {
    renderPage("blocked");
    expect(
      screen.getByText("Notifications are blocked in your browser")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Allow notifications for AgriBid in your browser settings/
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("switch")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: /On iPhone: add AgriBid/ })
    );
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("install: asks for the Home Screen app first", async () => {
    renderPage("install");
    expect(
      screen.getByText("Add AgriBid to your Home Screen first")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show me how" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("unsupported: says so", () => {
    renderPage("unsupported");
    expect(
      screen.getByText("This browser can't receive notifications")
    ).toBeInTheDocument();
    expect(screen.queryByRole("switch")).toBeNull();
  });
});
