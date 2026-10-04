import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";

import { FeeManager } from "./FeeManager";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Select to be a simple native select for easier testing
vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange: (v: string) => void;
  }) => (
    <select
      value={value}
      onChange={(e) => {
        onValueChange(e.target.value);
      }}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <option value={value}>{children}</option>,
}));

const mockFees = {
  allFees: [
    {
      _id: "fee1",
      name: "Seller Commission",
      description: "Standard seller commission",
      feeType: "percentage",
      value: 0.05,
      appliesTo: "seller",
      isActive: true,
      visibleToBuyer: false,
      visibleToSeller: true,
      sortOrder: 0,
    },
    {
      _id: "fee2",
      name: "Buyer Premium",
      description: "Buyer premium fee",
      feeType: "percentage",
      value: 0.02,
      appliesTo: "buyer",
      isActive: true,
      visibleToBuyer: true,
      visibleToSeller: false,
      sortOrder: 1,
    },
    {
      _id: "fee3",
      name: "Fixed Listing Fee",
      description: "Fixed fee per listing",
      feeType: "fixed",
      value: 500,
      appliesTo: "seller",
      isActive: false,
      visibleToBuyer: false,
      visibleToSeller: true,
      sortOrder: 2,
    },
  ],
};

const mockCreateFee = vi.fn();
const mockUpdateFee = vi.fn();
const mockDeleteFee = vi.fn();
const mockReorderFees = vi.fn();

/** Fee without a description and with a fixed value, used to cover the fixed-fee form paths. */
const fixedFeeWithoutDescription = {
  allFees: [
    {
      _id: "fee4",
      name: "Storage Fee",
      description: undefined,
      feeType: "fixed",
      value: 250,
      appliesTo: "seller",
      isActive: true,
      visibleToBuyer: false,
      visibleToSeller: true,
      sortOrder: 0,
    },
  ],
};

const renderComponent = () =>
  render(
    <MemoryRouter>
      <FeeManager />
    </MemoryRouter>
  );

/**
 * Finds the native select rendered for a given option label. The select
 * components are mocked to plain `<select>` elements, so they are addressed by
 * the options they contain rather than by a label association.
 *
 * @param optionText - Text of an option that identifies the select
 * @returns The matching select element
 */
const getSelectByOption = (optionText: string): HTMLSelectElement => {
  const select = screen
    .getAllByRole("combobox")
    .find(
      (element): element is HTMLSelectElement =>
        element instanceof HTMLSelectElement &&
        Array.from(element.options).some((option) =>
          option.textContent.includes(optionText)
        )
    );
  if (!select) {
    throw new Error(`No select found containing an option "${optionText}"`);
  }
  return select;
};

/**
 * Shapes a plain mock function like the value Convex's `useMutation` returns,
 * including the `withOptimisticUpdate` member the hook's result carries.
 *
 * @param mutation - Mock standing in for a mutation trigger function
 * @returns The same mock, typed as a `useMutation` result
 */
const asMutationResult = (
  mutation: ReturnType<typeof vi.fn>
): ReturnType<typeof useMutation> =>
  Object.assign(mutation, {
    withOptimisticUpdate: vi.fn(),
  }) as unknown as ReturnType<typeof useMutation>;

