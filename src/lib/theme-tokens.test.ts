import fs from "node:fs";
import path from "node:path";

const PALETTE_CLASS_REGEX =
  /\b(bg|text|border|ring|from|to|via|fill|stroke)-(gray|slate|zinc|neutral|stone|red|green|blue|yellow|amber|orange|emerald|teal|sky|indigo|purple|pink|rose)-[0-9]{2,3}\b/g;

const UI_PRIMITIVES_DIR = "src/components/ui";

const ALLOWLIST: string[] = [];

const PROJECT_ROOT = process.cwd();

function isAllowlisted(filePath: string): boolean {
  const relativePath = path.relative(PROJECT_ROOT, filePath).replace(/\\/g, "/");
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
  const relativePath = path.relative(PROJECT_ROOT, filePath).replace(/\\/g, "/");
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
