import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Settings } from "lucide-react";

import { SettingsCard } from "./SettingsCard";

describe("SettingsCard", () => {
  const defaultProps = {
    title: "Account Settings",
    description: "Manage your account preferences",
    icon: <Settings data-testid="icon" />,
    action: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with required props", () => {
    render(<SettingsCard {...defaultProps} />);

    expect(screen.getByText("Account Settings")).toBeInTheDocument();
    expect(
      screen.getByText("Manage your account preferences")
    ).toBeInTheDocument();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("renders with correct aria-label", () => {
    render(<SettingsCard {...defaultProps} />);

    const card = screen.getByRole("button");
    expect(card).toHaveAttribute(
      "aria-label",
      "Account Settings: Manage your account preferences"
    );
  });

  it("calls action on click", () => {
    render(<SettingsCard {...defaultProps} />);

    fireEvent.click(screen.getByRole("button"));
    expect(defaultProps.action).toHaveBeenCalledTimes(1);
  });

  it("calls action on Enter key press", () => {
    render(<SettingsCard {...defaultProps} />);

    const card = screen.getByRole("button");
    fireEvent.keyDown(card, { key: "Enter" });
    expect(defaultProps.action).toHaveBeenCalledTimes(1);
  });

  it("calls action on Space key press", () => {
    render(<SettingsCard {...defaultProps} />);

    const card = screen.getByRole("button");
    fireEvent.keyDown(card, { key: " " });
    expect(defaultProps.action).toHaveBeenCalledTimes(1);
  });

  it("does not call action on other key press", () => {
    render(<SettingsCard {...defaultProps} />);

    const card = screen.getByRole("button");
    fireEvent.keyDown(card, { key: "Escape" });
    expect(defaultProps.action).not.toHaveBeenCalled();
  });

  it("handles arrow key without calling action", () => {
    render(<SettingsCard {...defaultProps} />);

    const card = screen.getByRole("button");
    fireEvent.keyDown(card, { key: "ArrowDown" });
    expect(defaultProps.action).not.toHaveBeenCalled();
  });

  it("is focusable with tabIndex", () => {
    render(<SettingsCard {...defaultProps} />);

    const card = screen.getByRole("button");
    expect(card).toHaveAttribute("tabIndex", "0");
  });

  it("renders icon in container", () => {
    render(<SettingsCard {...defaultProps} />);

    const iconContainer = screen.getByTestId("icon").parentElement;
    expect(iconContainer).toHaveClass("h-12", "w-12", "rounded-2xl");
  });

  it("renders with long title", () => {
    render(
      <SettingsCard
        {...defaultProps}
        title="Very Long Settings Title That Might Wrap"
      />
    );

    expect(
      screen.getByText("Very Long Settings Title That Might Wrap")
    ).toBeInTheDocument();
  });

  it("renders with long description", () => {
    render(
      <SettingsCard
        {...defaultProps}
        description="This is a very long description that explains what this settings card does when clicked or activated"
      />
    );

    expect(
      screen.getByText(
        "This is a very long description that explains what this settings card does when clicked or activated"
      )
    ).toBeInTheDocument();
  });

  it("renders with different icon", () => {
    render(
      <SettingsCard
        {...defaultProps}
        icon={<span data-testid="custom-icon">Icon</span>}
      />
    );

    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });
});
