import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

import type { Id } from "../../convex/_generated/dataModel";
import { getNotificationIcon, handleNotificationClick } from "./notifications";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe("notifications lib", () => {
  describe("getNotificationIcon", () => {
    it("should return correct icons for types", () => {
      const { container: success } = render(getNotificationIcon("success"));
      expect(success.querySelector(".text-success")).toBeInTheDocument();

      const { container: error } = render(getNotificationIcon("error"));
      expect(error.querySelector(".text-destructive")).toBeInTheDocument();

      const { container: warning } = render(getNotificationIcon("warning"));
      expect(warning.querySelector(".text-warning")).toBeInTheDocument();

      const { container: def } = render(getNotificationIcon("info"));
      expect(def.querySelector(".text-primary")).toBeInTheDocument();

      const { container: unknownType } = render(getNotificationIcon("other"));
      expect(unknownType.querySelector(".text-primary")).toBeInTheDocument();
    });
  });

  describe("handleNotificationClick", () => {
    const id = "n1" as Id<"notifications">;
    const navigate = vi.fn();
    const markRead = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should mark as read and navigate", async () => {
      markRead.mockResolvedValue({});
      await handleNotificationClick(id, "/test", navigate, markRead);
      expect(markRead).toHaveBeenCalledWith({ notificationId: id });
      expect(navigate).toHaveBeenCalledWith("/test");
    });

    it("should not navigate if link missing", async () => {
      markRead.mockResolvedValue({});
      await handleNotificationClick(id, undefined, navigate, markRead);
      expect(navigate).not.toHaveBeenCalled();
    });

    it("should show toast error and still navigate if link present on failure", async () => {
      const { toast } = await import("sonner");
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // intentional no-op: suppress expected mark-as-read failure logging
      });
      markRead.mockRejectedValue(new Error("Fail"));

      await handleNotificationClick(id, "/error-nav", navigate, markRead);

      expect(toast.error).toHaveBeenCalledWith("Could not mark notification as read");
      expect(navigate).toHaveBeenCalledWith("/error-nav");

      consoleSpy.mockRestore();
    });

    it("should show toast error and not navigate if link missing on failure", async () => {
      const { toast } = await import("sonner");
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // intentional no-op: suppress expected mark-as-read failure logging
      });
      markRead.mockRejectedValue(new Error("Fail"));

      await handleNotificationClick(id, undefined, navigate, markRead);

      expect(toast.error).toHaveBeenCalledWith("Could not mark notification as read");
      expect(navigate).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should log error to console on failure", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // intentional no-op: suppress expected mark-as-read failure logging
      });
      markRead.mockRejectedValue(new Error("Fail"));

      await handleNotificationClick(id, undefined, navigate, markRead);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to mark notification as read:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});
