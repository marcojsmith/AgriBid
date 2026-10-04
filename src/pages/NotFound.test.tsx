import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import NotFound from "./NotFound";

describe("NotFound", () => {
  it("displays 404 heading", () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    expect(screen.getByText("404")).toBeInTheDocument();
  });

  it("displays page not found message", () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    expect(screen.getByText("Page Not Found")).toBeInTheDocument();
  });

  it("displays description text", () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    expect(
      screen.getByText(/The page you're looking for doesn't exist/)
    ).toBeInTheDocument();
  });

  it("displays go home link", () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    const homeLink = screen.getByRole("link", { name: /go home/i });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("displays browse auctions link", () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    const auctionsLink = screen.getByRole("link", { name: /browse auctions/i });
    expect(auctionsLink).toBeInTheDocument();
    expect(auctionsLink).toHaveAttribute("href", "/auctions");
  });
});
