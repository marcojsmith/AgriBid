import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarkdownContent } from "./MarkdownContent";

describe("MarkdownContent", () => {
  it("renders headings, paragraphs, lists and emphasis", () => {
    const { container } = render(
      <MarkdownContent
        markdown={
          "## Heading two\n\nA **bold** paragraph.\n\n- one\n- two\n\n1. first\n\n> note\n\n---\n\n| a | b |\n|---|---|\n| 1 | 2 |"
        }
      />
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Heading two" })
    ).toBeInTheDocument();
    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(container.querySelector("blockquote")).not.toBeNull();
    expect(container.querySelector("hr")).not.toBeNull();
  });

  it("never renders an h1 (the page title is the only h1)", () => {
    render(<MarkdownContent markdown={"# Big\n\n##### five\n\n###### six"} />);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.getByRole("heading", { name: "Big" })).toBeInTheDocument();
  });

  it("does not render <script> or raw HTML elements", () => {
    const { container } = render(
      <MarkdownContent
        markdown={
          'Before\n\n<script>window.__pwned = true</script>\n\n<div id="raw" onclick="x()">raw div</div>\n\n<iframe src="https://evil.example"></iframe>\n\n<img src="x" onerror="window.__pwned=true">\n\nAfter'
        }
      />
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("#raw")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[onclick],[onerror]")).toBeNull();
    expect(
      (window as unknown as { __pwned?: boolean }).__pwned
    ).toBeUndefined();
    expect(screen.getByText("Before")).toBeInTheDocument();
    expect(screen.getByText("After")).toBeInTheDocument();
  });

  it("does not render markdown images", () => {
    const { container } = render(
      <MarkdownContent markdown={"![alt text](https://example.com/a.png)"} />
    );
    expect(container.querySelector("img")).toBeNull();
  });

  it("neutralises javascript: and other unsafe link protocols", () => {
    const { container } = render(
      <MarkdownContent
        markdown={
          "[js](javascript:alert(1)) [vb](vbscript:x) [data](data:text/html;base64,AAAA) [JS](JaVaScRiPt:alert(1))"
        }
      />
    );
    for (const a of Array.from(container.querySelectorAll("a"))) {
      const href = a.getAttribute("href") ?? "";
      expect(href).not.toMatch(/^\s*(javascript|vbscript|data):/i);
    }
    expect(container.innerHTML).not.toMatch(/href="\s*javascript:/i);
  });

  it("keeps safe links and opens external ones in a new tab safely", () => {
    render(
      <MarkdownContent
        markdown={
          "[ext](https://example.com/x) [mail](mailto:a@b.co) [rel](/faq)"
        }
      />
    );
    const ext = screen.getByRole("link", { name: "ext" });
    expect(ext).toHaveAttribute("href", "https://example.com/x");
    expect(ext).toHaveAttribute("target", "_blank");
    expect(ext).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: "mail" })).toHaveAttribute(
      "href",
      "mailto:a@b.co"
    );
    const internal = screen.getByRole("link", { name: "rel" });
    expect(internal).toHaveAttribute("href", "/faq");
    expect(internal).not.toHaveAttribute("target");
  });

  it("renders inline and block code", () => {
    const { container } = render(
      <MarkdownContent markdown={"Use `x` here.\n\n```\nblock\n```"} />
    );
    expect(container.querySelector("pre")).not.toBeNull();
    expect(container.querySelectorAll("code").length).toBe(2);
  });

  it("applies the 70ch measure and extra classes", () => {
    const { container } = render(
      <MarkdownContent markdown="x" className="mt-8" />
    );
    expect(container.firstElementChild).toHaveClass("max-w-[70ch]", "mt-8");
  });
});
