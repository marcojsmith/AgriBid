import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";

import { CronJobsCard } from "./CronJobsCard";

const mockSetCronJobEnabled = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => mockSetCronJobEnabled),
}));

vi.mock("convex/_generated/api", () => ({
  api: {
    cronJobs: {
      getCronJobs: "cronJobs:getCronJobs",
      setCronJobEnabled: "cronJobs:setCronJobEnabled",
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const jobs = [
  {
    key: "settle_expired_auctions",
    label: "Settle expired auctions",
    description: "Settles lots.",
    schedule: "Every 1 minute",
    enabled: false,
  },
  {
    key: "cleanup_presence_records",
    label: "Clean up presence records",
    description: "Deletes stale presence.",
    schedule: "Every 15 minutes",
    enabled: true,
  },
];

describe("CronJobsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useMutation as Mock).mockReturnValue(mockSetCronJobEnabled);
  });

  it("shows a loading indicator while jobs load", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    render(<CronJobsCard />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders each job with its switch state", () => {
    (useQuery as Mock).mockReturnValue(jobs);
    render(<CronJobsCard />);
    expect(
      screen.getByRole("switch", { name: "Settle expired auctions" })
    ).not.toBeChecked();
    expect(
      screen.getByRole("switch", { name: "Clean up presence records" })
    ).toBeChecked();
  });

  it("saves a toggle and reports success", async () => {
    (useQuery as Mock).mockReturnValue(jobs);
    mockSetCronJobEnabled.mockResolvedValue({ success: true });
    render(<CronJobsCard />);
    fireEvent.click(
      screen.getByRole("switch", { name: "Settle expired auctions" })
    );
    await waitFor(() => {
      expect(mockSetCronJobEnabled).toHaveBeenCalledWith({
        key: "settle_expired_auctions",
        enabled: true,
      });
      expect(toast.success).toHaveBeenCalledWith("Job enabled");
    });
  });

  it("reports a failed save", async () => {
    (useQuery as Mock).mockReturnValue(jobs);
    mockSetCronJobEnabled.mockRejectedValue(new Error("Network error"));
    render(<CronJobsCard />);
    fireEvent.click(
      screen.getByRole("switch", { name: "Clean up presence records" })
    );
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Network error");
    });
  });
});
