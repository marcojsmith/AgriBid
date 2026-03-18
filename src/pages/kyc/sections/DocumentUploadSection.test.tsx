import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { DocumentUploadSection } from "./DocumentUploadSection";

describe("DocumentUploadSection", () => {
  const mockOnFileChange = vi.fn();
  const mockOnDeleteDocument = vi.fn();

  const defaultProps = {
    files: [],
    existingDocuments: [],
    isEditMode: false,
    onFileChange: mockOnFileChange,
    onDeleteDocument: mockOnDeleteDocument,
  };

  it("renders upload section", () => {
    render(<DocumentUploadSection {...defaultProps} />);
    expect(screen.getByText("Supporting Documents")).toBeInTheDocument();
    expect(screen.getByText(/drop id images/i)).toBeInTheDocument();
  });

  it("renders existing documents as badges", () => {
    render(
      <DocumentUploadSection
        {...defaultProps}
        existingDocuments={["doc1", "doc2"]}
      />
    );
    expect(screen.getAllByText(/existing doc/i).length).toBe(2);
  });

  it("renders newly selected files", () => {
    const files: File[] = [
      new File(["test"], "test1.jpg", { type: "image/jpeg" }),
      new File(["test"], "test2.jpg", { type: "image/jpeg" }),
    ];
    render(<DocumentUploadSection {...defaultProps} files={files} />);
    expect(screen.getByText("test1.jpg")).toBeInTheDocument();
    expect(screen.getByText("test2.jpg")).toBeInTheDocument();
  });

  it("calls onFileChange when file input changes", () => {
    render(<DocumentUploadSection {...defaultProps} />);
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });
    expect(mockOnFileChange).toHaveBeenCalled();
  });

  it("shows delete button in edit mode", () => {
    render(
      <DocumentUploadSection
        {...defaultProps}
        existingDocuments={["doc1"]}
        isEditMode={true}
      />
    );
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("calls onDeleteDocument when delete is clicked", () => {
    render(
      <DocumentUploadSection
        {...defaultProps}
        existingDocuments={["doc1"]}
        isEditMode={true}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(mockOnDeleteDocument).toHaveBeenCalledWith("doc1");
  });
});
