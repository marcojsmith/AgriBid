import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { BeforeYouBid } from "./BeforeYouBid";

describe("BeforeYouBid", () => {
  it("shows the five rows with the transport link", () => {
    render(
      <BeforeYouBid
        transportHref="/support"
        finance={{
          name: "Lee-Anne",
          company: "com-fin",
          phone: "083 277 0178",
        }}
      />
    );
    expect(
      screen.getByRole("heading", { name: "Before you bid" })
    ).toBeInTheDocument();
    expect(screen.getByText("Viewing and collection")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Request a transport quote/ })
    ).toHaveAttribute("href", "/support");
    expect(screen.getByText("Reserve")).toBeInTheDocument();
    expect(
      screen.getByText(/EFT within 48 hours\. Your deposit counts/)
    ).toBeInTheDocument();
  });

  it("links the finance contact to a call", () => {
    render(
      <BeforeYouBid
        transportHref="/support"
        finance={{
          name: "Lee-Anne",
          company: "com-fin",
          phone: "083 277 0178",
        }}
      />
    );
    const link = screen.getByRole("link", { name: /Need finance\?/ });
    expect(link).toHaveAttribute("href", "tel:0832770178");
    expect(link).toHaveTextContent("Lee-Anne, com-fin, 083 277 0178");
  });

  it("hides the finance row until a phone is set", () => {
    const { rerender } = render(<BeforeYouBid transportHref="/support" />);
    expect(screen.queryByText("Need finance?")).toBeNull();
    rerender(
      <BeforeYouBid
        transportHref="/support"
        finance={{ name: "A", company: null, phone: null }}
      />
    );
    expect(screen.queryByText("Need finance?")).toBeNull();
  });

  it("leaves the deposit sentence out when there is no deposit", () => {
    render(<BeforeYouBid transportHref="/support" depositEnabled={false} />);
    expect(screen.queryByText(/deposit/)).toBeNull();
  });
});
