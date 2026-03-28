import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";

import AdminSEOSettings from "./AdminSEOSettings";

type SeoSettings = {
  ga4MeasurementId: string | null;
  searchConsoleVerification: string | null;
  bingVerification: string | null;
};

let mockSettings: SeoSettings | undefined;
const mockUpdateSeoSettings = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => mockSettings),
  useMutation: vi.fn(() => mockUpdateSeoSettings),
}));

vi.mock("convex/_generated/api", () => ({
  api: {
    admin: {
      getSeoSettings: "admin:getSeoSettings",
      updateSeoSettings: "admin:updateSeoSettings",
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/components/admin/AdminLayout", () => ({
  AdminLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="admin-layout">{children}</div>
  ),
}));

describe("AdminSEOSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings = undefined;
    (useQuery as Mock).mockImplementation(() => mockSettings);
    (useMutation as Mock).mockImplementation(() => mockUpdateSeoSettings);
  });

  it("renders loading state when settings are undefined", () => {
    render(<AdminSEOSettings />);
    expect(screen.getByTestId("admin-layout")).toBeInTheDocument();
    expect(
      screen.queryByRole("status") ?? document.querySelector(".animate-spin")
    ).toBeInTheDocument();
  });

  it("renders all three input fields when settings are loaded", () => {
    mockSettings = {
      ga4MeasurementId: null,
      searchConsoleVerification: null,
      bingVerification: null,
    };
    (useQuery as Mock).mockReturnValue(mockSettings);
    render(<AdminSEOSettings />);
    expect(screen.getByLabelText(/google analytics 4/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/google search console/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/bing webmaster/i)).toBeInTheDocument();
  });

  it("populates inputs from loaded settings", () => {
    mockSettings = {
      ga4MeasurementId: "G-ABC123",
      searchConsoleVerification: "gsc-token",
      bingVerification: "bing-token",
    };
    (useQuery as Mock).mockReturnValue(mockSettings);
    render(<AdminSEOSettings />);
    expect(screen.getByDisplayValue("G-ABC123")).toBeInTheDocument();
    expect(screen.getByDisplayValue("gsc-token")).toBeInTheDocument();
    expect(screen.getByDisplayValue("bing-token")).toBeInTheDocument();
  });

  it("shows error toast when GA4 ID is not in the correct format", async () => {
    mockSettings = {
      ga4MeasurementId: null,
      searchConsoleVerification: null,
      bingVerification: null,
    };
    (useQuery as Mock).mockReturnValue(mockSettings);
    render(<AdminSEOSettings />);

    fireEvent.change(screen.getByLabelText(/google analytics 4/i), {
      target: { value: "INVALID123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "GA4 Measurement ID must be in the format G-XXXXXXXXXX (at least 6 characters after G-)"
      );
      expect(mockUpdateSeoSettings).not.toHaveBeenCalled();
    });
  });

  it("calls updateSeoSettings with trimmed values on save", async () => {
    mockSettings = {
      ga4MeasurementId: "G-EXISTING",
      searchConsoleVerification: null,
      bingVerification: null,
    };
    (useQuery as Mock).mockReturnValue(mockSettings);
    mockUpdateSeoSettings.mockResolvedValue(null);
    render(<AdminSEOSettings />);

    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => {
      expect(mockUpdateSeoSettings).toHaveBeenCalledWith(
        expect.objectContaining({ ga4MeasurementId: "G-EXISTING" })
      );
      expect(toast.success).toHaveBeenCalledWith("SEO settings saved");
    });
  });

  it("shows error toast when save fails", async () => {
    mockSettings = {
      ga4MeasurementId: null,
      searchConsoleVerification: null,
      bingVerification: null,
    };
    (useQuery as Mock).mockReturnValue(mockSettings);
    mockUpdateSeoSettings.mockRejectedValue(new Error("Network error"));
    render(<AdminSEOSettings />);

    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Network error");
    });
  });

  it("shows GA4 script preview when a valid ID is entered", () => {
    mockSettings = {
      ga4MeasurementId: "G-PREVIEW123",
      searchConsoleVerification: null,
      bingVerification: null,
    };
    (useQuery as Mock).mockReturnValue(mockSettings);
    render(<AdminSEOSettings />);
    expect(screen.getByText(/gtag\/js\?id=G-PREVIEW123/)).toBeInTheDocument();
  });
});
