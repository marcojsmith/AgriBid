import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useNavigate } from "react-router-dom";

import { SearchBar } from "../header/SearchBar";

vi.mock("react-router-dom", () => ({
  useNavigate: vi.fn(),
}));

describe("SearchBar", () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
  });

  it("renders correctly", () => {
    render(<SearchBar />);
    expect(
      screen.getByPlaceholderText(/Search equipment/i)
    ).toBeInTheDocument();
  });

  it("updates input value on change", () => {
    render(<SearchBar />);
    const input = screen.getByPlaceholderText(/Search equipment/i);
    fireEvent.change(input, { target: { value: "Tractor" } });
    expect(input).toHaveValue("Tractor");
  });

  it("navigates to search results on submit", () => {
    render(<SearchBar />);
    const input = screen.getByPlaceholderText(/Search equipment/i);
    const form = input.closest("form");

    fireEvent.change(input, { target: { value: "John Deere" } });
    fireEvent.submit(form!);

    expect(mockNavigate).toHaveBeenCalledWith("/?q=John%20Deere");
    expect(input).toHaveValue("");
  });

  it("calls onSearch callback on submit", () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);
    const input = screen.getByPlaceholderText(/Search equipment/i);
    const form = input.closest("form");

    fireEvent.change(input, { target: { value: "Tractor" } });
    fireEvent.submit(form!);

    expect(onSearch).toHaveBeenCalled();
  });

  it("does not navigate if query is empty", () => {
    render(<SearchBar />);
    const input = screen.getByPlaceholderText(/Search equipment/i);
    const form = input.closest("form");

    fireEvent.submit(form!);

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
