// app/src/components/__tests__/BidConfirmation.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { BidConfirmation } from "../BidConfirmation";
import { describe, it, expect, vi } from "vitest";

describe("BidConfirmation", () => {
  it("renders correctly and triggers onConfirm", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <BidConfirmation
        isOpen={true}
        amount={50500}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText(/Confirm your bid/i)).toBeInTheDocument();
    // Use a regex to match R and the number, ignoring non-breaking spaces or other variations
    expect(screen.getByText(/R\s+50\s+500/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Confirm Bid/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("triggers onCancel when cancel is clicked", () => {
    const onCancel = vi.fn();

    render(
      <BidConfirmation
        isOpen={true}
        amount={50500}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
