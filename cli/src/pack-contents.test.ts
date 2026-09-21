/**
 * Packaging contract (task-npm-packaging): what `npm pack` ships is pinned
 * here so a regression fails the suite.
 *
 * The pack runs in a temp copy of every TRACKED file — a stand-in for a fresh
 * clone: `dist/` is gitignored and `node_modules/` is linked in, so the copy
 * has NO build output. That makes this single test the gate for three
 * acceptance criteria at once:
 *
 *   1. the `files` allowlist (production dist without *.test.*, the runtime
 *      asset dirs templates/skills/opencode, README/LICENSE) — any path
 *      outside the allowlist, or any test artifact, fails;
 *   2. a fresh clone installs/builds without pre-build: `prepare` must produce
 *      dist/cli.js in the copy before the tarball is collected;
 *   3. the bin ships executable (`postbuild` chmod), or a manual symlink to it
 *      fails with "Permission denied" as observed on 2026-09-18.
 *
 * Baseline before the allowlist: 977 files / 8.4 MB, 225 test artifacts.
 * W6 task-native-headless-ci: the packed-install + headless CI gate lives in
 * cli/src/headless-ci.test.ts; both share `./pack-fixtures.js`.
 */
import { existsSync, mkdtempSync as _mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  freshCloneCopy,
  npm,
  parsePackResult,
  type PackedFile,
  type PackResult,
} from "./pack-fixtures.js";
import { removeFixtureTree } from "./test-tmp.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) removeFixtureTree(dir);
});

/** Fresh-clone stand-in created in a tracked temp dir (see {@link freshCloneCopy}). */
function freshClone(): string {
  const dir = _mkdtempSync(join(tmpdir(), "arggon-pack-"));
  tmpDirs.push(dir);
  freshCloneCopy(root, dir);
  return dir;
}

describe("parsePackResult (npm 10 array vs npm 12 keyed payloads)", () => {
  const file: PackedFile = { path: "dist/cli.js", size: 10, mode: 0o755 };
  const result: PackResult = {
    filename: "arggon-manager-0.3.0.tgz",
    name: "arggon-manager",
    version: "0.3.0",
    size: 1,
    unpackedSize: 2,
    files: [file],
  };

  it("parses npm >= 12's object keyed by package name", () => {
    expect(parsePackResult(JSON.stringify({ "arggon-manager": result }))).toEqual(result);
  });

  it("parses npm 10's single-element array (regression: truncated at the first `{`)", () => {
    expect(parsePackResult(JSON.stringify([result]))).toEqual(result);
  });

  it("ignores lifecycle script output preceding the payload", () => {
    const stdout = `> arggon-manager@0.3.0 prepare\n> npm run build\n\n${JSON.stringify([result])}\n`;
    expect(parsePackResult(stdout)).toEqual(result);
  });

  it("fails clearly on output without package metadata", () => {
    expect(() => parsePackResult("no json here")).toThrow(/no JSON payload/);
    expect(() => parsePackResult('{"other":{}}')).toThrow(/unexpected npm pack --json payload/);
  });
});

describe("npm pack contents", () => {
  it("pins prepare/postbuild as part of the install contract", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    // prepare builds on install-from-clone (fresh clone without pre-build).
    expect(pkg.scripts?.prepare).toMatch(/\bbuild\b/);
    // postbuild bakes the build identity and sets the bin's exec bit.
    expect(pkg.scripts?.postbuild).toBeTruthy();
  });

  it("ships the allowlist only, built from a fresh clone without pre-build", () => {
    const clone = freshClone();
    // The precondition that makes the prepare assertion meaningful.
    expect(existsSync(join(clone, "dist"))).toBe(false);

    const pack = npm(["pack", "--dry-run", "--json"], clone);
    expect(pack.status, `${pack.stdout.slice(0, 2000)}\n${pack.stderr}`).toBe(0);
    const result = parsePackResult(pack.stdout);

    // prepare ran the build in the clone: dist/cli.js exists there now.
    expect(existsSync(join(clone, "dist", "cli.js"))).toBe(true);
    const baked = JSON.parse(readFileSync(join(clone, "dist", "build-info.json"), "utf8")) as {
      version?: string;
    };
    expect(baked.version).toBe(result.version);

    const paths = result.files.map((f) => f.path);
    // 1. Nothing outside the allowlist: `files` is the whole contract.
    const allowedTopLevel = new Set([
      "dist",
      "templates",
      "skills",
      "opencode",
      "package.json",
      "README.md",
      "LICENSE",
    ]);
    expect(paths.filter((p) => !allowedTopLevel.has(p.split("/")[0]))).toEqual([]);
    // 2. No test artifact anywhere: neither compiled `*.test.*` sources nor the
    //    test-only `test-tmp` teardown / `pack-fixtures` helpers (the
    //    2026-09-18 bug bundled 225 test artifacts).
    expect(paths.filter((p) => /\.test\.|(^|\/)(test-tmp|pack-fixtures)\./.test(p))).toEqual([]);
    // 3. Runtime assets `arggon init` reads from the package + the bin.
    for (const required of [
      "dist/cli.js",
      "dist/build-info.json",
      "templates/task.md",
      // W6 task-native-headless-ci: the adopter CI recipe ships with the pack.
      "templates/docs/github/workflows/arggon.yml",
      "skills/arggon-cli/SKILL.md",
      "opencode/plugins/arggon/index.ts",
      "opencode/plugins/arggon/index.bundle.ts",
      // W5 task-native-tui: the TUI entry vendored beside the server bundle.
      "opencode/plugins/arggon/tui.tsx",
      "README.md",
      "LICENSE",
      "package.json",
    ]) {
      expect(paths, `tarball is missing ${required}`).toContain(required);
    }
    // 4. The bin ships executable (postbuild chmod).
    const bin = result.files.find((f) => f.path === "dist/cli.js");
    if (process.platform !== "win32") expect((bin?.mode ?? 0) & 0o111).not.toBe(0);
    // 5. Slim: generous bounds, well below the 977 files / 8.4 MB baseline.
    expect(result.files.length).toBeLessThan(400);
    expect(result.size).toBeLessThan(4 * 1024 * 1024);
  }, 120_000);
});
