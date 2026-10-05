/**
 * bug-test-suite-lib-dist-rebuild-race gates: what a spawned child resolves, and
 * what the run lets a writer do to the repo's built artifacts.
 *
 * The flake this item closes: a lane rebuilt the shared `lib/dist` in place while
 * another lane's spawned CLI child was linking it, and the child died inside
 * Node's ESM loader with `SyntaxError: The requested module './json.js' does not
 * provide an export named 'compactWorkItem'`. The export name varied per
 * occurrence because it varied with which half-written module the child reached
 * first, and the lane reported an unrelated-looking error while the harness's
 * `artifactDrift` sat unused in the diagnostic.
 *
 * What is pinned here, in the order it matters:
 *
 *  1. the REPRODUCTION — a real writer holds a half-written kernel module while a
 *     reader links it, hermetically, in a temp root. A child on the pre-fix argv
 *     dies with the CI error verbatim; a child on the harness argv is unaffected.
 *     No timing race decides the outcome: the writer signals, then holds.
 *  2. the RESOLUTION — a harness child resolves `@arggondev/lib` to
 *     `lib/src/index.ts`, so there is no build artifact left to race.
 *  3. PARITY — the kernel's value exports from source equal the built ones, so
 *     pinning (2) changes nothing a reader can observe.
 *  4. the WRITER GATE — the shared build is read-only for the run
 *     (`test/kernel-artifacts.ts`), and a platform that cannot enforce it says
 *     so instead of reporting a green it did not earn. Enforcement is skipped
 *     under uid 0, which no mode can refuse; the drift half still reports there.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import * as kernelFromSource from "@arggondev/lib";
import {
  describeSetup,
  freeze,
  frozenDirs,
  unfreeze,
  watchedArtifacts,
} from "../../test/kernel-artifacts.js";
import { cliNodeArgs, kernelSourceHookPath, nodeImportArgs, tsxLoaderPath } from "./test-spawn.js";
import { removeFixtureTree } from "./test-tmp.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** A complete kernel module: the state the writer restores. */
const COMPLETE_KERNEL = "export const loadItems = () => [];\n";

/**
 * The half-written shape a rebuild leaves mid-rewrite: the module still parses
 * (that is what makes it dangerous — the loader links it) but the export the
 * reader is importing is not in it yet. This is the exact shape the CI lane
 * reported, and it is deliberately not a syntactically truncated file: that
 * would fail with a parse error and prove a different thing.
 */
const TRUNCATED_KERNEL =
  'import { readFileSync } from "node:fs";\nexport const partial = () => readFileSync;\n';

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) removeFixtureTree(dir);
});

function mkdtemp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

/** The CI failure, verbatim: the module graph never came up. */
const MISSING_EXPORT = /does not provide an export named/;

/**
 * A temp root holding a `@arggondev/lib` whose `dist/index.js` is `source`, plus
 * an entry that links a named export from it. Node resolves the bare specifier
 * from the entry's own `node_modules`, so nothing here can reach the repo's.
 */
