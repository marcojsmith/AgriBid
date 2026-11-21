import fs from "node:fs";
import path from "node:path";

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

type Hsl = readonly [number, number, number];

const INDEX_CSS = fs.readFileSync(
  path.join(process.cwd(), "src/index.css"),
  "utf-8"
);

/**
 * Extract the `--name: H S% L%` declarations of one selector block.
 *
 * @param selector - The CSS selector whose block is read.
 * @returns Map of token name to its HSL triple.
 */
function readTokens(selector: ":root" | ".dark"): Map<string, Hsl> {
  const start = INDEX_CSS.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Missing ${selector} block in index.css`);
  const end = INDEX_CSS.indexOf("}", start);
  const block = INDEX_CSS.slice(start, end);
  const tokens = new Map<string, Hsl>();
  for (const m of block.matchAll(
    /--([a-z0-9-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/g
  )) {
    const [, name, h, s, l] = m;
    if (name && h && s && l) {
      tokens.set(name, [Number(h), Number(s), Number(l)]);
    }
  }
  return tokens;
}

function toRgb([h, s, l]: Hsl): [number, number, number] {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number): number => {
    const k = (n + h / 30) % 12;
    return light - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return [f(0), f(8), f(4)];
}

function luminance(color: Hsl): number {
  const [r = 0, g = 0, b = 0] = toRgb(color).map((v) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Hsl, b: Hsl): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

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
