import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { BackLink, LotNav } from "./LotNav";

describe("BackLink", () => {
  it("links back with its label", () => {
    render(
      <MemoryRouter>
        <BackLink to="/auctions/a1">Year End Auction · 85 lots</BackLink>
      </MemoryRouter>
    );
    expect(
      screen.getByRole("link", { name: "Year End Auction · 85 lots" })
    ).toHaveAttribute("href", "/auctions/a1");
  });
});

describe("LotNav", () => {
  it("links the previous and next lot", () => {
    render(
      <MemoryRouter>
        <LotNav
          prev={{ to: "/auction/l2", number: 2 }}
          next={{ to: "/auction/l4", number: 4 }}
        />
      </MemoryRouter>
    );
    expect(
      screen.getByRole("link", { name: /Previous lot, lot 2/ })
    ).toHaveAttribute("href", "/auction/l2");
    expect(
      screen.getByRole("link", { name: /Next lot, lot 4/ })
    ).toHaveAttribute("href", "/auction/l4");
  });

  it("leaves out the side that does not exist, and everything when neither does", () => {
    const { container, rerender } = render(
      <MemoryRouter>
        <LotNav prev={null} next={{ to: "/auction/l4", number: 4 }} />
      </MemoryRouter>
    );
    expect(screen.queryByText("Lot 2")).toBeNull();
    expect(screen.getByText("Lot 4")).toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <LotNav prev={{ to: "/auction/l2", number: 2 }} next={null} />
      </MemoryRouter>
    );
    expect(screen.queryByText("Lot 4")).toBeNull();
    rerender(
      <MemoryRouter>
        <LotNav prev={null} next={null} />
      </MemoryRouter>
    );
    expect(container.querySelector("nav")).toBeNull();
  });
});
