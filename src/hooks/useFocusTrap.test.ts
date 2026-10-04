import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { useFocusTrap } from "./useFocusTrap";

describe("useFocusTrap", () => {
  let container: HTMLDivElement;
  let button1: HTMLButtonElement;
  let button2: HTMLButtonElement;
  let input: HTMLInputElement;

  beforeEach(() => {
    container = document.createElement("div");
    button1 = document.createElement("button");
    button2 = document.createElement("button");
    input = document.createElement("input");

    button1.textContent = "First";
    button2.textContent = "Last";
    input.type = "text";

    container.appendChild(button1);
    container.appendChild(input);
    container.appendChild(button2);
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  it("should return a ref object", () => {
    const { result } = renderHook(() => useFocusTrap(true));
    expect(result.current).toBeDefined();
    expect(result.current.current).toBeNull();
  });

  it("should return a ref that can be attached to an element", () => {
    const { result } = renderHook(() => useFocusTrap(true));

    expect(result.current).toHaveProperty("current");
    expect(typeof result.current).toBe("object");
  });

  it("should not throw when toggling isActive", () => {
    const { rerender } = renderHook(
      ({ active }) => useFocusTrap(active),
      { initialProps: { active: false } }
    );

    expect(() => {
      rerender({ active: true });
    }).not.toThrow();
    expect(() => {
      rerender({ active: false });
    }).not.toThrow();
  });

  it("should clean up event listeners on unmount", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");

    const { unmount } = renderHook(() => useFocusTrap(true));

    expect(addSpy).toHaveBeenCalledWith("keydown", expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
  });
});
