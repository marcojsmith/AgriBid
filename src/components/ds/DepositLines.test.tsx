import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { DepositLines } from "./DepositLines";

const NBSP = " ";

describe("DepositLines", () => {
  it("renders the default deposit and ID lines", () => {
    const { container } = render(<DepositLines />);
    const el = container.querySelector("[data-slot=deposit-lines]");
    expect(el?.textContent).toBe(
      `R${NBSP}5${NBSP}000 deposit, refunded within 3 working days if you don't buyHave ready: ID + proof of address`
    );
    expect(el).toHaveClass("text-muted-foreground");
  });

  it("uses the Admin-set amount and window", () => {
    const { container } = render(
      <DepositLines amount={10000} refundDays={5} />
    );
    expect(container.textContent).toContain(`R${NBSP}10${NBSP}000 deposit`);
    expect(container.textContent).toContain("within 5 working days");
  });

  it("switches colours on the dark band and merges className", () => {
    const { container } = render(<DepositLines onDark className="extra" />);
    expect(container.querySelector("p")).toHaveClass(
      "text-hero-muted",
      "extra"
    );
  });
});
