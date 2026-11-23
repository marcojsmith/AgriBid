import { render, screen } from "@testing-library/react";
import { Wrench } from "lucide-react";
import { describe, it, expect } from "vitest";

import { IconList, IconRow } from "./IconRow";

describe("IconRow", () => {
  it("renders a decorative primary icon and the text", () => {
    render(
      <IconList className="extra">
        <IconRow icon={Wrench}>
          Seller says: starts and runs. <a href="/x">Details</a>
        </IconRow>
      </IconList>
    );
    const list = screen.getByRole("list");
    expect(list).toHaveClass("extra", "list-none");
    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("Seller says: starts and runs. Details");
    expect(row).toHaveClass("text-[15px]");
    const icon = row.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveClass("text-primary");
    expect(screen.getByRole("link", { name: "Details" })).toBeInTheDocument();
  });

  it("uses the 14px light style on the dark band and merges className", () => {
    render(
      <ul>
        <IconRow icon={Wrench} onDark className="extra">
          Seller ID checked
        </IconRow>
      </ul>
    );
    const row = screen.getByRole("listitem");
    expect(row).toHaveClass("text-sm", "text-hero-muted", "extra");
    expect(row.querySelector("svg")).toHaveClass("text-hero-muted");
  });
});
