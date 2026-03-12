import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

import type { Id } from "../../convex/_generated/dataModel";
import { getNotificationIcon, handleNotificationClick } from "./notifications";

describe("notifications lib", () => {
  describe("getNotificationIcon", () => {
    it("should return correct icons for types", () => {
      const { container: success } = render(getNotificationIcon("success"));
      expect(success.querySelector(".text-green-500")).toBeInTheDocument();

      const { container: error } = render(getNotificationIcon("error"));
      expect(error.querySelector(".text-destructive")).toBeInTheDocument();

      const { container: warning } = render(getNotificationIcon("warning"));
      expect(warning.querySelector(".text-orange-500")).toBeInTheDocument();

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

    it("should handle error and still navigate if link present", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      markRead.mockRejectedValue(new Error("Fail"));

      await handleNotificationClick(id, "/error-nav", navigate, markRead);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to mark notification as read:",
        expect.any(Error)
      );
      expect(navigate).toHaveBeenCalledWith("/error-nav");

      consoleSpy.mockRestore();
    });

    it("should handle error and not navigate if link missing", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      markRead.mockRejectedValue(new Error("Fail"));

      await handleNotificationClick(id, undefined, navigate, markRead);

      expect(navigate).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
