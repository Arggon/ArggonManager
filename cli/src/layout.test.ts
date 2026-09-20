/**
 * Tracker layout detection and the no-hard-break guarantee (ADR 0012):
 * the v5 `ArggonManager/` root is preferred, a legacy `tasks/` tree keeps
 * working until migrated, and `arggon init` upgrades a legacy tree in place
 * (same root, docs at `<root>/docs/`) instead of silently moving it.
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { runInit } from "./init.js";
import { bundledTemplatesDir } from "./package-assets.js";
import {
  docsDirForRoot,
  findTrackerLocation,
  loadItems,
  runCreate,
  runList,
  runValidate,
  trackerAt,
} from "@arggon/lib";

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string): string {
  const dir = _mkdtempSync(prefix);
  tmpDirs.push(dir);
  return dir;
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = resolve(repoRoot, "cli/src/cli.ts");
const tsx = resolve(repoRoot, "node_modules/tsx/dist/cli.mjs");

function runCli(args: string[], cwd: string) {
  return spawnSync(process.execPath, [tsx, cli, ...args], { encoding: "utf8", cwd });
}

/** Minimal legacy tree: tasks/.convention.yml + one initiative. */
function legacyTree(version = 3): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-layout-"));
  mkdirSync(join(dir, "tasks/launch"), { recursive: true });
  writeFileSync(
    join(dir, "tasks/launch/launch.md"),
    '---\ntype: initiative\nstatus: todo\nid: launch\ncreated: "2026-09-18"\nupdated: "2026-09-18"\n---\n\n# Launch\n',
    "utf8",
  );
  writeFileSync(join(dir, "tasks/.convention.yml"), `version: ${version}\n`, "utf8");
  return dir;
}

