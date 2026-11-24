import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { UploadSlot } from "./UploadSlot";

function inputs(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLInputElement>("input[type='file']")
  );
}

describe("UploadSlot", () => {
  it("empty: shows the label and both buttons with the right inputs", () => {
    const { container } = render(
      <UploadSlot label="ID back" onFile={vi.fn()} />
    );
    expect(screen.getByText("ID back")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Take photo/ })).toHaveClass(
      "bg-btn"
    );
    expect(screen.getByRole("button", { name: /Choose file/ })).toHaveClass(
      "border"
    );
    const [camera, choose] = inputs(container);
    expect(camera).toHaveAttribute("accept", "image/*");
    expect(camera).toHaveAttribute("capture", "environment");
    expect(choose).toHaveAttribute("accept", "image/*,application/pdf");
    expect(container.querySelector("[data-slot='upload-slot']")).toHaveClass(
      "border-dashed",
      "rounded-md"
    );
  });

  it("opens the matching hidden input from each button", () => {
    const { container } = render(
      <UploadSlot label="ID back" onFile={vi.fn()} />
    );
    const [camera, choose] = inputs(container);
    const cameraClick = vi.spyOn(camera, "click");
    const chooseClick = vi.spyOn(choose, "click");
    fireEvent.click(screen.getByRole("button", { name: /Take photo/ }));
    expect(cameraClick).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /Choose file/ }));
    expect(chooseClick).toHaveBeenCalledTimes(1);
  });

  it("calls onFile with the chosen file and resets the input", () => {
    const onFile = vi.fn();
    const { container } = render(
      <UploadSlot label="ID back" onFile={onFile} />
    );
    const [, choose] = inputs(container);
    const file = new File(["x"], "id-back.jpg", { type: "image/jpeg" });
    fireEvent.change(choose, { target: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
    fireEvent.change(choose, { target: { files: [] } });
    expect(onFile).toHaveBeenCalledTimes(1);
  });

  it("filled: shows the preview, name, size and Replace", () => {
    const { container } = render(
      <UploadSlot
        label="ID front"
        onFile={vi.fn()}
        file={{
          name: "id-front.jpg",
          size: 1_258_291,
          previewUrl: "blob:abc",
        }}
      />
    );
    expect(screen.getByText(/id-front\.jpg/)).toHaveTextContent(
      "id-front.jpg · 1.2 MB"
    );
    expect(container.querySelector("img")).toHaveAttribute("src", "blob:abc");
    expect(
      screen.queryByRole("button", { name: /Take photo/ })
    ).not.toBeInTheDocument();
    const [, choose] = inputs(container);
    const click = vi.spyOn(choose, "click");
    fireEvent.click(screen.getByRole("button", { name: /Replace/ }));
    expect(click).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector("[data-slot='upload-slot']")
    ).not.toHaveClass("border-dashed");
  });

  it("filled without a preview shows a file icon", () => {
    const { container } = render(
      <UploadSlot
        label="Proof of address"
        onFile={vi.fn()}
        file={{ name: "bill.pdf", size: 204_800 }}
      />
    );
    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByText(/bill\.pdf/)).toHaveTextContent(
      "bill.pdf · 200.0 KB"
    );
    expect(
      container.querySelector("[data-slot='upload-thumb'] svg")
    ).toHaveAttribute("aria-hidden", "true");
  });

  it("uploading disables the buttons and marks the slot busy", () => {
    const { container } = render(
      <UploadSlot label="ID back" onFile={vi.fn()} uploading />
    );
    expect(
      container.querySelector("[data-slot='upload-slot']")
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: /Take photo/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Choose file/ })).toBeDisabled();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("uploading a filled slot disables Replace", () => {
    render(
      <UploadSlot
        label="ID front"
        onFile={vi.fn()}
        uploading
        file={{ name: "a.jpg", size: 1000 }}
      />
    );
    expect(screen.getByRole("button", { name: /Replace/ })).toBeDisabled();
  });

  it("shows an error alert under the box", () => {
    render(
      <UploadSlot label="ID back" onFile={vi.fn()} error="File is too large" />
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("File is too large");
    expect(alert).toHaveClass("text-destructive");
  });

  it("names each button after its slot and announces uploading", () => {
    render(
      <UploadSlot label="ID back" onFile={vi.fn()} uploading error="Bad" />
    );
    expect(
      screen.getByRole("button", { name: "Take photo, ID back" })
    ).toHaveAccessibleDescription("Bad");
    expect(
      screen.getByRole("button", { name: "Choose file, ID back" })
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Uploading ID back");
  });

  it("keeps the hidden inputs out of the tab order and resets them", () => {
    const onFile = vi.fn();
    const { container } = render(
      <UploadSlot label="ID back" onFile={onFile} />
    );
    const [camera, choose] = inputs(container);
    for (const input of [camera, choose]) {
      expect(input).toHaveAttribute("aria-hidden", "true");
      expect(input).toHaveAttribute("tabindex", "-1");
    }
    const file = new File(["x"], "p.jpg", { type: "image/jpeg" });
    fireEvent.change(camera, { target: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
    expect(camera.value).toBe("");
  });
});
