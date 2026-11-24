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

describe("Toast tone", () => {
  it("defaults to the success tone with a dark background", () => {
    render(<Toast>Done</Toast>);
    const el = screen.getByRole("status");
    expect(el).toHaveAttribute("data-tone", "success");
    expect(el).not.toHaveClass("bg-destructive");
  });

  it("uses the destructive tint for the error tone", () => {
    render(<Toast tone="error">Failed</Toast>);
    const el = screen.getByRole("status");
    expect(el).toHaveAttribute("data-tone", "error");
    expect(el).toHaveClass("bg-destructive");
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

  it("passes the error tone through", () => {
    custom.mockReturnValue("toast-2");
    showToast("Couldn't copy", "error");
    const [render_] = custom.mock.calls[custom.mock.calls.length - 1] as [
      () => React.ReactElement,
    ];
    render(render_());
    expect(screen.getByRole("status")).toHaveAttribute("data-tone", "error");
  });
});
