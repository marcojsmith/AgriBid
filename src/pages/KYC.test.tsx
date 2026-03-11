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
    auctions: {
      generateUploadUrl: { name: "auctions:generateUploadUrl" },
      deleteUpload: { name: "auctions:deleteUpload" },
    },
    users: {
      getMyProfile: { name: "users:getMyProfile" },
    },
    admin: {
      kyc: {
        getMyKYCDetails: { name: "admin/kyc:getMyKYCDetails" },
        submitKYC: { name: "admin/kyc:submitKYC" },
      },
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

// Mock hooks
const mockUpdateField = vi.fn();
const mockValidate = vi.fn(() => ({ valid: true, message: "" }));
const mockSetIsFormInitialized = vi.fn();

vi.mock("./kyc/hooks/useKYCForm", () => ({
  useKYCForm: () => ({
    formData: {
      firstName: "John",
      lastName: "Doe",
      phoneNumber: "123",
      idNumber: "456",
      email: "john@example.com",
    },
    updateField: mockUpdateField,
    validate: mockValidate,
    setIsFormInitialized: mockSetIsFormInitialized,
  }),
}));

const mockHandleFileChange = vi.fn();
const mockExecuteDeleteDocument = vi.fn();
const mockUploadFiles = vi.fn();
const mockCleanupUploads = vi.fn();

vi.mock("./kyc/hooks/useKYCFileUpload", () => ({
  useKYCFileUpload: () => ({
    isUploading: false,
    files: [],
    existingDocuments: ["doc1"],
    setExistingDocuments: vi.fn(),
    handleFileChange: mockHandleFileChange,
    executeDeleteDocument: mockExecuteDeleteDocument,
    uploadFiles: mockUploadFiles,
    cleanupUploads: mockCleanupUploads,
  }),
}));

describe("KYC Page", () => {
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
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return mockProfile;
      if (apiPath === mockApi.admin.kyc.getMyKYCDetails) return mockKycDetails;
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
      if (apiPath === mockApi.users.getMyProfile) return undefined; // undefined for loading
      return null;
    });
    renderKYC();
    // Use role status or text for loading indicator
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders status section when verified", () => {
    const verifiedProfile = {
      ...mockProfile,
      profile: { kycStatus: "verified" },
    };
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return verifiedProfile;
      if (apiPath === mockApi.admin.kyc.getMyKYCDetails) return mockKycDetails;
      return null;
    });

    renderKYC();
    expect(screen.getByTestId("verification-status")).toBeInTheDocument();
    expect(screen.getByText(/Status: verified/i)).toBeInTheDocument();
  });

  it("renders form when status is none", () => {
    renderKYC();
    expect(screen.getByTestId("personal-info")).toBeInTheDocument();
    expect(screen.getByTestId("document-upload")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit application/i })
    ).toBeInTheDocument();
  });

  it("handles form submission successfully", async () => {
    mockUploadFiles.mockResolvedValue(["new-doc-id"]);
    mockSubmitKYC.mockResolvedValue({});

    renderKYC();

    const submitBtn = screen.getByRole("button", {
      name: /submit application/i,
    });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(mockUploadFiles).toHaveBeenCalled();
      expect(mockSubmitKYC).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith(
        "KYC Documents submitted for review"
      );
    });
  });

  it("handles validation error", async () => {
    mockValidate.mockReturnValueOnce({ valid: false, message: "Invalid form" });

    renderKYC();

    const submitBtn = screen.getByRole("button", {
      name: /submit application/i,
    });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Invalid form");
      expect(mockUploadFiles).not.toHaveBeenCalled();
    });
  });

  it("handles document deletion", async () => {
    mockExecuteDeleteDocument.mockResolvedValue(true);
    renderKYC();

    const deleteBtn = screen.getByText("Delete doc1");
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    const confirmBtn = screen.getByRole("button", {
      name: /delete permanently/i,
    });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(mockExecuteDeleteDocument).toHaveBeenCalledWith("doc1");
    });
  });

  it("switches to edit mode from verified status", async () => {
    const verifiedProfile = {
      ...mockProfile,
      profile: { kycStatus: "verified" },
    };
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.users.getMyProfile) return verifiedProfile;
      if (apiPath === mockApi.admin.kyc.getMyKYCDetails) return mockKycDetails;
      return null;
    });

    renderKYC();

    const editBtn = screen.getByRole("button", { name: /edit/i });
    await act(async () => {
      fireEvent.click(editBtn);
    });

    expect(screen.getByText(/Editing Verified Details/i)).toBeInTheDocument();
    expect(screen.getByTestId("personal-info")).toBeInTheDocument();
  });
});
