import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { PlatformSettingsCards } from "./PlatformSettingsCards";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));
vi.mock("convex/_generated/api", () => ({
  api: {
    admin: {
      platformSettings: {
        getPlatformSettings: "ps:get",
        updateBuyerPremium: "ps:premium",
        updateRegistrationDeposit: "ps:deposit",
        updateSellerCosts: "ps:seller",
        updateFinanceContact: "ps:finance",
        updatePushReminders: "ps:push",
        updateWatchAlerts: "ps:watch",
        updateMinPhotos: "ps:photos",
        getDepositBankDetails: "ps:bank",
        updateDepositBankDetails: "ps:bankUpdate",
      },
    },
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const settings = {
  buyerPremiumPct: 12,
  deposit: { enabled: false, amount: 5000, refundDays: 5 },
  sellerCosts: { commissionPct: 5, listingFee: 0, payoutDays: 7 },
  financeContact: { name: null, company: null, phone: null },
  pushRemindersEnabled: false,
  watchAlertsEnabled: false,
  minPhotosPerLot: 8,
};

const emptyBank = {
  bank: null,
  accountName: null,
  accountNumber: null,
  branchCode: null,
};

/** Bank details the `ps:bank` query returns; reset in `beforeEach`. */
let storedBank:
  | {
      bank: string | null;
      accountName: string | null;
      accountNumber: string | null;
      branchCode: string | null;
    }
  | undefined = emptyBank;

const mutations: Record<string, Mock> = {};

/**
 * Fills a labelled input and submits its form.
 *
 * @param label - Accessible label of the input
 * @param value - New value
 */
function fill(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

/**
 * Finds the form that contains a labelled input.
 *
 * @param label - Accessible label of an input inside the form
 * @returns The enclosing form element
 */
function getForm(label: string): HTMLFormElement {
  const form = screen.getByLabelText(label).closest("form");
  if (!form) throw new Error(`No form around "${label}"`);
  return form;
}

describe("PlatformSettingsCards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of [
      "ps:premium",
      "ps:deposit",
      "ps:seller",
      "ps:finance",
      "ps:push",
      "ps:watch",
      "ps:photos",
      "ps:bankUpdate",
    ]) {
      mutations[key] = vi.fn().mockResolvedValue({ success: true });
    }
    storedBank = emptyBank;
    (useMutation as Mock).mockImplementation((ref: string) => mutations[ref]);
    (useQuery as Mock).mockImplementation((ref: string) =>
      ref === "ps:bank" ? storedBank : settings
    );
  });

  it("shows a loading line while settings load", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    render(<PlatformSettingsCards />);
    expect(screen.getByText(/Loading platform settings/)).toBeInTheDocument();
  });

  it("shows a loading line while the bank details load", () => {
    storedBank = undefined;
    render(<PlatformSettingsCards />);
    expect(screen.getByText(/Loading bank details/)).toBeInTheDocument();
  });

  it("saves the deposit bank details", async () => {
    render(<PlatformSettingsCards />);
    expect(screen.getByText("Deposit bank details")).toBeInTheDocument();
    expect(
      screen.getByText("Shown to buyers on the deposit step.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save bank details" })
    ).toBeDisabled();
    fill("Bank", "FNB");
    fill("Account name", "AgriBid Trust");
    fill("Account number", "62012345678");
    fill("Branch code", "250655");
    fireEvent.click(screen.getByRole("button", { name: "Save bank details" }));
    await waitFor(() => {
      expect(mutations["ps:bankUpdate"]).toHaveBeenCalledWith({
        bank: "FNB",
        accountName: "AgriBid Trust",
        accountNumber: "62012345678",
        branchCode: "250655",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Bank details saved");
  });

  it("starts from stored bank details and can clear them", async () => {
    storedBank = {
      bank: "FNB",
      accountName: "AgriBid Trust",
      accountNumber: "62012345678",
      branchCode: "250655",
    };
    render(<PlatformSettingsCards />);
    expect(screen.getByLabelText("Bank")).toHaveValue("FNB");
    fill("Account number", "");
    fireEvent.click(screen.getByRole("button", { name: "Save bank details" }));
    await waitFor(() => {
      expect(mutations["ps:bankUpdate"]).toHaveBeenCalledWith({
        bank: "FNB",
        accountName: "AgriBid Trust",
        accountNumber: "",
        branchCode: "250655",
      });
    });
  });

  it("validates the account number, branch code and field length", () => {
    render(<PlatformSettingsCards />);
    fill("Account number", "12ab");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Account number must be 6 to 16 digits."
    );
    expect(
      screen.getByRole("button", { name: "Save bank details" })
    ).toBeDisabled();
    fill("Account number", "123456");
    fill("Branch code", "12345");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Branch code must be 6 digits."
    );
    fill("Branch code", "250655");
    fill("Bank", "x".repeat(101));
    expect(screen.getByRole("alert")).toHaveTextContent("at most 100");
    fill("Bank", "FNB");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("starts every Save button disabled", () => {
    render(<PlatformSettingsCards />);
    for (const name of [
      "Save buyer's premium",
      "Save deposit",
      "Save seller costs",
      "Save finance contact",
      "Save push reminders",
      "Save watched-lot alerts",
      "Save minimum photos",
    ]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });

  it("saves the buyer's premium", async () => {
    render(<PlatformSettingsCards />);
    fill("Buyer's premium (%)", "10.5");
    fireEvent.click(
      screen.getByRole("button", { name: "Save buyer's premium" })
    );
    await waitFor(() => {
      expect(mutations["ps:premium"]).toHaveBeenCalledWith({ pct: 10.5 });
    });
    expect(toast.success).toHaveBeenCalledWith("Buyer's premium saved");
  });

  it("blocks an out-of-range buyer's premium", () => {
    render(<PlatformSettingsCards />);
    fill("Buyer's premium (%)", "150");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Buyer's premium must be a number between 0 and 100."
    );
    expect(
      screen.getByRole("button", { name: "Save buyer's premium" })
    ).toBeDisabled();
  });

  it("blocks a blank value", () => {
    render(<PlatformSettingsCards />);
    fill("Buyer's premium (%)", "");
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("does not submit an invalid form", () => {
    render(<PlatformSettingsCards />);
    fill("Buyer's premium (%)", "150");
    const form = getForm("Buyer's premium (%)");
    fireEvent.submit(form);
    expect(mutations["ps:premium"]).not.toHaveBeenCalled();
  });

  it("saves the registration deposit", async () => {
    render(<PlatformSettingsCards />);
    fireEvent.click(screen.getByRole("switch", { name: "Deposit required" }));
    fill("Deposit amount (R)", "7500");
    fill("Refund within (working days)", "3");
    fireEvent.click(screen.getByRole("button", { name: "Save deposit" }));
    await waitFor(() => {
      expect(mutations["ps:deposit"]).toHaveBeenCalledWith({
        enabled: true,
        amount: 7500,
        refundDays: 3,
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Registration deposit saved");
  });

  it("rejects a fractional deposit and out-of-range refund days", () => {
    render(<PlatformSettingsCards />);
    fill("Deposit amount (R)", "10.5");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Deposit amount must be a whole number between 0 and 1000000."
    );
    fill("Deposit amount (R)", "100");
    fill("Refund within (working days)", "31");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Refund days must be a whole number between 1 and 30."
    );
  });

  it("saves seller costs", async () => {
    render(<PlatformSettingsCards />);
    fill("Commission (%)", "6.5");
    fill("Listing fee (R)", "250");
    fill("Payout within (days)", "14");
    fireEvent.click(screen.getByRole("button", { name: "Save seller costs" }));
    await waitFor(() => {
      expect(mutations["ps:seller"]).toHaveBeenCalledWith({
        commissionPct: 6.5,
        listingFee: 250,
        payoutDays: 14,
      });
    });
  });

  it("validates seller costs", () => {
    render(<PlatformSettingsCards />);
    fill("Listing fee (R)", "-1");
    expect(screen.getByRole("alert")).toHaveTextContent("Listing fee");
    fill("Listing fee (R)", "0");
    fill("Commission (%)", "101");
    expect(screen.getByRole("alert")).toHaveTextContent("Commission");
    fill("Commission (%)", "5");
    fill("Payout within (days)", "61");
    expect(screen.getByRole("alert")).toHaveTextContent("Payout days");
  });

  it("saves the finance contact", async () => {
    render(<PlatformSettingsCards />);
    fill("Name", "Thandi");
    fill("Company", "AgriBid Finance");
    fill("Phone", "+27 11 555 0100");
    fireEvent.click(
      screen.getByRole("button", { name: "Save finance contact" })
    );
    await waitFor(() => {
      expect(mutations["ps:finance"]).toHaveBeenCalledWith({
        name: "Thandi",
        company: "AgriBid Finance",
        phone: "+27 11 555 0100",
      });
    });
  });

  it("starts from a stored finance contact and can clear it", async () => {
    (useQuery as Mock).mockReturnValue({
      ...settings,
      financeContact: { name: "Thandi", company: "AF", phone: "0115550100" },
    });
    render(<PlatformSettingsCards />);
    expect(screen.getByLabelText("Name")).toHaveValue("Thandi");
    fill("Name", "");
    fill("Company", "");
    fill("Phone", "");
    fireEvent.click(
      screen.getByRole("button", { name: "Save finance contact" })
    );
    await waitFor(() => {
      expect(mutations["ps:finance"]).toHaveBeenCalledWith({
        name: "",
        company: "",
        phone: "",
      });
    });
  });

  it("rejects a bad phone number and over-long fields", () => {
    render(<PlatformSettingsCards />);
    fill("Phone", "abc");
    expect(screen.getByRole("alert")).toHaveTextContent("valid phone number");
    fill("Phone", "");
    fill("Name", "x".repeat(101));
    expect(screen.getByRole("alert")).toHaveTextContent("at most 100");
    expect(
      screen.getByRole("button", { name: "Save finance contact" })
    ).toBeDisabled();
  });

  it("saves push reminders", async () => {
    render(<PlatformSettingsCards />);
    expect(screen.getByText(/Stays off until push/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("switch", { name: "Send push reminders" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Save push reminders" })
    );
    await waitFor(() => {
      expect(mutations["ps:push"]).toHaveBeenCalledWith({ enabled: true });
    });
  });

  it("saves watched-lot alerts separately from push reminders", async () => {
    render(<PlatformSettingsCards />);
    fireEvent.click(
      screen.getByRole("switch", {
        name: "Watched-lot alerts (outbid, closing in 1 hour)",
      })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Save watched-lot alerts" })
    );
    await waitFor(() => {
      expect(mutations["ps:watch"]).toHaveBeenCalledWith({ enabled: true });
    });
    expect(mutations["ps:push"]).not.toHaveBeenCalled();
  });

  it("saves the minimum photos and validates the range", async () => {
    render(<PlatformSettingsCards />);
    fill("Minimum photos", "11");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Minimum photos must be a whole number between 1 and 10."
    );
    fill("Minimum photos", "10");
    fireEvent.click(
      screen.getByRole("button", { name: "Save minimum photos" })
    );
    await waitFor(() => {
      expect(mutations["ps:photos"]).toHaveBeenCalledWith({ count: 10 });
    });
  });

  it("shows the server error when saving fails", async () => {
    mutations["ps:photos"].mockRejectedValue(new Error("Not authorized"));
    render(<PlatformSettingsCards />);
    fill("Minimum photos", "10");
    fireEvent.click(
      screen.getByRole("button", { name: "Save minimum photos" })
    );
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Not authorized");
    });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("ignores a second submit while saving", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    mutations["ps:photos"].mockReturnValue(
      new Promise((res) => {
        resolve = res;
      })
    );
    render(<PlatformSettingsCards />);
    fill("Minimum photos", "10");
    const form = getForm("Minimum photos");
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(mutations["ps:photos"]).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    resolve({ success: true });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Minimum photos saved");
    });
  });
});
