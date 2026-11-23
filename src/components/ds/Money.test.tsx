import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { Money } from "./Money";

describe("Money", () => {
  it("renders whole rand with no-break spaces and tabular figures", () => {
    const { container } = render(<Money amount={200000} />);
    const el = container.querySelector(".num");
    expect(el?.textContent).toBe("R 200 000");
  });

  it("renders no cents", () => {
    const { container } = render(<Money amount={199.6} />);
    expect(container.querySelector(".num")?.textContent).toBe("R 200");
  });

  it("renders the label and the excl. VAT suffix when given", () => {
    render(<Money amount={5000} label="Opening bid" exclVat />);
    expect(screen.getByText("Opening bid")).toBeInTheDocument();
    expect(screen.getByText("excl. VAT")).toBeInTheDocument();
  });

  it("omits label and suffix by default", () => {
    render(<Money amount={5000} />);
    expect(screen.queryByText("excl. VAT")).not.toBeInTheDocument();
  });

  it("uses the display serif when asked", () => {
    const { container } = render(<Money amount={5000} display />);
    expect(container.querySelector(".num")).toHaveClass(
      "text-[34px]",
      "font-bold"
    );
  });
});
