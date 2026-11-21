import fs from "node:fs";
import path from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

// Vitest does not return the CSS source for `?raw` CSS imports; supply it.
vi.mock("@/index.css?raw", () => ({
  default: fs.readFileSync(path.join(process.cwd(), "src/index.css"), "utf-8"),
}));

import DesignSystem from "./DesignSystem";

const renderPage = () =>
  render(
    <MemoryRouter>
      <DesignSystem />
    </MemoryRouter>
  );

describe("DesignSystem page", () => {
  afterEach(() => {
    document.documentElement.classList.remove("dark");
  });

  it("renders the token, type and component sections", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { level: 1, name: "Design system" })
    ).toBeInTheDocument();
    for (const name of [
      "Colour tokens",
      "Type scale",
      "Buttons and badges",
      "Imagery",
      "Lot detail blocks",
      "Controls",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
  });

  it("shows a contrast ratio for each pair", () => {
    renderPage();
    expect(screen.getAllByText(/:1 AA/).length).toBeGreaterThan(5);
  });

  it("toggles the dark theme", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark" }));
    expect(document.documentElement).toHaveClass("dark");
    fireEvent.click(screen.getByRole("button", { name: "Switch to light" }));
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("lets the filter chips be removed and cleared, and the segment change", () => {
    renderPage();
    fireEvent.click(
      screen.getByRole("button", { name: "Remove filter: Tractors" })
    );
    expect(
      screen.queryByRole("button", { name: "Remove filter: Tractors" })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.queryByRole("group", { name: "Active filters" })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /Results/ }));
    expect(screen.getByRole("radio", { name: /Results/ })).toBeChecked();
  });
});
