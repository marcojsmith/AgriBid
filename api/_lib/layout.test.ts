// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const API_DIR = path.join(process.cwd(), "api");

/**
 * Lists every file under a directory.
 *
 * @param dir - Directory to walk
 * @returns Absolute file paths
 */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const sources = walk(API_DIR).filter(
  (file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file)
);

describe("api/ layout (Vercel compiles only function entries and .ts helpers)", () => {
  it("has no .tsx file inside api/_lib", () => {
    const bad = walk(path.join(API_DIR, "_lib")).filter((f) =>
      f.endsWith(".tsx")
    );
    expect(bad).toEqual([]);
  });

  it("resolves every relative import to an existing .ts or .tsx entry", () => {
    const unresolved: string[] = [];
    for (const file of sources) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/from\s+"(\.{1,2}\/[^"]+)"/g)) {
        const spec = match[1];
        // Generated Convex files ship as .js/.d.ts pairs.
        if (spec.includes("convex/_generated/")) continue;
        const base = path.resolve(path.dirname(file), spec);
        const ts = base.replace(/\.js$/, ".ts");
        const ok = ts !== base && statSafe(ts);
        if (!ok) unresolved.push(`${path.relative(API_DIR, file)} -> ${spec}`);
      }
    }
    expect(unresolved).toEqual([]);
  });
});

/**
 * Whether a path is an existing file.
 *
 * @param file - Path to check
 * @returns True when it exists
 */
function statSafe(file: string): boolean {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}
