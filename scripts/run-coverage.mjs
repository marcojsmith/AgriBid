import { spawn } from "child_process";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const outputDir = resolve(rootDir, "test-coverage");
const outputFile = resolve(outputDir, "latest-coverage-output.txt");

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

const args = ["run", "vitest", "run", "--coverage"];
const child = spawn("bun", args, {
  cwd: rootDir,
  stdio: ["inherit", "pipe", "pipe"],
  shell: true,
});

let output = "";

child.stdout.on("data", (data) => {
  const chunk = data.toString();
  process.stdout.write(chunk);
  output += chunk;
});

child.stderr.on("data", (data) => {
  const chunk = data.toString();
  process.stderr.write(chunk);
  output += chunk;
});

child.on("close", (code) => {
  writeFileSync(outputFile, output, "utf-8");
  console.log(`\nCoverage output saved to: ${outputFile}`);
  process.exit(code ?? 0);
});
