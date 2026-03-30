import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { ReactNode } from "react";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";

import AdminBusinessInfo from "./AdminBusinessInfo";

type BusinessInfo = {
  businessName: string | null;
  businessDescription: string | null;
  streetAddress: string | null;
  addressLocality: string | null;
  addressCountry: string | null;
  postalCode: string | null;
  telephone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  sameAs: string[] | null;
};

const blankBusinessInfo: BusinessInfo = {
  businessName: null,
  businessDescription: null,
  streetAddress: null,
  addressLocality: null,
  addressCountry: null,
  postalCode: null,
  telephone: null,
  email: null,
  website: null,
  logoUrl: null,
  sameAs: null,
};

let mockBusinessInfo: BusinessInfo | undefined;
const mockUpdateBusinessInfo = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => mockBusinessInfo),
  useMutation: vi.fn(() => mockUpdateBusinessInfo),
}));

vi.mock("convex/_generated/api", () => ({
  api: {
    admin: {
      getBusinessInfo: "admin:getBusinessInfo",
      updateBusinessInfo: "admin:updateBusinessInfo",
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/components/admin/AdminLayout", () => ({
  AdminLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid="admin-layout">{children}</div>
  ),
}));

describe("AdminBusinessInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBusinessInfo = undefined;
    (useQuery as Mock).mockImplementation(() => mockBusinessInfo);
    (useMutation as Mock).mockImplementation(() => mockUpdateBusinessInfo);
  });

  it("renders loading state when business info is undefined", () => {
    render(<AdminBusinessInfo />);
    expect(screen.getByTestId("admin-layout")).toBeInTheDocument();
    expect(
      screen.queryByRole("status") ?? document.querySelector(".animate-spin")
    ).toBeInTheDocument();
  });

  it("renders all form fields when business info is loaded", () => {
    mockBusinessInfo = { ...blankBusinessInfo };
    (useQuery as Mock).mockReturnValue(mockBusinessInfo);
    render(<AdminBusinessInfo />);

    expect(screen.getByLabelText(/organization name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/street address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/city \/ locality/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/country code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/postal code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/telephone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/website/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/logo url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/social media links/i)).toBeInTheDocument();
  });

  it("pre-populates fields from query result", () => {
    mockBusinessInfo = {
      businessName: "AgriBid",
      businessDescription: "South Africa's agricultural auction platform",
      streetAddress: "123 Harvest Road",
      addressLocality: "Agricultural Hub",
      addressCountry: "ZA",
      postalCode: "4500",
      telephone: "+27-11-555-0123",
      email: "info@agribid.co.za",
      website: "https://agribid.co.za",
      logoUrl: "https://agribid.co.za/logo.png",
      sameAs: ["https://facebook.com/agribid", "https://twitter.com/agribid"],
    };
    (useQuery as Mock).mockReturnValue(mockBusinessInfo);
    render(<AdminBusinessInfo />);

    expect(screen.getByDisplayValue("AgriBid")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("South Africa's agricultural auction platform")
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("123 Harvest Road")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Agricultural Hub")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ZA")).toBeInTheDocument();
    expect(screen.getByDisplayValue("4500")).toBeInTheDocument();
    expect(screen.getByDisplayValue("+27-11-555-0123")).toBeInTheDocument();
    expect(screen.getByDisplayValue("info@agribid.co.za")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("https://agribid.co.za")
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("https://agribid.co.za/logo.png")
    ).toBeInTheDocument();
    const sameAsTextarea = screen.getByLabelText(/social media links/i);
    const value = (sameAsTextarea as HTMLTextAreaElement).value;
    expect(value).toMatch(/facebook\.com\/agribid/);
    expect(value).toMatch(/twitter\.com\/agribid/);
  });

  it("shows error toast when website is not a valid URL", async () => {
    mockBusinessInfo = { ...blankBusinessInfo };
    (useQuery as Mock).mockReturnValue(mockBusinessInfo);
    render(<AdminBusinessInfo />);

    fireEvent.change(screen.getByLabelText(/website/i), {
      target: { value: "not-a-valid-url" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Website must be a valid URL");
      expect(mockUpdateBusinessInfo).not.toHaveBeenCalled();
    });
  });

  it("shows error toast when telephone format is invalid", async () => {
    mockBusinessInfo = { ...blankBusinessInfo };
    (useQuery as Mock).mockReturnValue(mockBusinessInfo);
    render(<AdminBusinessInfo />);

    fireEvent.change(screen.getByLabelText(/telephone/i), {
      target: { value: "abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Telephone must be a valid phone number (7-20 characters)"
      );
      expect(mockUpdateBusinessInfo).not.toHaveBeenCalled();
    });
  });

  it("shows error toast when email format is invalid", async () => {
    mockBusinessInfo = { ...blankBusinessInfo };
    (useQuery as Mock).mockReturnValue(mockBusinessInfo);
    render(<AdminBusinessInfo />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Email must be a valid email address"
      );
      expect(mockUpdateBusinessInfo).not.toHaveBeenCalled();
    });
  });

  it("shows error toast when sameAs contains invalid URL", async () => {
    mockBusinessInfo = { ...blankBusinessInfo };
    (useQuery as Mock).mockReturnValue(mockBusinessInfo);
    render(<AdminBusinessInfo />);

    fireEvent.change(screen.getByLabelText(/social media links/i), {
      target: { value: "invalid-url\nhttps://valid.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Invalid URL in social links: invalid-url"
      );
      expect(mockUpdateBusinessInfo).not.toHaveBeenCalled();
    });
  });

  it("calls updateBusinessInfo with correct payload on save", async () => {
    mockBusinessInfo = {
      businessName: "Existing",
      businessDescription: null,
      streetAddress: null,
      addressLocality: null,
      addressCountry: null,
      postalCode: null,
      telephone: null,
      email: null,
      website: null,
      logoUrl: null,
      sameAs: null,
    };
    (useQuery as Mock).mockReturnValue(mockBusinessInfo);
    mockUpdateBusinessInfo.mockResolvedValue(null);
    render(<AdminBusinessInfo />);

    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => {
      expect(mockUpdateBusinessInfo).toHaveBeenCalledWith({
        businessName: "Existing",
        businessDescription: "",
        streetAddress: "",
        addressLocality: "",
        addressCountry: "",
        postalCode: "",
        telephone: "",
        email: "",
        website: "",
        logoUrl: "",
        sameAs: [],
      });
      expect(toast.success).toHaveBeenCalledWith("Business info saved");
    });
  });

  it("shows loading state while mutation is in flight", async () => {
    mockBusinessInfo = { ...blankBusinessInfo };
    (useQuery as Mock).mockReturnValue(mockBusinessInfo);

    let resolveMutation: (value: unknown) => void;
    mockUpdateBusinessInfo.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMutation = resolve;
        })
    );

    render(<AdminBusinessInfo />);

    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));

    expect(screen.getByRole("button", { name: /saving.../i })).toBeDisabled();

    resolveMutation!(null);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /save settings/i })
      ).not.toBeDisabled();
    });
  });

  it("shows error toast when save fails", async () => {
    mockBusinessInfo = { ...blankBusinessInfo };
    (useQuery as Mock).mockReturnValue(mockBusinessInfo);
    mockUpdateBusinessInfo.mockRejectedValue(new Error("Network error"));
    render(<AdminBusinessInfo />);

    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Network error");
    });
  });

  it("handles empty sameAs textarea correctly", async () => {
    mockBusinessInfo = {
      ...blankBusinessInfo,
      sameAs: ["https://facebook.com/agribid"],
    };
    (useQuery as Mock).mockReturnValue(mockBusinessInfo);
    mockUpdateBusinessInfo.mockResolvedValue(null);
    render(<AdminBusinessInfo />);

    fireEvent.change(screen.getByLabelText(/social media links/i), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => {
      expect(mockUpdateBusinessInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          sameAs: [],
        })
      );
    });
  });
});
