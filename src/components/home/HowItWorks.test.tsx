import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { HowItWorks } from "./HowItWorks";

describe("HowItWorks", () => {
  it("renders three steps in order and a link to the auction rules", () => {
    render(
      <MemoryRouter>
        <HowItWorks />
      </MemoryRouter>
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "How AgriBid works" })
    ).toBeInTheDocument();
    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent("Register and get FICA-verified");
    expect(steps[1]).toHaveTextContent("Inspect before you bid");
    expect(steps[2]).toHaveTextContent("Win, pay and collect");
    expect(
      screen.getByRole("link", { name: /Read the auction rules/ })
    ).toHaveAttribute("href", "/faq");
  });
});
