import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("renders a native button by default", () => {
    render(<Button>Place bid</Button>);

    const button = screen.getByRole("button", { name: "Place bid" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("data-slot", "button");
  });

  it("applies default variant and size data attributes", () => {
    render(<Button>Save</Button>);

    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("data-variant", "default");
    expect(button).toHaveAttribute("data-size", "default");
  });

  it("applies the requested variant and size classes", () => {
    render(
      <Button variant="destructive" size="sm">
        Delete
      </Button>
    );

    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toHaveAttribute("data-variant", "destructive");
    expect(button).toHaveAttribute("data-size", "sm");
    expect(button).toHaveClass("bg-destructive");
    expect(button).toHaveClass("text-white");
  });

  it("merges a caller-supplied className", () => {
    render(<Button className="custom-class">Merge</Button>);

    expect(screen.getByRole("button", { name: "Merge" })).toHaveClass(
      "custom-class"
    );
  });

  it("forwards the ref to the native button element", () => {
    let buttonElement: HTMLButtonElement | null = null;
    render(
      <Button
        ref={(node) => {
          buttonElement = node;
        }}
      >
        Focus me
      </Button>
    );

    expect(buttonElement).toBe(
      screen.getByRole("button", { name: "Focus me" })
    );
  });

  it("renders the child element instead of a button when asChild is set", () => {
    render(
      <Button asChild>
        <a href="/auctions">Browse</a>
      </Button>
    );

    const link = screen.getByRole("link", { name: "Browse" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/auctions");
    expect(link).toHaveAttribute("data-slot", "button");
    expect(link).toHaveClass("inline-flex");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("does not set a button type when asChild is set", () => {
    render(
      <Button asChild>
        <a href="/auctions">Browse</a>
      </Button>
    );

    expect(screen.getByRole("link", { name: "Browse" })).not.toHaveAttribute(
      "type"
    );
  });
});
