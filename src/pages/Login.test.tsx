import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";

import { useSession, signIn, signUp } from "@/lib/auth-client";

import Login from "./Login";

// Mock auth-client
vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(),
  signIn: {
    email: vi.fn(),
  },
  signUp: {
    email: vi.fn(),
  },
}));

vi.mock("@/hooks/useBranding", () => ({
  useBranding: () => ({ appName: "AgriBid" }),
}));

describe("Login Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useSession as Mock).mockReturnValue({ data: null, isPending: false });
  });

  const renderComponent = (initialEntries = ["/login"]) =>
    render(
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<div>Home Page</div>} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

  it("renders sign in form by default", () => {
    renderComponent();
    expect(screen.getByText("Sign In to AgriBid")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("name@farm.com")).toBeInTheDocument();
    expect(screen.getByLabelText("Secure Password")).toBeInTheDocument();
  });

  it("switches to registration mode", () => {
    renderComponent();
    const switchButton = screen.getByText("Switch to Registration");
    fireEvent.click(switchButton);

    expect(screen.getByText("Create Verified Account")).toBeInTheDocument();
    expect(screen.getByLabelText("Create Secure Password")).toBeInTheDocument();
    expect(screen.getByText("Switch to Sign In")).toBeInTheDocument();
  });

  it("handles successful sign in", async () => {
    (signIn.email as Mock).mockResolvedValue({ error: null });
    renderComponent();

    fireEvent.change(screen.getByPlaceholderText("name@farm.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Secure Password"), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByText("Sign In to AgriBid"));

    await waitFor(() => {
      expect(signIn.email).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
        callbackURL: "/",
      });
    });
  });

  it("handles sign in failure with error message", async () => {
    (signIn.email as Mock).mockResolvedValue({
      error: { message: "Invalid credentials" },
    });
    renderComponent();

    fireEvent.change(screen.getByPlaceholderText("name@farm.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Secure Password"), {
      target: { value: "wrong" },
    });

    fireEvent.click(screen.getByText("Sign In to AgriBid"));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });

  it("handles sign in catch block error", async () => {
    (signIn.email as Mock).mockRejectedValue(new Error("Network failed"));
    renderComponent();

    fireEvent.change(screen.getByPlaceholderText("name@farm.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Secure Password"), {
      target: { value: "password" },
    });

    fireEvent.click(screen.getByText("Sign In to AgriBid"));

    await waitFor(() => {
      expect(screen.getByText("Network failed")).toBeInTheDocument();
    });
  });

  it("handles successful sign up", async () => {
    (signUp.email as Mock).mockResolvedValue({ error: null });
    renderComponent();

    // Switch to signup
    fireEvent.click(screen.getByText("Switch to Registration"));

    fireEvent.change(screen.getByPlaceholderText("name@farm.com"), {
      target: { value: "john.doe@farm.com" },
    });
    fireEvent.change(screen.getByLabelText("Create Secure Password"), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByText("Create Verified Account"));

    await waitFor(() => {
      expect(signUp.email).toHaveBeenCalledWith({
        email: "john.doe@farm.com",
        password: "password123",
        name: "John Doe",
        callbackURL: "/",
      });
    });
  });

  it("handles sign up failure", async () => {
    (signUp.email as Mock).mockResolvedValue({
      error: { message: "Email already exists" },
    });
    renderComponent();

    fireEvent.click(screen.getByText("Switch to Registration"));
    fireEvent.change(screen.getByPlaceholderText("name@farm.com"), {
      target: { value: "existing@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Create Secure Password"), {
      target: { value: "password" },
    });

    fireEvent.click(screen.getByText("Create Verified Account"));

    await waitFor(() => {
      expect(screen.getByText("Email already exists")).toBeInTheDocument();
    });
  });

  it("redirects if session exists", () => {
    (useSession as Mock).mockReturnValue({
      data: { user: { id: "1" } },
      isPending: false,
    });
    renderComponent();
    expect(screen.getByText("Home Page")).toBeInTheDocument();
  });

  it("redirects to callbackUrl if provided and session exists", () => {
    (useSession as Mock).mockReturnValue({
      data: { user: { id: "1" } },
      isPending: false,
    });
    renderComponent(["/login?callbackUrl=/dashboard"]);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("shows loading state when session is pending", () => {
    (useSession as Mock).mockReturnValue({ data: null, isPending: true });
    renderComponent();
    expect(screen.getByText("Authenticating...")).toBeInTheDocument();
  });

  it("handles sign up with default name if email has no prefix", async () => {
    (signUp.email as Mock).mockResolvedValue({ error: null });
    renderComponent();
    fireEvent.click(screen.getByText("Switch to Registration"));

    // emailPrefix = email.split("@")[0] || "User"
    // name = emailPrefix.replace(/[._-]+/g, " ").trim().split(/\s+/)...join(" ") || "User"
    fireEvent.change(screen.getByPlaceholderText("name@farm.com"), {
      target: { value: ".@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Create Secure Password"), {
      target: { value: "password" },
    });

    fireEvent.click(screen.getByText("Create Verified Account"));

    await waitFor(() => {
      expect(signUp.email).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "User",
        })
      );
    });
  });

  it("handles sign up name cleaning with complex email prefix", async () => {
    (signUp.email as Mock).mockResolvedValue({ error: null });
    renderComponent();
    fireEvent.click(screen.getByText("Switch to Registration"));

    fireEvent.change(screen.getByPlaceholderText("name@farm.com"), {
      target: { value: "john_doe.middle-name@farm.com" },
    });
    fireEvent.change(screen.getByLabelText("Create Secure Password"), {
      target: { value: "password" },
    });

    fireEvent.click(screen.getByText("Create Verified Account"));

    await waitFor(() => {
      expect(signUp.email).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "John Doe Middle Name",
        })
      );
    });
  });

  it("handles sign up catch block error", async () => {
    (signUp.email as Mock).mockRejectedValue(new Error("Signup failed"));
    renderComponent();
    fireEvent.click(screen.getByText("Switch to Registration"));

    fireEvent.change(screen.getByPlaceholderText("name@farm.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Create Secure Password"), {
      target: { value: "password" },
    });

    fireEvent.click(screen.getByText("Create Verified Account"));

    await waitFor(() => {
      expect(screen.getByText("Signup failed")).toBeInTheDocument();
    });
  });

  it("handles invalid callbackUrl by defaulting to root", () => {
    (useSession as Mock).mockReturnValue({
      data: { user: { id: "1" } },
      isPending: false,
    });
    renderComponent(["/login?callbackUrl=http://evil.com"]);
    expect(screen.getByText("Home Page")).toBeInTheDocument();
  });

  it("uses default sign in error message if message is missing", async () => {
    (signIn.email as Mock).mockResolvedValue({
      error: { message: "" },
    });
    renderComponent();

    fireEvent.change(screen.getByPlaceholderText("name@farm.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Secure Password"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByText("Sign In to AgriBid"));

    await waitFor(() => {
      expect(screen.getByText("Sign in failed")).toBeInTheDocument();
    });
  });

  it("handles sign in catch block with non-Error object", async () => {
    (signIn.email as Mock).mockRejectedValue("not an error object");
    renderComponent();

    fireEvent.change(screen.getByPlaceholderText("name@farm.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Secure Password"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByText("Sign In to AgriBid"));

    await waitFor(() => {
      expect(
        screen.getByText("Sign in failed. Please try again.")
      ).toBeInTheDocument();
    });
  });

  it("uses default sign up error message if message is missing", async () => {
    (signUp.email as Mock).mockResolvedValue({
      error: { message: "" },
    });
    renderComponent();
    fireEvent.click(screen.getByText("Switch to Registration"));

    fireEvent.change(screen.getByPlaceholderText("name@farm.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Create Secure Password"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByText("Create Verified Account"));

    await waitFor(() => {
      expect(screen.getByText("Registration failed")).toBeInTheDocument();
    });
  });

  it("handles sign up catch block with non-Error object", async () => {
    (signUp.email as Mock).mockRejectedValue("string error");
    renderComponent();
    fireEvent.click(screen.getByText("Switch to Registration"));

    fireEvent.change(screen.getByPlaceholderText("name@farm.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Create Secure Password"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByText("Create Verified Account"));

    await waitFor(() => {
      expect(
        screen.getByText("Registration failed. Please try again.")
      ).toBeInTheDocument();
    });
  });
});
