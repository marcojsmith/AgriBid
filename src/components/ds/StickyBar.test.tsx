import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { StickyBar } from "./StickyBar";

const WA = "https://wa.me/27837000000";

describe("StickyBar", () => {
  it("lays out [title / sub] [WhatsApp] [CTA] in a phone-only bar", () => {
    render(
      <StickyBar
        title="Closes in 2d 3h"
        sub="Tue 25 Nov, 11:00"
        whatsappHref={WA}
        cta="Register to bid"
        ctaHref="/register"
        label="Lot actions"
      />
    );
    const bar = screen.getByRole("region", { name: "Lot actions" });
    expect(bar).toHaveClass("fixed", "md:hidden", "min-h-[68px]");
    expect(screen.getByText("Closes in 2d 3h")).not.toHaveClass(
      "text-urgent-fg"
    );
    expect(screen.getByText("Tue 25 Nov, 11:00")).toHaveClass(
      "text-muted-foreground"
    );
    expect(screen.getByRole("link", { name: "WhatsApp us" })).toHaveAttribute(
      "href",
      WA
    );
    expect(
      screen.getByRole("link", { name: "Register to bid" })
    ).toHaveAttribute("href", "/register");
    const kids = Array.from(bar.children);
    expect(kids[0]).toHaveAttribute("data-slot", "sticky-bar-text");
    expect(kids[1]).toHaveAttribute("data-slot", "whatsapp-button");
  });

  it("turns the title red under 10 minutes", () => {
    render(
      <StickyBar
        title="3m 12s"
        urgent
        whatsappHref={WA}
        cta="Bid"
        ctaHref="/b"
      />
    );
    expect(screen.getByText("3m 12s")).toHaveClass("text-urgent-fg");
  });

  it("colours the sub line when leading (green) or outbid (amber)", () => {
    const { rerender } = render(
      <StickyBar
        title="R 414 000"
        sub="You're leading"
        subTone="ok"
        ctaVariant="outline"
        whatsappHref={WA}
        cta="Raise my bid"
        onCta={() => undefined}
      />
    );
    expect(screen.getByText("You're leading")).toHaveClass("text-ok-fg");
    expect(
      screen.getByRole("button", { name: "Raise my bid" })
    ).toHaveAttribute("data-variant", "outline");
    rerender(
      <StickyBar
        title="R 420 000"
        sub="You've been outbid"
        subTone="warn"
        whatsappHref={WA}
        cta="Bid again"
        onCta={() => undefined}
      />
    );
    expect(screen.getByText("You've been outbid")).toHaveClass("text-warn-fg");
  });

  it("calls onCta, omits an empty sub line and can be hidden", () => {
    const onCta = vi.fn();
    const { container, rerender } = render(
      <StickyBar title="R 1" whatsappHref={WA} cta="Bid" onCta={onCta} />
    );
    expect(container.querySelector("small")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Bid" }));
    expect(onCta).toHaveBeenCalledTimes(1);
    rerender(
      <StickyBar title="R 1" whatsappHref={WA} cta="Bid" onCta={onCta} hidden />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