function kernelFixture(source: string): { root: string; entry: string } {
  const root = mkdtemp("arggon-kernel-isolation-");
  const kernelDir = join(root, "node_modules", "@arggondev", "lib", "dist");
  mkdirSync(kernelDir, { recursive: true });
  writeFileSync(
    join(dirname(kernelDir), "package.json"),
    `${JSON.stringify(
      {
        name: "@arggondev/lib",
        version: "0.0.0",
        type: "module",
        exports: { ".": "./dist/index.js" },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(join(kernelDir, "index.js"), source);
  const entry = join(root, "probe-entry.mjs");
  // Linking is the whole point: the fixture never calls the kernel, so the only
  // way this can fail is the way the CI lane failed.
  writeFileSync(
    entry,
    [
      'import { loadItems } from "@arggondev/lib";',
      'process.stdout.write(JSON.stringify({ linked: typeof loadItems === "function" }));',
      "",
    ].join("\n"),
  );
  return { root, entry };
}

/** Spawn `node <args...>` and collect the result. */
function node(args: string[], cwd?: string) {
  return spawnSync(process.execPath, args, { cwd, encoding: "utf8", timeout: 60_000 });
}

/**
 * Truncate the fixture's kernel module, signal, hold until `release` appears (or
 * `holdMs` elapses), then restore it. Its own process on purpose: the defect is
 * that the WRITE and the READ are different processes.
 */
function startWriter(
  root: string,
  holdMs = 3_000,
): { ready: string; release: string; done: Promise<void> } {
  const ready = join(root, "writer-ready");
  const release = join(root, "writer-release");
  const script = join(root, "writer.mjs");
  writeFileSync(
    script,
    [
      'import { existsSync, writeFileSync } from "node:fs";',
      `const target = ${JSON.stringify(join(root, "node_modules", "@arggondev", "lib", "dist", "index.js"))};`,
      `writeFileSync(target, ${JSON.stringify(TRUNCATED_KERNEL)});`,
      `writeFileSync(${JSON.stringify(ready)}, "");`,
      `const heldUntil = Date.now() + ${holdMs};`,
      `while (!existsSync(${JSON.stringify(release)}) && Date.now() < heldUntil) {`,
      "  await new Promise((r) => setTimeout(r, 25));",
      "}",
      `writeFileSync(target, ${JSON.stringify(COMPLETE_KERNEL)});`,
      "",
    ].join("\n"),
  );
  const child = spawn(process.execPath, [script], { stdio: "ignore" });
  const done = new Promise<void>((settled) => {
    child.once("exit", () => settled());
  });
  return { ready, release, done };
}

describe("a spawned child never links a half-written kernel module", () => {
  it("reproduces the CI shape deterministically, and the harness argv is immune to it", async () => {
    // The fixture starts COMPLETE, so the first child is the control: the argv
    // is the only variable between the failing and the passing spawn below.
    const { root, entry } = kernelFixture(COMPLETE_KERNEL);
    const control = node([entry]);
    expect(control.status, `${control.stdout}\n${control.stderr}`).toBe(0);
    expect(JSON.parse(control.stdout)).toEqual({ linked: true });

    const { ready, release, done } = startWriter(root);
    try {
      const deadline = Date.now() + 20_000;
      while (!existsSync(ready) && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 25));
      }
      expect(existsSync(ready), "the writer never reached the half-written state").toBe(true);

      // (a) The pre-fix argv: resolves `@arggondev/lib` through `node_modules` to
      //     the artifact the writer is holding, and dies in the ESM loader with
      //     the exact error the CI lane reported.
      const raced = node([entry]);
      expect(raced.status).not.toBe(0);
      expect(raced.stderr).toMatch(MISSING_EXPORT);
      expect(raced.stderr).toContain("'loadItems'");

      // (b) The harness argv: the kernel-source resolve hook points the specifier
      //     at `lib/src/index.ts`, which no writer in the tree rewrites.
      const isolated = node(cliNodeArgs(entry));
      expect(isolated.status, `${isolated.stdout}\n${isolated.stderr}`).toBe(0);
      expect(JSON.parse(isolated.stdout)).toEqual({ linked: true });
      expect(isolated.stderr).toBe("");
    } finally {
      writeFileSync(release, "");
      await done;
    }
  }, 60_000);

  it("resolves @arggondev/lib to the kernel source from a harness child", () => {
    // The mechanism itself, observed from a child: `vitest.config.ts` aliases the
    // kernel to source for in-process tests, and this is the same resolution for
    // the spawned ones.
    const probe = 'process.stdout.write(import.meta.resolve("@arggondev/lib"));';
    const withoutHook = node(["--input-type=module", "-e", probe], repoRoot);
    expect(withoutHook.status, withoutHook.stderr).toBe(0);
    expect(withoutHook.stdout.trim()).toContain("/lib/dist/index.js");

    const withHook = node(
      ["--import", kernelSourceHookPath(), "--input-type=module", "-e", probe],
      repoRoot,
    );
    expect(withHook.status, `${withHook.stdout}\n${withHook.stderr}`).toBe(0);
    expect(withHook.stdout.trim()).toContain("/lib/src/index.ts");
    // A hook that leaked a warning into the child's stderr would break the
    // suites that assert an empty stream, and would be invisible here otherwise.
    expect(withHook.stderr).toBe("");
  }, 60_000);

  it.skipIf(!existsSync(join(repoRoot, "lib", "dist", "index.js")))(
    "keeps the source kernel's value exports identical to the built one's",
    () => {
      // Pinning the source is only safe if the two are the same module to a
      // reader. Skipped on a checkout that never built: there is nothing to
      // compare against, and the suites that do need the build say so.
      const probe =
        'const m = await import("@arggondev/lib");process.stdout.write(JSON.stringify(Object.keys(m).sort()));';
      const fromDist = node(["--input-type=module", "-e", probe], repoRoot);
      expect(fromDist.status, fromDist.stderr).toBe(0);
      const distExports = JSON.parse(fromDist.stdout) as string[];
      // In-process, vitest's own alias already resolved the kernel to source.
      expect(Object.keys(kernelFromSource).sort()).toEqual(distExports);
      // Not a bag of internals: the public surface is operations.
      expect(distExports).toContain("loadItems");
    },
    60_000,
  );
});

describe("no test can mutate the shared build another test is reading", () => {
  it("covers the kernel and CLI build outputs, and says what it could not", () => {
    const report = describeSetup();
    if (process.platform === "win32") {
      // No POSIX modes: reported, never silently green.
      expect(report.enforced).toBe(false);
      expect(report.skipped.join(" ")).toContain("POSIX read-only modes unavailable");
      return;
    }
    expect(report.enforced).toBe(true);
    expect(report.files.length).toBeGreaterThan(0);
    for (const dir of frozenDirs()) {
      if (!existsSync(dir)) continue;
      expect(
        report.dirs.map((d) => d.path),
        `${dir} is not frozen`,
      ).toContain(dir);
    }
  });

  it("has the watched artifacts read-only right now (this run froze them)", () => {
    if (process.platform === "win32") return;
    let watched = 0;
    for (const artifact of watchedArtifacts) {
      if (!existsSync(artifact)) continue;
      watched += 1;
      const mode = statSync(artifact).mode;
      expect(mode & 0o222, `${artifact} is writable mid-suite (mode ${mode.toString(8)})`).toBe(0);
    }
    // A checkout with no build has nothing to freeze; say so instead of
    // asserting nothing about an empty list.
    expect(watched).toBe(watchedArtifacts.filter((a) => existsSync(a)).length);
  });

  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
    "refuses a writer outright, in the lane that writes",
    () => {
      // The mode bits above prove intent; this proves enforcement. A rebuild that
      // lands during a run must fail HERE — in the suite that rebuilt — with the
      // diagnostic the reported flake never had, instead of half-way through a
      // child that is linking the file.
      const dir = mkdtemp("arggon-freeze-refusal-");
      const file = join(dir, "artifact.js");
      writeFileSync(file, COMPLETE_KERNEL);
      const applied = freeze(describeSetup([dir], true));
      try {
        // In-place rewrite (`tsc` does exactly this) and create-beside-then-rename.
        expect(() => writeFileSync(file, "export const rebuilt = 1;\n")).toThrowError();
        expect(() => writeFileSync(join(dir, "new.js"), "//\n")).toThrowError();
      } finally {
        unfreeze(applied);
      }
      // The bytes are untouched: a refused write is not a partial write.
      expect(readFileSync(file, "utf8")).toBe(COMPLETE_KERNEL);
    },
  );

  it("releases what it froze, so the tree is left buildable", () => {
    // The exit path matters more than the happy path: a leftover read-only
    // `lib/dist` makes the next `npm run build` fail with EACCES and reads as a
    // broken checkout. Exercised on a temp path, never the repo's own artifacts.
    if (process.platform === "win32") return;
    const dir = mkdtemp("arggon-unfreeze-");
    const file = join(dir, "artifact.js");
    writeFileSync(file, COMPLETE_KERNEL);
    const before = statSync(file).mode;
    const applied = freeze(describeSetup([dir], true));
    expect(statSync(file).mode & 0o222).toBe(0);
    unfreeze(applied);
    expect(statSync(file).mode).toBe(before);
  });
});

describe("the harness argv", () => {
  it("is the source-run shape plus the kernel-source hook, entry last", () => {
    // `nodeImportArgs` is the shape production spawns (cli/src/measure.ts), and
    // stays exactly that; the harness adds one loader so a child that reaches
    // the kernel never reads the artifact the run freezes.
    expect(nodeImportArgs("entry.ts")).toEqual(["--import", tsxLoaderPath(), "entry.ts"]);
    expect(cliNodeArgs("entry.ts")).toEqual([
      "--import",
      tsxLoaderPath(),
      "--import",
      kernelSourceHookPath(),
      "entry.ts",
    ]);
    expect(existsSync(kernelSourceHookPath())).toBe(true);
  });
});
