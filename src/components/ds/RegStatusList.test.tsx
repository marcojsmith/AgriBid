import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { RegStatusList } from "./RegStatusList";

describe("RegStatusList", () => {
  it.each([
    ["ok", "bg-ok-soft", "text-ok-fg", "check"],
    ["pending", "bg-warn-soft", "text-warn-fg", "clock"],
    ["bad", "bg-urgent-soft", "text-urgent-fg", "alert"],
    ["neutral", "bg-muted", "text-muted-foreground", "file"],
  ] as const)("renders the %s tone", (tone, bg, fg, icon) => {
    render(
      <RegStatusList
        rows={[{ key: "a", title: "ID", sub: "Under review", tone }]}
      />
    );
    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("ID");
    expect(item).toHaveTextContent("Under review");
    const dot = item.querySelector("[data-slot='reg-status-icon']");
    expect(dot).toHaveClass("size-8", "rounded-full", bg, fg);
    expect(dot).toHaveAttribute("data-icon", icon);
    expect(dot?.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders a divided list with titles, subs and actions", () => {
    render(
      <RegStatusList
        rows={[
          { key: "d", title: "Your details", sub: "Saved", tone: "ok" },
          {
            key: "dep",
            title: "Deposit",
            sub: <span>R 5 000 · not yet received</span>,
            tone: "neutral",
            action: <a href="/register/deposit">Pay now</a>,
          },
        ]}
      />
    );
    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveClass("border-t");
    expect(screen.getByText("Deposit")).toHaveClass(
      "text-base",
      "font-semibold"
    );
    expect(screen.getByText("Saved")).toHaveClass(
      "text-sm",
      "text-muted-foreground"
    );
    expect(
      within(items[1]).getByRole("link", { name: "Pay now" })
    ).toBeVisible();
    expect(within(items[0]).queryByRole("link")).not.toBeInTheDocument();
  });
});