describe("FeeManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQuery).mockReturnValue(mockFees);
    let mutationCallCount = 0;
    const mutationMocks = [
      mockCreateFee,
      mockUpdateFee,
      mockDeleteFee,
      mockReorderFees,
    ].map(asMutationResult);
    vi.mocked(useMutation).mockImplementation(() => {
      const mutation = mutationMocks[mutationCallCount % mutationMocks.length];
      mutationCallCount += 1;
      return mutation;
    });
  });

  it("shows loading spinner while fetching fees", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    renderComponent();
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("displays fee list after loading", () => {
    renderComponent();
    expect(screen.getByText("Seller Commission")).toBeInTheDocument();
    expect(screen.getByText("Buyer Premium")).toBeInTheDocument();
    expect(screen.getByText("Fixed Listing Fee")).toBeInTheDocument();
  });

  it("shows empty state when no fees exist", () => {
    vi.mocked(useQuery).mockReturnValue({ allFees: [] });
    renderComponent();
    expect(
      screen.getByText(/No fees configured. Click "Add Fee" to create one./)
    ).toBeInTheDocument();
  });

  it("opens create dialog when Add Fee button is clicked", async () => {
    renderComponent();
    fireEvent.click(screen.getByRole("button", { name: /add fee/i }));
    expect(screen.getByText("Create New Fee")).toBeInTheDocument();
  });

  it("closes create dialog when Cancel is clicked", async () => {
    renderComponent();
    fireEvent.click(screen.getByRole("button", { name: /add fee/i }));
    expect(screen.getByText("Create New Fee")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByText("Create New Fee")).not.toBeInTheDocument();
    });
  });

  it("shows error when submitting empty fee name", async () => {
    renderComponent();
    fireEvent.click(screen.getByRole("button", { name: /add fee/i }));
    fireEvent.click(screen.getByRole("button", { name: /create fee/i }));
    expect(toast.error).toHaveBeenCalledWith("Fee name is required");
  });

  it("opens edit dialog with pre-filled data", async () => {
    renderComponent();
    fireEvent.click(
      screen.getByRole("button", { name: /edit fee seller commission/i })
    );
    expect(screen.getByText("Edit Fee")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Seller Commission")).toBeInTheDocument();
  });

  it("opens delete confirmation dialog", async () => {
    renderComponent();
    fireEvent.click(
      screen.getByRole("button", { name: /delete fee seller commission/i })
    );
    expect(screen.getByText("Delete Fee")).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to delete this fee/)
    ).toBeInTheDocument();
  });

  it("cancels delete operation", async () => {
    renderComponent();
    fireEvent.click(
      screen.getByRole("button", { name: /delete fee seller commission/i })
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByText("Delete Fee")).not.toBeInTheDocument();
    });
  });

  it("displays percentage fee value correctly", () => {
    renderComponent();
    expect(screen.getByText("5%")).toBeInTheDocument();
    expect(screen.getByText("2%")).toBeInTheDocument();
  });

  it("displays fixed fee value correctly", () => {
    renderComponent();
    expect(screen.getByText("R 500,00")).toBeInTheDocument();
  });

  it("displays appliesTo correctly", () => {
    renderComponent();
    const sellerElements = screen.getAllByText("Seller");
    expect(sellerElements.length).toBeGreaterThan(0);
    expect(screen.getByText("Buyer")).toBeInTheDocument();
  });

  it("displays active status correctly", () => {
    renderComponent();
    expect(screen.getAllByText("Active").length).toBe(2);
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("toggles active checkbox", async () => {
    renderComponent();
    fireEvent.click(screen.getByRole("button", { name: /add fee/i }));
    const activeCheckbox = screen.getByRole("checkbox", { name: /active/i });
    expect(activeCheckbox).toBeChecked();
    fireEvent.click(activeCheckbox);
    expect(activeCheckbox).not.toBeChecked();
  });

  it("shows hidden label when both visibility flags are false", () => {
    const hiddenFee = {
      allFees: [
        {
          _id: "feeHidden",
          name: "Hidden Fee",
          description: "Hidden from all",
          feeType: "fixed",
          value: 100,
          appliesTo: "seller",
          isActive: true,
          visibleToBuyer: false,
          visibleToSeller: false,
          sortOrder: 0,
        },
      ],
    };
    vi.mocked(useQuery).mockReturnValue(hiddenFee);
    renderComponent();
    expect(screen.getByText("Hidden")).toBeInTheDocument();
  });

  it("shows both visibility labels when both are true", () => {
    const bothVisibleFee = {
      allFees: [
        {
          _id: "feeBoth",
          name: "Both Visible Fee",
          description: "Visible to both",
          feeType: "percentage",
          value: 0.01,
          appliesTo: "both",
          isActive: true,
          visibleToBuyer: true,
          visibleToSeller: true,
          sortOrder: 0,
        },
      ],
    };
    vi.mocked(useQuery).mockReturnValue(bothVisibleFee);
    renderComponent();
    expect(screen.getByText("Buyer")).toBeInTheDocument();
    expect(screen.getByText("Seller")).toBeInTheDocument();
    expect(screen.getByText("|")).toBeInTheDocument();
  });

  it("does not move first fee up", async () => {
    renderComponent();
    const moveUpButtons = screen.getAllByRole("button", { name: /move.*up/i });
    expect(moveUpButtons[0]).toBeDisabled();
  });

  it("does not move last fee down", async () => {
    renderComponent();
    const moveDownButtons = screen.getAllByRole("button", {
      name: /move.*down/i,
    });
    expect(moveDownButtons[moveDownButtons.length - 1]).toBeDisabled();
  });

  it("displays fee type correctly", () => {
    renderComponent();
    expect(screen.getAllByText("percentage").length).toBeGreaterThan(0);
    expect(screen.getByText("fixed")).toBeInTheDocument();
  });

  it("toggles visibility checkboxes", async () => {
    renderComponent();
    fireEvent.click(screen.getByRole("button", { name: /add fee/i }));
    const buyerCheckbox = screen.getByRole("checkbox", {
      name: /visible to buyer/i,
    });
    expect(buyerCheckbox).toBeChecked();
    fireEvent.click(buyerCheckbox);
    expect(buyerCheckbox).not.toBeChecked();
    const sellerCheckbox = screen.getByRole("checkbox", {
      name: /visible to seller/i,
    });
    expect(sellerCheckbox).toBeChecked();
    fireEvent.click(sellerCheckbox);
    expect(sellerCheckbox).not.toBeChecked();
  });

  it("creates a fee successfully", async () => {
    mockCreateFee.mockResolvedValue(undefined);
    renderComponent();
    fireEvent.click(screen.getByRole("button", { name: /add fee/i }));
    fireEvent.change(screen.getByPlaceholderText("e.g., Seller Commission"), {
      target: { value: "New Fee" },
    });
    const valueInput = screen.getByRole("spinbutton");
    fireEvent.change(valueInput, { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /create fee/i }));
    await waitFor(() => {
      expect(mockCreateFee).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Fee created successfully");
    });
  });

  it("updates a fee successfully via edit dialog", async () => {
    mockUpdateFee.mockResolvedValue(undefined);
    renderComponent();
    fireEvent.click(
      screen.getByRole("button", { name: /edit fee seller commission/i })
    );
    fireEvent.change(screen.getByDisplayValue("Seller Commission"), {
      target: { value: "Updated Fee" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => {
      expect(mockUpdateFee).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Fee updated successfully");
    });
  });

  it("shows error toast when create fee fails", async () => {
    mockCreateFee.mockRejectedValue(new Error("Network error"));
    renderComponent();
    fireEvent.click(screen.getByRole("button", { name: /add fee/i }));
    fireEvent.change(screen.getByPlaceholderText("e.g., Seller Commission"), {
      target: { value: "New Fee" },
    });
    const valueInput = screen.getByRole("spinbutton");
    fireEvent.change(valueInput, { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /create fee/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Network error");
    });
  });

  it("shows generic error toast when create fee fails with non-Error", async () => {
    mockCreateFee.mockRejectedValue("string error");
    renderComponent();
    fireEvent.click(screen.getByRole("button", { name: /add fee/i }));
    fireEvent.change(screen.getByPlaceholderText("e.g., Seller Commission"), {
      target: { value: "New Fee" },
    });
    const valueInput = screen.getByRole("spinbutton");
    fireEvent.change(valueInput, { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /create fee/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to save fee");
    });
  });

  it("deletes a fee successfully", async () => {
    mockDeleteFee.mockResolvedValue(undefined);
    renderComponent();
    fireEvent.click(
      screen.getByRole("button", { name: /delete fee seller commission/i })
    );
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => {
      expect(mockDeleteFee).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Fee deleted successfully");
    });
  });

  it("shows error toast when delete fails", async () => {
    mockDeleteFee.mockRejectedValue(new Error("Delete failed"));
    renderComponent();
    fireEvent.click(
      screen.getByRole("button", { name: /delete fee seller commission/i })
    );
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Delete failed");
    });
  });

  it("shows generic error toast when delete fails with non-Error", async () => {
    mockDeleteFee.mockRejectedValue("string error");
    renderComponent();
    fireEvent.click(
      screen.getByRole("button", { name: /delete fee seller commission/i })
    );
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to delete fee");
    });
  });

  it("moves a fee up successfully", async () => {
    mockReorderFees.mockResolvedValue(undefined);
    renderComponent();
    const moveUpButtons = screen.getAllByRole("button", { name: /move.*up/i });
    fireEvent.click(moveUpButtons[1]);
    await waitFor(() => {
      expect(mockReorderFees).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith(
        "Fee order updated successfully"
      );
    });
  });

  it("moves a fee down successfully", async () => {
    mockReorderFees.mockResolvedValue(undefined);
    renderComponent();
    const moveDownButtons = screen.getAllByRole("button", {
      name: /move.*down/i,
    });
    fireEvent.click(moveDownButtons[0]);
    await waitFor(() => {
      expect(mockReorderFees).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith(
        "Fee order updated successfully"
      );
    });
  });

  it("shows error toast when reorder fails", async () => {
    mockReorderFees.mockRejectedValue(new Error("Reorder failed"));
    renderComponent();
    const moveDownButtons = screen.getAllByRole("button", {
      name: /move.*down/i,
    });
    fireEvent.click(moveDownButtons[0]);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Reorder failed");
    });
  });

  it("shows generic error toast when reorder fails with non-Error", async () => {
    mockReorderFees.mockRejectedValue("string error");
    renderComponent();
    const moveDownButtons = screen.getAllByRole("button", {
      name: /move.*down/i,
    });
    fireEvent.click(moveDownButtons[0]);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to reorder fees");
    });
  });

  it("shows error for percentage value below 0.01", async () => {
    renderComponent();
    fireEvent.click(screen.getByRole("button", { name: /add fee/i }));
    fireEvent.change(screen.getByPlaceholderText("e.g., Seller Commission"), {
      target: { value: "Test Fee" },
    });
    const valueInput = screen.getByRole("spinbutton");
    fireEvent.change(valueInput, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /create fee/i }));
    expect(toast.error).toHaveBeenCalledWith(
      "Percentage must be between 0.01% and 100%"
    );
  });

  it("shows error for percentage value above 100", async () => {
    renderComponent();
    fireEvent.click(screen.getByRole("button", { name: /add fee/i }));
    fireEvent.change(screen.getByPlaceholderText("e.g., Seller Commission"), {
      target: { value: "Test Fee" },
    });
    const valueInput = screen.getByRole("spinbutton");
    fireEvent.change(valueInput, { target: { value: "101" } });
    fireEvent.click(screen.getByRole("button", { name: /create fee/i }));
    expect(toast.error).toHaveBeenCalledWith(
      "Percentage must be between 0.01% and 100%"
    );
  });

  it("edits a fixed fee without a description", () => {
    vi.mocked(useQuery).mockReturnValue(fixedFeeWithoutDescription);
    renderComponent();

    fireEvent.click(
      screen.getByRole("button", { name: /edit fee storage fee/i })
    );

    expect(screen.getByDisplayValue("Storage Fee")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton")).toHaveValue(250);
    expect(screen.getByText("Amount (R)")).toBeInTheDocument();
  });

  it("shows an error when a fixed fee value is not greater than zero", () => {
    vi.mocked(useQuery).mockReturnValue(fixedFeeWithoutDescription);
    renderComponent();

    fireEvent.click(
      screen.getByRole("button", { name: /edit fee storage fee/i })
    );
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(toast.error).toHaveBeenCalledWith(
      "Fixed fee must be greater than 0"
    );
    expect(mockUpdateFee).not.toHaveBeenCalled();
  });

  it("updates a fixed fee without scaling the value", async () => {
    mockUpdateFee.mockResolvedValue(undefined);
    vi.mocked(useQuery).mockReturnValue(fixedFeeWithoutDescription);
    renderComponent();

    fireEvent.click(
      screen.getByRole("button", { name: /edit fee storage fee/i })
    );
    fireEvent.change(screen.getByDisplayValue("Storage Fee"), {
      target: { value: "Storage Fee v2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateFee).toHaveBeenCalledWith(
        expect.objectContaining({ value: 250, description: undefined })
      );
    });
  });

  it("clears the description when it is emptied", async () => {
    mockUpdateFee.mockResolvedValue(undefined);
    renderComponent();

    fireEvent.click(
      screen.getByRole("button", { name: /edit fee seller commission/i })
    );
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateFee).toHaveBeenCalledWith(
        expect.objectContaining({ description: undefined })
      );
    });
  });

  it("creates a fixed fee with the switched fee type", async () => {
    mockCreateFee.mockResolvedValue(undefined);
    renderComponent();

    fireEvent.click(screen.getByRole("button", { name: /add fee/i }));
    fireEvent.change(screen.getByPlaceholderText("e.g., Seller Commission"), {
      target: { value: "Storage Fee" },
    });
    fireEvent.change(getSelectByOption("Fixed Amount"), {
      target: { value: "fixed" },
    });
    expect(screen.getByText("Amount (R)")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "300" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create fee/i }));

    await waitFor(() => {
      expect(mockCreateFee).toHaveBeenCalledWith(
        expect.objectContaining({ feeType: "fixed", value: 300 })
      );
    });
  });

  it("resets the value to a percentage default when switching back", () => {
    renderComponent();

    fireEvent.click(screen.getByRole("button", { name: /add fee/i }));
    const feeTypeSelect = getSelectByOption("Fixed Amount");
    fireEvent.change(feeTypeSelect, { target: { value: "fixed" } });
    expect(screen.getByRole("spinbutton")).toHaveValue(500);

    fireEvent.change(feeTypeSelect, { target: { value: "percentage" } });
    expect(screen.getByRole("spinbutton")).toHaveValue(5);
  });

  it("changes who a fee applies to", async () => {
    mockCreateFee.mockResolvedValue(undefined);
    renderComponent();

    fireEvent.click(screen.getByRole("button", { name: /add fee/i }));
    fireEvent.change(screen.getByPlaceholderText("e.g., Seller Commission"), {
      target: { value: "Buyer Fee" },
    });
    fireEvent.change(getSelectByOption("Both"), { target: { value: "both" } });
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create fee/i }));

    await waitFor(() => {
      expect(mockCreateFee).toHaveBeenCalledWith(
        expect.objectContaining({ appliesTo: "both" })
      );
    });
  });

  it("shows a generic error toast when moving a fee up fails with a non-Error", async () => {
    mockReorderFees.mockRejectedValue("string error");
    renderComponent();

    const moveUpButtons = screen.getAllByRole("button", { name: /move.*up/i });
    fireEvent.click(moveUpButtons[1]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to reorder fees");
    });
  });

  it("shows the error message when moving a fee up fails with an Error", async () => {
    mockReorderFees.mockRejectedValue(new Error("Reorder up failed"));
    renderComponent();

    const moveUpButtons = screen.getAllByRole("button", { name: /move.*up/i });
    fireEvent.click(moveUpButtons[1]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Reorder up failed");
    });
  });
});
