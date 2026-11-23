import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useLocation, useNavigate } from "react-router-dom";

import { SearchBar } from "./SearchBar";

vi.mock("react-router-dom", () => ({
  useNavigate: vi.fn(),
  useLocation: vi.fn(),
}));

describe("SearchBar", () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    vi.mocked(useLocation).mockReturnValue({ pathname: "/" } as ReturnType<
      typeof useLocation
    >);
  });

  it("searches within a sale page instead of the whole site", () => {
    vi.mocked(useLocation).mockReturnValue({
      pathname: "/auctions/abc123",
    } as ReturnType<typeof useLocation>);
    render(<SearchBar />);
    const input = screen.getByPlaceholderText(
      /Search make, model or category/i
    );
    fireEvent.change(input, { target: { value: "Case" } });
    const form = input.closest("form");
    if (!form) throw new Error("Expected a form");
    fireEvent.submit(form);
    expect(mockNavigate).toHaveBeenCalledWith("/auctions/abc123?q=Case");
  });

  it("renders correctly", () => {
    render(<SearchBar />);
    expect(
      screen.getByPlaceholderText(/Search make, model or category/i)
    ).toBeInTheDocument();
  });

  it("updates input value on change", () => {
    render(<SearchBar />);
    const input = screen.getByPlaceholderText(
      /Search make, model or category/i
    );
    fireEvent.change(input, { target: { value: "Tractor" } });
    expect(input).toHaveValue("Tractor");
  });

  it("navigates to search results on submit", () => {
    render(<SearchBar />);
    const input = screen.getByPlaceholderText(
      /Search make, model or category/i
    );
    const form = input.closest("form");
    if (!form) {
      throw new Error("Expected SearchBar to render a <form> element");
    }

    fireEvent.change(input, { target: { value: "John Deere" } });
    fireEvent.submit(form);

    expect(mockNavigate).toHaveBeenCalledWith("/?q=John%20Deere");
    expect(input).toHaveValue("");
  });

  it("calls onSearch callback on submit", () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);
    const input = screen.getByPlaceholderText(
      /Search make, model or category/i
    );
    const form = input.closest("form");
    if (!form) {
      throw new Error("Expected SearchBar to render a <form> element");
    }

    fireEvent.change(input, { target: { value: "Tractor" } });
    fireEvent.submit(form);

    expect(onSearch).toHaveBeenCalled();
  });

  it("does not navigate if query is empty", () => {
    render(<SearchBar />);
    const input = screen.getByPlaceholderText(
      /Search make, model or category/i
    );
    const form = input.closest("form");
    if (!form) {
      throw new Error("Expected SearchBar to render a <form> element");
    }

    fireEvent.submit(form);

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
