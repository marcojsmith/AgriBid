import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { formatSastDate } from "@/lib/dates";

import { WhyBox } from "./WhyBox";

describe("WhyBox", () => {
  it("shows the reason and when it was checked", () => {
    const checkedAt = Date.UTC(2026, 10, 22, 9, 40);
    const { container } = render(
      <WhyBox
        reason="The bill is older than 3 months. Upload one from the last 3 months."
        checkedAt={checkedAt}
      />
    );
    expect(screen.getByText("Why")).toHaveClass("font-bold", "text-sm");
    expect(
      screen.getByText(/The bill is older than 3 months/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(`Checked ${formatSastDate(checkedAt)}`)
    ).toHaveClass("text-muted-foreground");
    expect(screen.getByText("Checked Sun 22 Nov, 11:40")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass(
      "border-l-[3px]",
      "border-destructive",
      "pl-3"
    );
  });
});