describe("tracker layout detection (ADR 0012)", () => {
  it("prefers ArggonManager/ when both roots carry a tracker", () => {
    const dir = legacyTree();
    mkdirSync(join(dir, "ArggonManager"), { recursive: true });
    writeFileSync(join(dir, "ArggonManager/.convention.yml"), "version: 5\n", "utf8");
    const loc = findTrackerLocation(dir);
    expect(loc.name).toBe("ArggonManager");
    expect(loc.layout).toBe("arggon-manager");
    expect(loc.docsDir).toBe(join(dir, "ArggonManager/docs"));
  });

  it("falls back to legacy tasks/ and reports it (docs stay at <root>/docs)", () => {
    const dir = legacyTree();
    const loc = findTrackerLocation(dir);
    expect(loc.name).toBe("tasks");
    expect(loc.layout).toBe("legacy");
    expect(loc.legacy).toBe(true);
    expect(loc.docsDir).toBe(join(dir, "docs"));
    expect(docsDirForRoot(dir)).toBe(join(dir, "docs"));
  });

  it("a legacy tree keeps working: create/list/validate operate on tasks/ and report LEGACY_LAYOUT", () => {
    const dir = legacyTree();
    const created = runCreate({
      cwd: dir,
      type: "epic",
      title: "Auth",
      parent: "launch",
      // Legacy fixtures carry no repo-local templates/ (ADR 0013).
      templatesDir: bundledTemplatesDir(),
    });
    expect(created.path).toBe(join(dir, "tasks/launch/auth/auth.md"));
    expect(existsSync(join(dir, "tasks/launch/auth/auth.md"))).toBe(true);

    const listed = runList({ cwd: dir });
    expect(listed.items.map((i) => i.id).sort()).toEqual(["auth", "launch"]);

    const validation = runValidate({ cwd: dir });
    expect(validation.errors).toEqual([]);
    expect(validation.layout).toBe("legacy");
    expect(validation.warnings.map((w) => w.code)).toContain("LEGACY_LAYOUT");
  });

  it("loadItems skips the in-tracker product docs dir on the v5 layout", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-layout-"));
    runInit({ dir, force: false });
    const tracker = trackerAt(dir)!;
    expect(tracker.layout).toBe("arggon-manager");
    expect(existsSync(join(tracker.docsDir, "tracking.md"))).toBe(true);
    // A doc that even carries a `type:` frontmatter must not load as an item.
    writeFileSync(
      join(tracker.docsDir, "rogue.md"),
      "---\ntype: task\nstatus: todo\nid: task-rogue\n---\n",
      "utf8",
    );
    expect(loadItems(tracker.dir).map((i) => i.id)).not.toContain("task-rogue");
    const validation = runValidate({ cwd: dir });
    expect(validation.errors).toEqual([]);
  });

  it("init on a legacy tree upgrades in place (root and docs stay put)", () => {
    const dir = legacyTree();
    const result = runInit({ dir, force: false, full: true });
    expect(result.alreadyInitialized).toBe(true);
    // Same tracker root: no silent move.
    expect(existsSync(join(dir, "tasks/.convention.yml"))).toBe(true);
    expect(existsSync(join(dir, "ArggonManager"))).toBe(false);
    // Docs keep their legacy location.
    expect(existsSync(join(dir, "docs/convention.md"))).toBe(true);
    expect(existsSync(join(dir, "tasks/docs"))).toBe(false);
    const yml = readFileSync(join(dir, "tasks/.convention.yml"), "utf8");
    expect(yml).toContain("version: 3"); // untouched: the migration bumps it
  });

  it("init on a fresh tree scaffolds the v5 layout (docs under the tracker)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-layout-"));
    const result = runInit({ dir, force: false, full: true });
    expect(result.conventionPath).toBe(join(dir, "ArggonManager/.convention.yml"));
    expect(result.created).toContain("ArggonManager/docs/convention.md");
    expect(existsSync(join(dir, "ArggonManager/docs/convention.md"))).toBe(true);
    expect(existsSync(join(dir, "docs"))).toBe(false);
    expect(readFileSync(join(dir, "ArggonManager/.convention.yml"), "utf8")).toContain(
      "version: 5",
    );
  });

  it("CLI migrate --layout --json moves a legacy tree, then list/validate see the v5 layout", () => {
    const dir = legacyTree();
    const migrated = runCli(["migrate", "--layout", "--json"], dir);
    expect(migrated.status, migrated.stderr).toBe(0);
    const body = JSON.parse(migrated.stdout) as {
      ok: boolean;
      command: string;
      changed: boolean;
      alreadyMigrated: boolean;
      versionBump: { from: number; to: number };
      trackerMove: { from: string; to: string };
      rewrittenGeneratedPaths: unknown[];
    };
    expect(body.ok).toBe(true);
    expect(body.command).toBe("migrate");
    expect(body.changed).toBe(true);
    expect(body.versionBump).toEqual({ from: 3, to: 5 });
    expect(body.trackerMove.to).toBe(join(dir, "ArggonManager"));

    const listed = runCli(["list", "--json"], dir);
    expect(listed.status).toBe(0);
    const listBody = JSON.parse(listed.stdout) as {
      items: { id: string }[];
      conventionVersion: number;
    };
    expect(listBody.items.map((i) => i.id)).toEqual(["launch"]);
    expect(listBody.conventionVersion).toBe(5);

    const validation = runCli(["validate", "--json"], dir);
    expect(validation.status).toBe(0);
    const validateBody = JSON.parse(validation.stdout) as { layout: string; warnings: unknown[] };
    expect(validateBody.layout).toBe("arggon-manager");
    expect(validateBody.warnings).toEqual([]);
  });

  it("CLI migrate without --layout fails with an actionable error", () => {
    const dir = legacyTree();
    const proc = runCli(["migrate", "--json"], dir);
    expect(proc.status).toBe(1);
    const body = JSON.parse(proc.stdout) as {
      ok: boolean;
      error: { code: string; message: string };
    };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("MIGRATE_FAILED");
    expect(body.error.message).toContain("--layout");
  });
});
