import { render } from "@testing-library/react";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import { useMutation, useQuery } from "convex/react";

import { useSession } from "@/lib/auth-client";

import { PresenceListener } from "./PresenceListener";

// Mock dependencies
vi.mock("convex/react", () => {
  const mockMutation = Object.assign(vi.fn(), {
    withOptimisticUpdate: vi.fn(),
  });
  mockMutation.withOptimisticUpdate.mockReturnValue(mockMutation);
  return {
    useMutation: vi.fn(() => mockMutation),
    useQuery: vi.fn((): number | undefined => 60000),
  };
});

vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(),
}));

// Mock api
vi.mock("convex/_generated/api", () => ({
  api: {
    presence: {
      heartbeat: "heartbeat",
      getHeartbeatIntervalMs: "presence:getHeartbeatIntervalMs",
    },
  },
}));

describe("PresenceListener", () => {
  const mockUserId = "user123";
  const mockSession = { user: { id: mockUserId } };
  const mockHeartbeat = Object.assign(vi.fn().mockResolvedValue(undefined), {
    withOptimisticUpdate: vi.fn(),
  });
  mockHeartbeat.withOptimisticUpdate.mockReturnValue(mockHeartbeat);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(useSession).mockReturnValue({
      data: mockSession,
    } as unknown as ReturnType<typeof useSession>);

    // Simpler: just override what useMutation returns.
    vi.mocked(useMutation).mockReturnValue(
      mockHeartbeat as unknown as ReturnType<typeof useMutation>
    );

    // Default visibilityState to visible
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should send initial heartbeat when mounted with session", () => {
    render(<PresenceListener />);
    expect(mockHeartbeat).toHaveBeenCalledTimes(1);
  });

  it("should not send heartbeat if no session", () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
    } as unknown as ReturnType<typeof useSession>);
    render(<PresenceListener />);
    expect(mockHeartbeat).not.toHaveBeenCalled();
  });

  it("should send heartbeat at intervals", () => {
    render(<PresenceListener />);
    expect(mockHeartbeat).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60000);
    expect(mockHeartbeat).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(60000);
    expect(mockHeartbeat).toHaveBeenCalledTimes(3);
  });

  it("should use the configured interval from the settings query", () => {
    (useQuery as Mock).mockReturnValue(5000);
    render(<PresenceListener />);
    expect(mockHeartbeat).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(4999);
    expect(mockHeartbeat).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(mockHeartbeat).toHaveBeenCalledTimes(2);
  });

  it("should fall back to the default 60s interval while the query is loading", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    render(<PresenceListener />);
    expect(mockHeartbeat).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(59999);
    expect(mockHeartbeat).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(mockHeartbeat).toHaveBeenCalledTimes(2);
  });

  it("should send heartbeat on visibility change to visible", () => {
    render(<PresenceListener />);
    expect(mockHeartbeat).toHaveBeenCalledTimes(1);

    // Simulate visibility change
    fireEvent(document, new Event("visibilitychange"));
    expect(mockHeartbeat).toHaveBeenCalledTimes(2);
  });

  it("should not send heartbeat if document is hidden", () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });

    render(<PresenceListener />);
    expect(mockHeartbeat).not.toHaveBeenCalled();

    vi.advanceTimersByTime(25000);
    expect(mockHeartbeat).not.toHaveBeenCalled();
  });
});

// Helper to fire events on document
function fireEvent(element: Document | HTMLElement, event: Event) {
  element.dispatchEvent(event);
}
