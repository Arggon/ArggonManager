import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cliEntryPath, nodeImportArgs, runCli, tsxLoaderPath } from "./test-spawn.js";

/**
 * bug-row-table-flake gate (task-runcli-import-tsx-migration): the tsx
 * wrapper CLI must stay out of test spawn chains. Every suite spawns the CLI
 * through the shared loader helper (`node --import <tsx loader> cli.ts`);
 * this file pins the helper wiring and scans the test trees for any wrapper
 * reference outside comments. smoke/ scripts and e2e/ helpers are deliberate
 * exceptions tracked as a follow-up on the item — they are NOT scanned here.
 */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// Built dynamically so this gate never spells the wrapper path in code.
const WRAPPER_REF = ["cli", "mjs"].join(".");

/** Trees whose test spawn chains must use the loader helper. */
const SCANNED = ["cli/src", "labs", "test", "opencode"];
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

/**
 * Only `*.test.*` files are scanned: this gate owns the TEST spawn chains.
 * The two remaining product-side mentions (cli/src/measure.ts `cliCommand()`
 * and cli/src/mcp-server.ts `deriveDefaultCliSpawn()`) are deliberate,
 * tracked follow-ups on task-runcli-import-tsx-migration — product code is
 * out of scope there.
 */

/**
 * Strip line/block comments so prose mentions of the wrapper (e.g. the bug
 * comment in test-spawn.ts) do not trip the scan. String literals are KEPT:
 * the wrapper only ever appears inside them (`join(root, "…/tsx/dist/cli.mjs")`),
 * and that is exactly what this gate must catch.
 */
function stripComments(source: string): string {
  let out = "";
  let i = 0;
  type State = "code" | "line" | "block" | "single" | "double" | "template";
  let state: State = "code";
  while (i < source.length) {
    const ch = source[i]!;
    const next = source[i + 1];
    if (state === "code") {
      if (ch === "/" && next === "/") {
        state = "line";
        i += 2;
        continue;
      }
      if (ch === "/" && next === "*") {
        state = "block";
        i += 2;
        continue;
      }
      if (ch === "'") {
        state = "single";
        out += ch;
        i++;
        continue;
      }
      if (ch === '"') {
        state = "double";
        out += ch;
        i++;
        continue;
      }
      if (ch === "`") {
        state = "template";
        out += ch;
        i++;
        continue;
      }
      out += ch;
      i++;
      continue;
    }
    if (state === "line") {
      if (ch === "\n") {
        state = "code";
        out += ch;
      }
      i++;
      continue;
    }
    if (state === "block") {
      if (ch === "*" && next === "/") {
        state = "code";
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    // String/template states: keep the quote characters, keep the contents
    // (honor escapes). Best-effort by design: `${…}` interiors are kept with
    // the literal, and this repo's sources contain no nested-backtick
    // templates.
    const quote = state === "single" ? "'" : state === "double" ? '"' : "`";
    if (ch === "\\") {
      out += source.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (ch === quote) {
      state = "code";
    }
    out += ch;
    i++;
  }
  return out;
}

function walkTestFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkTestFiles(full));
    else if (TEST_FILE.test(entry.name)) files.push(full);
  }
  return files;
}

describe("test-spawn helper wiring (bug-row-table-flake)", () => {
  it("resolves the tsx loader and CLI entry inside the repo", () => {
    expect(tsxLoaderPath()).toMatch(/tsx[/\\]dist[/\\]loader\.mjs$/);
    expect(existsSync(tsxLoaderPath())).toBe(true);
    expect(cliEntryPath()).toMatch(/cli[/\\]src[/\\]cli\.ts$/);
    expect(existsSync(cliEntryPath())).toBe(true);
  });

  it("builds the --import argv (loader registration, no wrapper process)", () => {
    expect(nodeImportArgs("entry.ts")).toEqual(["--import", tsxLoaderPath(), "entry.ts"]);
  });

  it("runCli spawns the real CLI successfully", () => {
    const proc = runCli(["--version"], repoRoot);
    expect(proc.status, proc.stderr).toBe(0);
  });

  it("no scanned test tree references the wrapper CLI outside comments", () => {
    const offenders: string[] = [];
    for (const rel of SCANNED) {
      for (const file of walkTestFiles(join(repoRoot, rel))) {
        const code = stripComments(readFileSync(file, "utf8"));
        if (code.includes(WRAPPER_REF)) offenders.push(file.slice(repoRoot.length + 1));
      }
    }
    expect(offenders).toEqual([]);
  });
});
