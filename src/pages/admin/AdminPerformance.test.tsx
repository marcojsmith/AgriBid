import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";

import AdminPerformance from "./AdminPerformance";

interface PerformanceSectionMock {
  demoModeEnabled: { current: boolean; default: boolean; key: string };
  heartbeatIntervalMs: { current: number; default: number; key: string };
}

let mockConfig: { performance: PerformanceSectionMock } | undefined;
const mockUpdatePerformanceConfig = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => mockConfig),
  useMutation: vi.fn(() => mockUpdatePerformanceConfig),
}));

vi.mock("convex/_generated/api", () => ({
  api: {
    admin: {
      settings: {
        getSystemConfig: "admin:settings:getSystemConfig",
        updatePerformanceConfig: "admin:settings:updatePerformanceConfig",
      },
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

const makeConfig = (
  demoModeEnabled: boolean,
  heartbeatIntervalMs: number
): { performance: PerformanceSectionMock } => ({
  performance: {
    demoModeEnabled: {
      current: demoModeEnabled,
      default: false,
      key: "demo_mode_enabled",
    },
    heartbeatIntervalMs: {
      current: heartbeatIntervalMs,
      default: 60000,
      key: "presence_heartbeat_interval_ms",
    },
  },
});

describe("AdminPerformance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig = undefined;
    (useQuery as Mock).mockImplementation(() => mockConfig);
    (useMutation as Mock).mockImplementation(() => mockUpdatePerformanceConfig);
  });

  it("renders loading state when config is undefined", () => {
    render(<AdminPerformance />);
    expect(screen.getByTestId("admin-layout")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders the demo mode switch and heartbeat input when loaded", () => {
    mockConfig = makeConfig(false, 60000);
    (useQuery as Mock).mockReturnValue(mockConfig);
    render(<AdminPerformance />);

    expect(screen.getByRole("switch", { name: /demo mode/i })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.getByLabelText(/presence heartbeat interval/i)).toHaveValue(
      60
    );
    expect(screen.getByText(/reserved for future use/i)).toBeInTheDocument();
    expect(
      screen.getByText(/does not currently reduce background activity/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/above 90 seconds.*appear offline/i)
    ).toBeInTheDocument();
  });

  it("populates fields from stored overrides", () => {
    mockConfig = makeConfig(true, 120000);
    (useQuery as Mock).mockReturnValue(mockConfig);
    render(<AdminPerformance />);

    expect(screen.getByRole("switch", { name: /demo mode/i })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByLabelText(/presence heartbeat interval/i)).toHaveValue(
      120
    );
  });

  it("saves both settings in one atomic mutation with the interval converted to ms", async () => {
    mockConfig = makeConfig(false, 60000);
    (useQuery as Mock).mockReturnValue(mockConfig);
    mockUpdatePerformanceConfig.mockResolvedValue({ success: true });
    render(<AdminPerformance />);

    fireEvent.click(screen.getByRole("switch", { name: /demo mode/i }));
    fireEvent.change(screen.getByLabelText(/presence heartbeat interval/i), {
      target: { value: "90" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => {
      expect(mockUpdatePerformanceConfig).toHaveBeenCalledTimes(1);
      expect(mockUpdatePerformanceConfig).toHaveBeenCalledWith({
        demoModeEnabled: true,
        heartbeatIntervalMs: 90000,
      });
      expect(toast.success).toHaveBeenCalledWith("Performance settings saved");
    });
  });

  it("shows an error toast and does not save when the interval is out of bounds", async () => {
    mockConfig = makeConfig(false, 60000);
    (useQuery as Mock).mockReturnValue(mockConfig);
    render(<AdminPerformance />);

    fireEvent.change(screen.getByLabelText(/presence heartbeat interval/i), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Heartbeat interval must be between 15 and 300 seconds"
      );
    });
    expect(mockUpdatePerformanceConfig).not.toHaveBeenCalled();
  });

  it("shows an error toast when the save fails", async () => {
    mockConfig = makeConfig(false, 60000);
    (useQuery as Mock).mockReturnValue(mockConfig);
    mockUpdatePerformanceConfig.mockRejectedValue(new Error("Network error"));
    render(<AdminPerformance />);

    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Network error");
    });
  });

  it("shows the read-only fixed-schedule jobs info block", () => {
    mockConfig = makeConfig(false, 60000);
    (useQuery as Mock).mockReturnValue(mockConfig);
    render(<AdminPerformance />);

    expect(screen.getByText(/fixed-schedule jobs/i)).toBeInTheDocument();
    expect(screen.getByText(/affected by this page/i)).toBeInTheDocument();
    expect(screen.getByText(/auction lot settlement/i)).toBeInTheDocument();
    expect(screen.getByText(/presence record cleanup/i)).toBeInTheDocument();
    expect(
      screen.getByText(/requires a code change and redeployment/i)
    ).toBeInTheDocument();
  });
});
