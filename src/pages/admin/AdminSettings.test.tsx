import { render, screen, fireEvent, createEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useQuery } from "convex/react";

import AdminSettings from "./AdminSettings";

// Mocking Convex hooks
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

// Mocking the API
vi.mock("convex/_generated/api", () => ({
  api: {
    admin: {
      getAdminStats: { name: "admin:getAdminStats" },
    },
  },
}));

// Mocking useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = (await vi.importActual("react-router-dom")) as Record<
    string,
    unknown
  >;
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("AdminSettings Page", () => {
  const mockAdminStats = {
    totalUsers: 100,
    liveUsers: 5,
    pendingReview: 2,
    activeAuctions: 10,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderPage = () => {
    return render(
      <MemoryRouter>
        <AdminSettings />
      </MemoryRouter>
    );
  };

  it("renders loading state when admin stats are undefined", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    renderPage();
    // LoadingIndicator has role="status"
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("System Settings")).toBeInTheDocument();
  });

  it("renders all settings cards and layout when loaded", () => {
    (useQuery as Mock).mockReturnValue(mockAdminStats);
    renderPage();

    expect(screen.getByText("Equipment Metadata")).toBeInTheDocument();
    expect(screen.getByText("Platform Fees")).toBeInTheDocument();
    expect(screen.getByText("Security Logs")).toBeInTheDocument();

    // Check description to ensure SettingsCard is rendered correctly
    expect(
      screen.getByText("Manage makes, models, and categories.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Configure commission rates and listing fees.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Audit administrative actions and access.")
    ).toBeInTheDocument();
  });

  it("navigates to equipment catalog when Equipment Metadata card is clicked", () => {
    (useQuery as Mock).mockReturnValue(mockAdminStats);
    renderPage();

    const card = screen.getByRole("button", { name: /Equipment Metadata/i });
    fireEvent.click(card);

    expect(mockNavigate).toHaveBeenCalledWith("/admin/equipment-catalog");
  });

  it("navigates to audit page when Security Logs card is clicked", () => {
    (useQuery as Mock).mockReturnValue(mockAdminStats);
    renderPage();

    const card = screen.getByRole("button", { name: /Security Logs/i });
    fireEvent.click(card);

    expect(mockNavigate).toHaveBeenCalledWith("/admin/audit");
  });

  it("navigates to error reporting page when Error Reporting card is clicked", () => {
    (useQuery as Mock).mockReturnValue(mockAdminStats);
    renderPage();

    const card = screen.getByRole("button", { name: /Error Reporting/i });
    fireEvent.click(card);

    expect(mockNavigate).toHaveBeenCalledWith("/admin/error-reporting");
  });

  it("navigates to Platform Fees page when card is clicked", () => {
    (useQuery as Mock).mockReturnValue(mockAdminStats);
    renderPage();

    const card = screen.getByRole("button", { name: /Platform Fees/i });
    fireEvent.click(card);

    expect(mockNavigate).toHaveBeenCalledWith("/admin/fees");
  });

  it("handles keyboard activation (Enter) on settings cards", () => {
    (useQuery as Mock).mockReturnValue(mockAdminStats);
    renderPage();

    const card = screen.getByRole("button", { name: /Equipment Metadata/i });
    const event = createEvent.keyDown(card, { key: "Enter", code: "Enter" });
    vi.spyOn(event, "preventDefault");
    fireEvent(card, event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/admin/equipment-catalog");
  });

  it("handles keyboard activation (Space) on settings cards", () => {
    (useQuery as Mock).mockReturnValue(mockAdminStats);
    renderPage();

    const card = screen.getByRole("button", { name: /Security Logs/i });
    const event = createEvent.keyDown(card, { key: " ", code: "Space" });
    vi.spyOn(event, "preventDefault");
    fireEvent(card, event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/admin/audit");
  });

  it("does not call action on other keys", () => {
    (useQuery as Mock).mockReturnValue(mockAdminStats);
    renderPage();

    const card = screen.getByRole("button", { name: /Security Logs/i });
    const event = createEvent.keyDown(card, { key: "Escape", code: "Escape" });
    vi.spyOn(event, "preventDefault");
    fireEvent(card, event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("navigates to SEO settings page when SEO & Analytics card is clicked", () => {
    (useQuery as Mock).mockReturnValue(mockAdminStats);
    renderPage();
    const card = screen.getByRole("button", { name: /SEO & Analytics/i });
    fireEvent.click(card);
    expect(mockNavigate).toHaveBeenCalledWith("/admin/seo");
  });

  it("navigates to FAQ management page when FAQ Management card is clicked", () => {
    (useQuery as Mock).mockReturnValue(mockAdminStats);
    renderPage();
    const card = screen.getByRole("button", { name: /FAQ Management/i });
    fireEvent.click(card);
    expect(mockNavigate).toHaveBeenCalledWith("/admin/faq");
  });
});
