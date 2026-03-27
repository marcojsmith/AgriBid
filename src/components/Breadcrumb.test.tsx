import { render as rtlRender, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BrowserRouter } from "react-router-dom";

import { Breadcrumb } from "./Breadcrumb";

const render = (crumbs: { label: string; href?: string }[]) =>
  rtlRender(
    <BrowserRouter>
      <Breadcrumb crumbs={crumbs} />
    </BrowserRouter>
  );

describe("Breadcrumb", () => {
  it("renders all crumb labels", () => {
    render([{ label: "Home", href: "/" }, { label: "Auction Detail" }]);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Auction Detail")).toBeInTheDocument();
  });

  it("renders a link for intermediate crumbs with href", () => {
    render([{ label: "Home", href: "/" }, { label: "Current" }]);
    const link = screen.getByRole("link", { name: "Home" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });

  it("does not render a link for the last crumb", () => {
    render([{ label: "Home", href: "/" }, { label: "Current" }]);
    expect(
      screen.queryByRole("link", { name: "Current" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
  });

  it("marks the last crumb with aria-current=page", () => {
    render([{ label: "Home", href: "/" }, { label: "Detail Page" }]);
    const current = screen.getByText("Detail Page");
    expect(current).toHaveAttribute("aria-current", "page");
  });

  it("renders a nav with breadcrumb label", () => {
    render([{ label: "Home", href: "/" }]);
    expect(
      screen.getByRole("navigation", { name: /breadcrumb/i })
    ).toBeInTheDocument();
  });

  it("renders single crumb without any link", () => {
    render([{ label: "Home" }]);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("renders multiple intermediate linked crumbs", () => {
    render([
      { label: "Home", href: "/" },
      { label: "Category", href: "/category" },
      { label: "Detail" },
    ]);
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Category" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Detail" })
    ).not.toBeInTheDocument();
  });
});
