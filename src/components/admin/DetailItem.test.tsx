import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { User } from "lucide-react";

import { DetailItem } from "./DetailItem";

describe("DetailItem", () => {
  it("renders label correctly", () => {
    render(
      <DetailItem
        label="Location"
        value="Johannesburg"
        icon={<User data-testid="icon" />}
      />
    );
    expect(screen.getByText("Location")).toBeInTheDocument();
  });

  it("renders value correctly", () => {
    render(<DetailItem label="Name" value="John Doe" icon={<User />} />);
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("renders icon", () => {
    render(
      <DetailItem
        label="Test"
        value="Value"
        icon={<User data-testid="icon" />}
      />
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("displays 'Not Provided' when value is null", () => {
    render(<DetailItem label="Email" value={null} icon={<User />} />);
    expect(screen.getByText("Not Provided")).toBeInTheDocument();
  });

  it("displays 'Not Provided' when value is undefined", () => {
    render(<DetailItem label="Phone" value={undefined} icon={<User />} />);
    expect(screen.getByText("Not Provided")).toBeInTheDocument();
  });

  it("displays 'Not Provided' when value is an empty string", () => {
    render(<DetailItem label="Address" value="" icon={<User />} />);
    expect(screen.getByText("Not Provided")).toBeInTheDocument();
  });

  it("renders with string value", () => {
    render(<DetailItem label="City" value="Cape Town" icon={<User />} />);
    expect(screen.getByText("Cape Town")).toBeInTheDocument();
  });
});
