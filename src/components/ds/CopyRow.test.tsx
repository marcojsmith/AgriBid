import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";

const showToast = vi.hoisted(() => vi.fn());
vi.mock("./showToast", () => ({ showToast }));

import { CopyRow } from "./CopyRow";

afterEach(() => {
  vi.unstubAllGlobals();
  showToast.mockReset();
});

describe("CopyRow", () => {
  it("shows the label, value and a 44px Copy button", () => {
    render(<CopyRow label="Account number" value="62 1234 5678" />);
    expect(screen.getByText("Account number")).toBeInTheDocument();
    expect(screen.getByText("62 1234 5678")).toHaveClass(
      "text-[17px]",
      "font-bold"
    );
    const btn = screen.getByRole("button", { name: "Copy Account number" });
    expect(btn).toHaveClass("min-h-11");
  });

  it("copies the value, then calls onCopied", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const onCopied = vi.fn();
    render(<CopyRow label="Bank" value="FNB" onCopied={onCopied} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy Bank" }));
    await waitFor(() => {
      expect(onCopied).toHaveBeenCalledTimes(1);
    });
    expect(writeText).toHaveBeenCalledWith("FNB");
    expect(showToast).not.toHaveBeenCalled();
  });

  it("shows the Copied toast by default", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    render(<CopyRow label="Bank" value="FNB" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy Bank" }));
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("Copied");
    });
  });

  it("shows the failure toast when the clipboard rejects", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("no")) },
    });
    const onCopied = vi.fn();
    render(<CopyRow label="Bank" value="FNB" onCopied={onCopied} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy Bank" }));
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("Couldn't copy");
    });
    expect(onCopied).not.toHaveBeenCalled();
  });

  it("shows the failure toast when there is no clipboard", async () => {
    vi.stubGlobal("navigator", {});
    render(<CopyRow label="Bank" value="FNB" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy Bank" }));
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("Couldn't copy");
    });
  });

  it("highlights the reference row", () => {
    const { rerender, container } = render(
      <CopyRow label="Reference" value="AB-7K3F2" highlight />
    );
    const row = container.firstElementChild;
    expect(row).toHaveClass("bg-primary-soft");
    expect(screen.getByText("AB-7K3F2")).toHaveClass("text-xl");
    rerender(<CopyRow label="Reference" value="AB-7K3F2" />);
    expect(container.firstElementChild).not.toHaveClass("bg-primary-soft");
  });
});
