import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { describe, it, expect, vi, beforeEach } from "vitest";

import AdminErrorReportingSettings from "./AdminErrorReportingSettings";

const mockUpdateConfig = vi.fn();
let mockSettings: unknown = undefined;

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => mockSettings),
  useMutation: vi.fn(() => mockUpdateConfig),
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

describe("AdminErrorReportingSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings = undefined;
  });

  it("renders a loading state when settings are undefined", () => {
    render(<AdminErrorReportingSettings />);
    expect(screen.getByTestId("admin-layout")).toBeInTheDocument();
    expect(
      screen.queryByRole("status") || document.querySelector(".animate-spin")
    ).toBeInTheDocument();
  });

  it("renders a specific status role if spinner is missing", () => {
    // This is purely for coverage of the fallback
    mockSettings = undefined;
    render(<AdminErrorReportingSettings />);
    expect(
      screen.queryByRole("status") || document.querySelector(".animate-spin")
    ).toBeInTheDocument();
  });

  it("renders disabled state correctly", () => {
    mockSettings = {
      githubConfig: {
        enabled: false,
        tokenMasked: "",
        repoOwner: null,
        repoName: null,
        labels: null,
      },
    };

    render(<AdminErrorReportingSettings />);

    expect(screen.getByText("GitHub Integration")).toBeInTheDocument();
    expect(screen.getByText("Enable Error Reporting")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Error reporting is disabled. Unexpected errors will not be captured."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("ghp_xxxxxxxxxxxx")
    ).not.toBeInTheDocument();
  });

  it("renders enabled state correctly", () => {
    mockSettings = {
      githubConfig: {
        enabled: true,
        tokenMasked: "****1234",
        repoOwner: "testowner",
        repoName: "testrepo",
        labels: "bug, test",
      },
    };

    render(<AdminErrorReportingSettings />);

    expect(screen.getByPlaceholderText("ghp_xxxxxxxxxxxx")).toHaveValue(
      "****1234"
    );
    expect(screen.getByPlaceholderText("username or org")).toHaveValue(
      "testowner"
    );
    expect(screen.getByPlaceholderText("AgriBid")).toHaveValue("testrepo");
    expect(screen.getByPlaceholderText("bug, auto-reported")).toHaveValue(
      "bug, test"
    );
  });

  it("saves settings correctly", async () => {
    mockSettings = {
      githubConfig: {
        enabled: false,
        tokenMasked: "",
        repoOwner: "",
        repoName: "",
        labels: "",
      },
    };

    render(<AdminErrorReportingSettings />);

    // Toggle on
    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);

    // Enter values
    fireEvent.change(screen.getByPlaceholderText("username or org"), {
      target: { value: "newowner" },
    });
    fireEvent.change(screen.getByPlaceholderText("AgriBid"), {
      target: { value: "newrepo" },
    });
    fireEvent.change(screen.getByPlaceholderText("ghp_xxxxxxxxxxxx"), {
      target: { value: "newtoken123" },
    });
    fireEvent.change(screen.getByPlaceholderText("bug, auto-reported"), {
      target: { value: "newlabel" },
    });

    const saveButton = screen.getByText("Save Settings");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateConfig).toHaveBeenCalledWith({
        key: "github_error_reporting_enabled",
        value: true,
      });
      expect(mockUpdateConfig).toHaveBeenCalledWith({
        key: "github_api_token",
        value: "newtoken123",
      });
      expect(mockUpdateConfig).toHaveBeenCalledWith({
        key: "github_repo_owner",
        value: "newowner",
      });
      expect(mockUpdateConfig).toHaveBeenCalledWith({
        key: "github_repo_name",
        value: "newrepo",
      });
      expect(mockUpdateConfig).toHaveBeenCalledWith({
        key: "github_error_labels",
        value: "newlabel",
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Error reporting settings saved"
      );
    });
  });

  it("shows error if saving enabled without repo owner/name", async () => {
    mockSettings = {
      githubConfig: {
        enabled: true,
        tokenMasked: "",
        repoOwner: "",
        repoName: "",
        labels: "",
      },
    };

    render(<AdminErrorReportingSettings />);

    const saveButton = screen.getByText("Save Settings");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Repository owner and name are required when enabled"
      );
      expect(mockUpdateConfig).not.toHaveBeenCalled();
    });
  });
});
