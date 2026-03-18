import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";

import KYC from "./KYC";

// Mock Convex hooks
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

// Mock Convex API
const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    users: {
      getMyProfile: { _path: "users:getMyProfile" },
      getMyKYCDetails: { _path: "users:getMyKYCDetails" },
      submitKYC: { _path: "users:submitKYC" },
    },
  },
}));

vi.mock("convex/_generated/api", () => ({
  api: mockApi,
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock child components to simplify
interface VerificationStatusSectionProps {
  status: string;
  onEdit?: () => void;
}

interface PersonalInfoSectionProps {
  formData: {
    firstName: string;
  };
  updateField: (field: string, value: string) => void;
}

vi.mock("./kyc/sections/VerificationStatusSection", () => ({
  VerificationStatusSection: ({
    status,
    onEdit,
  }: VerificationStatusSectionProps) => (
    <div data-testid="verification-status">
      Status: {status}
      <button onClick={onEdit}>Edit</button>
    </div>
  ),
}));

vi.mock("./kyc/sections/PersonalInfoSection", () => ({
  PersonalInfoSection: ({
    formData,
    updateField,
  }: PersonalInfoSectionProps) => (
    <div data-testid="personal-info">
      <input
        aria-label="First Name"
        value={formData.firstName}
        onChange={(e) => updateField("firstName", e.target.value)}
      />
    </div>
  ),
}));

vi.mock("./kyc/sections/DocumentUploadSection", () => ({
  DocumentUploadSection: ({
    onFileChange,
    onDeleteDocument,
    existingDocuments,
  }: {
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onDeleteDocument: (doc: string) => void;
    existingDocuments: string[];
  }) => (
    <div data-testid="document-upload">
      <input type="file" aria-label="Upload Document" onChange={onFileChange} />
      {existingDocuments.map((doc: string) => (
        <button key={doc} onClick={() => onDeleteDocument(doc)}>
          Delete {doc}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@/components/LoadingIndicator", () => ({
  LoadingIndicator: () => (
    <div data-testid="loading-indicator" role="status">
      Loading...
    </div>
  ),
  LoadingPage: () => <div role="status">Loading Page...</div>,
}));

// Mock hooks
const { mockKYCForm, mockFileUpload } = vi.hoisted(() => ({
  mockKYCForm: {
    formData: {
      firstName: "John",
      lastName: "Doe",
      phoneNumber: "123",
      idNumber: "456",
      email: "john@example.com",
    },
    updateField: vi.fn(),
    validate: vi.fn(() => ({ valid: true, message: "" })),
    setIsFormInitialized: vi.fn(),
  },
  mockFileUpload: {
    isUploading: false,
    files: [] as File[],
    existingDocuments: ["doc1"],
    setExistingDocuments: vi.fn(),
    handleFileChange: vi.fn(),
    executeDeleteDocument: vi.fn(),
    uploadFiles: vi.fn(),
    cleanupUploads: vi.fn(),
  },
}));

vi.mock("./kyc/hooks/useKYCForm", () => ({
  useKYCForm: () => mockKYCForm,
}));

vi.mock("./kyc/hooks/useKYCFileUpload", () => ({
  useKYCFileUpload: () => mockFileUpload,
}));

describe("KYC Page Full Coverage", () => {
  const mockProfile = {
    userId: "user1",
    profile: {
      kycStatus: "none",
      kycRejectionReason: null,
    },
  };

  const mockKycDetails = {
    firstName: "John",
    lastName: "Doe",
    phoneNumber: "123",
    idNumber: "456",
    kycEmail: "john@example.com",
    kycDocumentIds: ["doc1"],
  };

  const mockSubmitKYC = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mockFileUpload state
    mockFileUpload.files = [];
    mockFileUpload.existingDocuments = ["doc1"];
    mockFileUpload.isUploading = false;
    mockFileUpload.uploadFiles.mockReset();
    mockFileUpload.cleanupUploads.mockReset();
    mockFileUpload.executeDeleteDocument.mockReset();

    // Reset mockKYCForm state
    mockKYCForm.validate.mockReturnValue({ valid: true, message: "" });

    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return mockProfile;
      if (apiPath === mockApi.users.getMyKYCDetails) return mockKycDetails;
      return null;
    });
    (useMutation as Mock).mockReturnValue(mockSubmitKYC);
  });

  const renderKYC = () => {
    return render(
      <BrowserRouter>
        <KYC />
      </BrowserRouter>
    );
  };

  it("renders loading state", () => {
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return undefined;
      return null;
    });
    renderKYC();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders status section when verified", () => {
    const verifiedProfile = {
      ...mockProfile,
      profile: { kycStatus: "verified" },
    };
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return verifiedProfile;
      if (apiPath === mockApi.users.getMyKYCDetails) return mockKycDetails;
      return null;
    });

    renderKYC();
    expect(screen.getByTestId("verification-status")).toBeInTheDocument();
    expect(screen.getByText(/Status: verified/i)).toBeInTheDocument();
  });

  it("handles form submission successfully", async () => {
    mockFileUpload.files = [new File([""], "test.jpg")];
    mockFileUpload.uploadFiles.mockResolvedValue(["new-doc-id"]);
    mockSubmitKYC.mockResolvedValue({});

    renderKYC();

    const submitBtn = screen.getByRole("button", {
      name: /submit application/i,
    });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(mockFileUpload.uploadFiles).toHaveBeenCalled();
      expect(mockSubmitKYC).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith(
        "KYC Documents submitted for review"
      );
    });
  });

  it("disables submit button when no documents are selected", async () => {
    mockFileUpload.files = [];
    mockFileUpload.existingDocuments = [];
    renderKYC();

    const submitBtn = screen.getByRole("button", {
      name: /submit application/i,
    });
    expect(submitBtn).toBeDisabled();
  });

  it("handles click on submit when no documents are selected (bypassing disabled)", async () => {
    mockFileUpload.files = [];
    mockFileUpload.existingDocuments = ["existing_doc"];
    mockKYCForm.validate.mockReturnValue({
      valid: false,
      message: "Validation failed",
    });
    renderKYC();

    const submitBtn = screen.getByRole("button", {
      name: /submit application/i,
    });

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Validation failed");
    });
  });

  it("handles validation error", async () => {
    mockKYCForm.validate.mockReturnValue({
      valid: false,
      message: "Invalid form",
    });

    renderKYC();

    const submitBtn = screen.getByRole("button", {
      name: /submit application/i,
    });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Invalid form");
      expect(mockFileUpload.uploadFiles).not.toHaveBeenCalled();
    });
  });

  it("switches to edit mode from verified status and exits", async () => {
    const verifiedProfile = {
      ...mockProfile,
      profile: { kycStatus: "verified" },
    };
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return verifiedProfile;
      if (apiPath === mockApi.users.getMyKYCDetails) return mockKycDetails;
      return null;
    });

    renderKYC();

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByText(/Editing Verified Details/i)).toBeInTheDocument();

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);
    expect(
      screen.queryByText(/Editing Verified Details/i)
    ).not.toBeInTheDocument();
  });

  it("shows confirmation modal when submitting in edit mode", async () => {
    const verifiedProfile = {
      ...mockProfile,
      profile: { kycStatus: "verified" },
    };
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return verifiedProfile;
      if (apiPath === mockApi.users.getMyKYCDetails) return mockKycDetails;
      return null;
    });

    renderKYC();
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    const submitBtn = screen.getByRole("button", {
      name: /submit application/i,
    });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/Update Verified Details\?/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: /confirm update/i });
    mockFileUpload.uploadFiles.mockResolvedValue(["new-id"]);
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(mockSubmitKYC).toHaveBeenCalled();
  });

  it("cleans up uploads if submission fails", async () => {
    mockFileUpload.files = [new File([""], "test.jpg")];
    mockFileUpload.uploadFiles.mockResolvedValue(["storage-id-1"]);
    mockSubmitKYC.mockRejectedValue(new Error("Submit failed"));

    renderKYC();
    const submitBtn = screen.getByRole("button", {
      name: /submit application/i,
    });

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(mockFileUpload.cleanupUploads).toHaveBeenCalledWith([
        "storage-id-1",
      ]);
      expect(toast.error).toHaveBeenCalledWith("Submit failed");
    });
  });

  it("handles document deletion and cancellation", async () => {
    mockFileUpload.executeDeleteDocument.mockResolvedValue(true);
    renderKYC();

    // Trigger delete dialog
    fireEvent.click(screen.getByText("Delete doc1"));
    expect(screen.getByText(/Delete Document\?/i)).toBeInTheDocument();

    // Test Cancel
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByText(/Delete Document\?/i)).not.toBeInTheDocument();
    expect(mockFileUpload.executeDeleteDocument).not.toHaveBeenCalled();

    // Trigger again and Confirm
    fireEvent.click(screen.getByText("Delete doc1"));
    const confirmBtn = screen.getByRole("button", {
      name: /delete permanently/i,
    });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(mockFileUpload.executeDeleteDocument).toHaveBeenCalledWith("doc1");
  });

  it("handles delete document failure", async () => {
    mockFileUpload.executeDeleteDocument.mockRejectedValue(
      new Error("Delete failed")
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    renderKYC();
    fireEvent.click(screen.getByText("Delete doc1"));

    const confirmBtn = screen.getByRole("button", {
      name: /delete permanently/i,
    });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(spy).toHaveBeenCalledWith(
      "Delete document failed:",
      expect.any(Error)
    );
    spy.mockRestore();
  });

  it("renders rejection reason when status is rejected", () => {
    const rejectedProfile = {
      ...mockProfile,
      profile: { kycStatus: "rejected", kycRejectionReason: "Invalid ID" },
    };
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return rejectedProfile;
      return null;
    });

    renderKYC();
    expect(screen.getByText(/Application Rejected/i)).toBeInTheDocument();
    expect(screen.getByText("Invalid ID")).toBeInTheDocument();
  });

  it("handles upload failure where no storageIds are returned", async () => {
    mockFileUpload.files = [new File([""], "test.jpg")];
    mockFileUpload.uploadFiles.mockResolvedValue(null);

    renderKYC();

    const submitBtn = screen.getByRole("button", {
      name: /submit application/i,
    });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(mockFileUpload.uploadFiles).toHaveBeenCalled();
    expect(mockSubmitKYC).not.toHaveBeenCalled();
  });

  it("handles non-Error submission failure and cleans up", async () => {
    mockFileUpload.files = [new File([""], "test.jpg")];
    mockFileUpload.uploadFiles.mockResolvedValue(["storage-id-fail"]);
    mockSubmitKYC.mockRejectedValue("String error");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    renderKYC();
    const submitBtn = screen.getByRole("button", {
      name: /submit application/i,
    });

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(mockFileUpload.cleanupUploads).toHaveBeenCalledWith([
        "storage-id-fail",
      ]);
      expect(toast.error).toHaveBeenCalledWith("Submission failed");
    });
    spy.mockRestore();
  });

  it("resets form initialization when leaving edit mode explicitly", async () => {
    const verifiedProfile = {
      ...mockProfile,
      profile: { kycStatus: "verified" },
    };
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return verifiedProfile;
      if (apiPath === mockApi.users.getMyKYCDetails) return mockKycDetails;
      return null;
    });

    const { rerender } = render(
      <BrowserRouter>
        <KYC />
      </BrowserRouter>
    );

    // Initial call on mount
    expect(mockKYCForm.setIsFormInitialized).toHaveBeenCalledWith(false);
    mockKYCForm.setIsFormInitialized.mockClear();

    // Enter edit mode
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    // Rerender to ensure it works
    rerender(
      <BrowserRouter>
        <KYC />
      </BrowserRouter>
    );

    // Exit edit mode
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(mockKYCForm.setIsFormInitialized).toHaveBeenCalledWith(false);
    });
  });

  it("handles submission failure with no storageIds to cleanup", async () => {
    mockFileUpload.files = [];
    mockFileUpload.existingDocuments = ["doc1"];
    mockFileUpload.uploadFiles.mockResolvedValue(null);
    mockSubmitKYC.mockRejectedValue(new Error("Submit failed"));

    renderKYC();
    const submitBtn = screen.getByRole("button", {
      name: /submit application/i,
    });

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Submit failed");
      expect(mockFileUpload.cleanupUploads).not.toHaveBeenCalled();
    });
  });

  it("triggers file change handler", () => {
    renderKYC();
    const input = screen.getByLabelText(/Upload Document/i);
    fireEvent.change(input, {
      target: { files: [new File([""], "test.jpg")] },
    });
    expect(mockFileUpload.handleFileChange).toHaveBeenCalled();
  });

  it("handles uploadFiles returning null without files (existing docs only)", async () => {
    mockFileUpload.files = [];
    mockFileUpload.existingDocuments = ["doc1"];
    mockFileUpload.uploadFiles.mockResolvedValue(null);
    mockSubmitKYC.mockResolvedValue({});

    renderKYC();
    const submitBtn = screen.getByRole("button", {
      name: /submit application/i,
    });

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // Should NOT return, should proceed to submission because files.length is 0
    expect(mockSubmitKYC).toHaveBeenCalled();
  });

  it("disables button when isUploading is true", () => {
    mockFileUpload.isUploading = true;
    mockFileUpload.files = [new File([""], "test.jpg")];
    renderKYC();
    const submitBtn = screen.getByRole("button", {
      name: /submit application/i,
    });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByTestId("loading-indicator")).toBeInTheDocument();
  });

  it("hits skipConfirm branch in handleUpload", async () => {
    const verifiedProfile = {
      userId: "user1",
      profile: { kycStatus: "verified", kycRejectionReason: null },
    };
    const verifiedKycDetails = {
      firstName: "John",
      lastName: "Doe",
      phoneNumber: "123",
      idNumber: "456",
      kycEmail: "john@example.com",
      kycDocumentIds: ["existing_doc_1"],
    };

    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return verifiedProfile;
      if (apiPath === mockApi.users.getMyKYCDetails) return verifiedKycDetails;
      return null;
    });
    mockFileUpload.files = [new File([""], "test.jpg")];
    mockFileUpload.uploadFiles.mockResolvedValue(["storage1"]);
    mockSubmitKYC.mockResolvedValue({});

    renderKYC();

    await waitFor(() => {
      expect(screen.getByTestId("verification-status")).toBeInTheDocument();
    });

    const editBtn = screen.getByRole("button", { name: /edit/i });
    await act(async () => {
      fireEvent.click(editBtn);
    });

    const submitBtn = screen.getByRole("button", {
      name: /submit application/i,
    });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    const confirmBtn = await screen.findByRole("button", {
      name: /confirm update/i,
    });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(mockSubmitKYC).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith(
        "KYC Documents submitted for review"
      );
    });
  });
});
