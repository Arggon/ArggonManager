/**
 * Tarball-inspection fixtures (task-release-workflow, spec-release-pipeline-015
 * AC A11): `cli/inspect-tarballs.mjs` — the runbook §2 checks, scripted — must
 * pass a well-formed release and FAIL a deliberately broken one, before any
 * publish.
 *
 * The fixtures are synthetic tarballs built with `tar` (no npm pack, fully
 * offline): one pass fixture mirroring the real shipped layout, then one
 * broken mutation per check — missing root artifact, test-helper leak, lib
 * version mismatch, missing kernel exports, and the missing-tarball error.
 * The pass fixture embeds EVERY value export parsed from the real
 * `lib/src/index.ts`, so the parser and the shipped-dist check stay coherent:
 * if the kernel surface grows, this fixture grows with it.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { kernelExportNames } from "./inspect-tarballs.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inspectPath = join(repoRoot, "cli", "inspect-tarballs.mjs");
const VERSION = "9.9.9";

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Build a `package/...` tarball from a path -> content map (dirs implicit). */
function makeTarball(tgzPath: string, files: Record<string, string>): void {
  const staging = mkdtempSync(join(tmpdir(), "arggon-inspect-stage-"));
  tmpDirs.push(staging);
  for (const [path, content] of Object.entries(files)) {
    const target = join(staging, "package", path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  spawnSync("tar", ["-czf", tgzPath, "-C", staging, "package"], { encoding: "utf8" });
}

function packDir(name: string, lib: Record<string, string>, root: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), `arggon-inspect-${name}-`));
  tmpDirs.push(dir);
  makeTarball(join(dir, `arggondev-lib-${VERSION}.tgz`), lib);
  makeTarball(join(dir, `arggon-manager-${VERSION}.tgz`), root);
  return dir;
}

const libFiles = (): Record<string, string> => {
  const exports = kernelExportNames(repoRoot).join("\n");
  return {
    "package.json": JSON.stringify({ name: "@arggondev/lib", version: VERSION }),
    "dist/index.js": exports,
  };
};
const rootFiles = (): Record<string, string> => ({
  "package.json": JSON.stringify({ name: "arggon-manager", version: VERSION }),
  "dist/cli.js": "#!/usr/bin/env node\n",
  "templates/task.md": "# task\n",
  "skills/arggon-cli/SKILL.md": "skill\n",
  "opencode/plugins/arggon/index.ts": "export {}\n",
});

function inspect(pack: string, env: NodeJS.ProcessEnv = {}) {
  return spawnSync("node", [inspectPath, pack, "--version", VERSION, "--repo-root", repoRoot], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

describe("inspect-tarballs: runbook §2, scripted (A11)", () => {
  it("passes a well-formed release", () => {
    const result = inspect(packDir("pass", libFiles(), rootFiles()));
    expect(result.stderr, result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("all");
    expect(result.stdout).toContain("safe to publish");
  });

  it("fails a root tarball missing a runtime asset dir", () => {
    const root = rootFiles();
    delete root["templates/task.md"];
    const result = inspect(packDir("no-templates", libFiles(), root));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ships nothing under templates/");
  });

  it("fails a root tarball leaking test helpers", () => {
    const root = rootFiles();
    root["dist/test-spawn.js"] = "leak\n";
    const result = inspect(packDir("leak", libFiles(), root));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("test-helper leaks");
  });

  it("fails a lib tarball with a version mismatch", () => {
    const lib = libFiles();
    lib["package.json"] = JSON.stringify({ name: "@arggondev/lib", version: "9.9.8" });
    const result = inspect(packDir("libver", lib, rootFiles()));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("lib tarball version 9.9.8 != expected 9.9.9");
  });

  it("fails when kernel exports are missing from the shipped dist", () => {
    const lib = libFiles();
    lib["dist/index.js"] = "const stale = 1;\n";
    const result = inspect(packDir("stale-dist", lib, rootFiles()));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("kernel exports missing");
  });

  it("fails (exit 2) when an expected packed tarball is absent", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-inspect-empty-"));
    tmpDirs.push(dir);
    makeTarball(join(dir, `arggondev-lib-${VERSION}.tgz`), libFiles());
    const result = inspect(dir);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("missing");
  });
});

describe("kernelExportNames (the inspector's source of truth)", () => {
  it("parses the real lib surface: value exports in, type-only out", () => {
    const names = kernelExportNames(repoRoot);
    expect(names.length).toBeGreaterThan(20);
    for (const stable of ["loadItems", "assertUpdateRules", "successEnvelope", "runValidate"]) {
      expect(names, `expected stable kernel export ${names.join(", ")}`).toContain(stable);
    }
    expect(names).not.toContain("Frontmatter"); // export type { ... } is not shipped JS
  });
});
