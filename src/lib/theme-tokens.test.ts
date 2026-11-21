import fs from "node:fs";
import path from "node:path";

import { contrastRatio, readHslTokens, type Hsl } from "./color-contrast";

const PALETTE_CLASS_REGEX =
  /\b(bg|text|border|ring|from|to|via|fill|stroke)-(gray|slate|zinc|neutral|stone|red|green|blue|yellow|amber|orange|emerald|teal|sky|indigo|purple|pink|rose)-[0-9]{2,3}\b/g;

const UI_PRIMITIVES_DIR = "src/components/ui";

const ALLOWLIST: string[] = [];

const PROJECT_ROOT = process.cwd();

function isAllowlisted(filePath: string): boolean {
  const relativePath = path
    .relative(PROJECT_ROOT, filePath)
    .replace(/\\/g, "/");
  for (const pattern of ALLOWLIST) {
    if (pattern.includes("*")) {
      const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
      if (regex.test(relativePath)) return true;
    }
    if (relativePath === pattern) return true;
  }
  return false;
}

function isInUiPrimitives(filePath: string): boolean {
  const relativePath = path
    .relative(PROJECT_ROOT, filePath)
    .replace(/\\/g, "/");
  return relativePath.startsWith(UI_PRIMITIVES_DIR);
}

function collectTsxFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      files.push(...collectTsxFiles(fullPath));
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".tsx") &&
      !entry.name.includes(".test.") &&
      !entry.name.includes(".spec.")
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("theme tokens guard", () => {
  it("prohibits hardcoded Tailwind palette classes outside UI primitives", () => {
    const srcDir = path.join(PROJECT_ROOT, "src");
    const files = collectTsxFiles(srcDir);

    const violations: { file: string; line: number; match: string }[] = [];

    for (const file of files) {
      if (isAllowlisted(file)) continue;
      if (isInUiPrimitives(file)) continue;

      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const line = lines[i];
        if (!line) continue;

        const matches = line.matchAll(PALETTE_CLASS_REGEX);
        for (const match of matches) {
          violations.push({
            file: path.relative(PROJECT_ROOT, file),
            line: lineNum,
            match: match[0],
          });
        }
      }
    }

    if (violations.length > 0) {
      const message = violations
        .slice(0, 20)
        .map((v) => `${v.file}:${String(v.line)}: ${v.match}`)
        .join("\n");
      const more =
        violations.length > 20
          ? `\n...and ${String(violations.length - 20)} more`
          : "";
      throw new Error(
        `Found ${String(violations.length)} hardcoded palette classes:\n${message}${more}\n\nUse semantic tokens (bg-success, text-destructive, bg-muted, etc.) instead.`
      );
    }

    expect(violations).toHaveLength(0);
  });
});

const INDEX_CSS = fs.readFileSync(
  path.join(process.cwd(), "src/index.css"),
  "utf-8"
);

const readTokens = (selector: ":root" | ".dark") =>
  readHslTokens(INDEX_CSS, selector);
const contrast = contrastRatio;

const WHITE: Hsl = [0, 0, 100];
const STATUSES = ["live", "soon", "urgent", "sold", "passed"] as const;

/** [foreground token, background token] pairs that must reach AA (4.5:1). */
const TOKEN_PAIRS: [string, string][] = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["primary-foreground", "primary"],
  ["primary", "background"],
  ["primary", "primary-soft"],
  ["foreground", "primary-soft"],
  ["btn-foreground", "btn"],
  ["secondary-foreground", "secondary"],
  ["secondary", "background"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "muted"],
  ["foreground", "muted"],
  ["accent-foreground", "accent"],
  ["destructive-foreground", "destructive"],
  ["success-foreground", "success"],
  ["warning-foreground", "warning"],
  ["hero-foreground", "hero"],
  ["hero-muted", "hero"],
  ["destructive", "background"],
  ["destructive", "card"],
  ["success", "background"],
  ["success", "card"],
  ["warning", "background"],
  ["warning", "card"],
  ["ok-fg", "background"],
  ["ok-fg", "card"],
  ["warn-fg", "background"],
  ["warn-fg", "card"],
  ...STATUSES.map((s): [string, string] => [`${s}-fg`, `${s}-soft`]),
  ...STATUSES.map((s): [string, string] => [`${s}-fg`, "background"]),
];

describe.each([":root", ".dark"] as const)("WCAG AA contrast (%s)", (sel) => {
  const tokens = readTokens(sel);

  it.each(TOKEN_PAIRS)("%s on %s is at least 4.5:1", (fg, bg) => {
    const fgColor = tokens.get(fg);
    const bgColor = tokens.get(bg);
    if (!fgColor || !bgColor) {
      throw new Error(`${fg} or ${bg} missing in ${sel}`);
    }
    expect(contrast(fgColor, bgColor)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(STATUSES)("white text on %s-solid is at least 4.5:1", (status) => {
    const solid = tokens.get(`${status}-solid`);
    if (!solid) throw new Error(`${status}-solid missing in ${sel}`);
    expect(contrast(WHITE, solid)).toBeGreaterThanOrEqual(4.5);
  });
});

describe.each([":root", ".dark"] as const)("focus ring (%s)", (sel) => {
  const tokens = readTokens(sel);
  const ring = tokens.get("ring");
  const background = tokens.get("background");
  const btn = tokens.get("btn");

  it("is at least 3:1 (WCAG 1.4.11) against the page background", () => {
    if (!ring || !background) throw new Error("ring/background missing");
    expect(contrast(ring, background)).toBeGreaterThanOrEqual(3);
  });

  it("is at least 3:1 against the filled button it surrounds", () => {
    if (!ring || !btn) throw new Error("ring/btn missing");
    // Light: the ring is the button colour itself, separated by the 2px
    // offset gap, so only the gap (background) contrast matters there.
    if (sel === ":root") return;
    expect(contrast(ring, btn)).toBeGreaterThanOrEqual(3);
  });

  it("is applied through the --ring token with a 2px offset", () => {
    expect(INDEX_CSS).toMatch(
      /:focus-visible\s*{[^}]*outline:\s*2px solid hsl\(var\(--ring\)\);[^}]*outline-offset:\s*2px/
    );
  });
});

describe("theme token exposure", () => {
  it("exposes the new tokens as Tailwind colours and Lora as display font", () => {
    for (const name of [
      "primary-soft",
      "btn",
      "btn-foreground",
      "hero",
      "hero-foreground",
      "hero-muted",
      "ok-fg",
      "warn-fg",
      ...STATUSES.flatMap((s) => [`${s}-solid`, `${s}-soft`, `${s}-fg`]),
    ]) {
      expect(INDEX_CSS).toContain(`--color-${name}:`);
    }
    expect(INDEX_CSS).toContain("--font-display:");
  });
});
