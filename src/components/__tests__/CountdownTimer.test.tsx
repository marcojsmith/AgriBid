import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { CountdownTimer } from "../CountdownTimer";

describe("CountdownTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders TBD when endTime is undefined", () => {
    render(<CountdownTimer endTime={undefined} />);
    expect(screen.getByText("TBD")).toBeInTheDocument();
  });

  it("renders TBD when endTime is null", () => {
    render(<CountdownTimer endTime={null} />);
    expect(screen.getByText("TBD")).toBeInTheDocument();
  });

  it("renders Ended when time has expired", () => {
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
    const pastTime = Date.now() - 1000;
    render(<CountdownTimer endTime={pastTime} />);
    expect(screen.getByText("Ended")).toBeInTheDocument();
  });

  it("renders time remaining when auction is active", () => {
    vi.setSystemTime(new Date("2024-01-01T12:00:00Z"));
    const futureTime = Date.now() + 3600000; // 1 hour from now
    render(<CountdownTimer endTime={futureTime} />);
    expect(screen.getByText(/1h/)).toBeInTheDocument();
  });

  it("renders days when time is more than 24 hours", () => {
    vi.setSystemTime(new Date("2024-01-01T12:00:00Z"));
    const futureTime = Date.now() + 86400000; // 24 hours from now
    render(<CountdownTimer endTime={futureTime} />);
    expect(screen.getByText(/1d/)).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<CountdownTimer endTime={null} className="custom-class" />);
    expect(screen.getByText("TBD")).toHaveClass("custom-class");
  });
});
