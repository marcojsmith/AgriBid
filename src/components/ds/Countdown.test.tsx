import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Countdown } from "./Countdown";

describe("Countdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-21T10:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows TBD without an end time", () => {
    render(<Countdown endTime={null} />);
    expect(screen.getByText("TBD")).toBeInTheDocument();
  });

  it("shows the absolute SAST time", () => {
    render(<Countdown endTime={Date.UTC(2025, 10, 22, 8, 0)} absolute />);
    expect(screen.getByText("Sat 22 Nov, 10:00 SAST")).toBeInTheDocument();
  });

  it("is neutral with tabular figures and no monospace", () => {
    render(<Countdown endTime={Date.now() + 5 * 3_600_000} />);
    const el = screen.getByText(/5h/);
    expect(el).toHaveAttribute("data-tone", "neutral");
    expect(el).toHaveClass("num");
    expect(el).not.toHaveClass("font-mono");
  });

  it("goes amber under an hour and red under two minutes while ticking", () => {
    render(<Countdown endTime={Date.now() + 3_601_000} />);
    expect(screen.getByText(/1h/)).toHaveAttribute("data-tone", "neutral");
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(screen.getByText(/59m/)).toHaveAttribute("data-tone", "warn");
    act(() => {
      vi.advanceTimersByTime(3_600_000 - 2_000 - 100_000);
    });
    expect(screen.getByText(/1m/)).toHaveAttribute("data-tone", "urgent");
  });

  it("shows Ended once the time has passed", () => {
    render(<Countdown endTime={Date.now() + 1_500} />);
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(screen.getByText("Ended")).toBeInTheDocument();
  });

  it("shows Ended for a past end time", () => {
    render(<Countdown endTime={Date.now() - 1} className="custom" />);
    expect(screen.getByText("Ended")).toHaveClass("custom");
  });

  it("lets a caller text colour override the tone colour", () => {
    render(
      <Countdown endTime={Date.now() + 5 * 3_600_000} className="text-white" />
    );
    const el = screen.getByText(/5h/);
    expect(el).toHaveClass("text-white");
    expect(el).not.toHaveClass("text-foreground");
  });

  it("refreshes immediately when the end time changes", () => {
    const { rerender } = render(<Countdown endTime={null} />);
    vi.setSystemTime(new Date("2026-11-21T10:30:00Z"));
    rerender(<Countdown endTime={Date.now() + 5 * 3_600_000} />);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText(/^5h 0m/)).toBeInTheDocument();
  });
});
