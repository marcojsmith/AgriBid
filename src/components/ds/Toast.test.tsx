import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

const custom = vi.hoisted(() => vi.fn<(...args: unknown[]) => string>());
vi.mock("sonner", () => ({ toast: { custom } }));

import { Toast } from "./Toast";
import { showToast } from "./showToast";

describe("Toast", () => {
  it("renders the message as a status with a decorative check", () => {
    render(<Toast className="extra">Watching.</Toast>);
    const el = screen.getByRole("status");
    expect(el).toHaveTextContent("Watching.");
    expect(el).toHaveClass("rounded-md", "text-white", "extra");
    expect(el.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("showToast", () => {
  it("shows the Toast through Sonner at the bottom and returns its id", () => {
    custom.mockReturnValue("toast-1");
    expect(showToast("Link copied")).toBe("toast-1");
    expect(custom).toHaveBeenCalledTimes(1);
    const [render_, options] = custom.mock.calls[0] as [
      () => React.ReactElement,
      { position: string },
    ];
    expect(options.position).toBe("bottom-center");
    render(render_());
    expect(screen.getByRole("status")).toHaveTextContent("Link copied");
  });
});
