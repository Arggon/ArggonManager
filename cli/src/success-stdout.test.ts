import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { RM_RETRY } from "./test-tmp.js";

/**
 * task-success-stdout-sanitize: the success-path human channel is the last
 * link of the human-output hygiene chain. Dynamic values echoed on stdout can
 * be repo-controlled (item file paths, ids from frontmatter, branch names,
 * GitHub issue titles, hook commands) or operator argv (baseline paths) — a
 * hostile value must render inert on the human line, while `--json` keeps the
 * raw value byte for byte and ordinary values render byte-identical.
 *
 * These tests drive the real CLI (spawn + tsx) so they assert the actual
 * stdout bytes, not a formatter in isolation.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = resolve(root, "cli/src/cli.ts");
const tsx = resolve(root, "node_modules/tsx/dist/cli.mjs");

function runCli(args: string[], cwd: string) {
  return spawnSync(process.execPath, [tsx, cli, ...args], { encoding: "utf8", cwd });
}

function runGit(args: string[], cwd: string) {
  return spawnSync("git", args, { encoding: "utf8", cwd });
}

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test
// with the bounded ENOTEMPTY retry window (spawned children settle late).
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, RM_RETRY);
});
function mkdtempSync(prefix: string): string {
  const dir = _mkdtempSync(prefix);
  tmpDirs.push(dir);
  return dir;
}

/** Raw code points that must never reach the terminal through a dynamic value. */
const UNSAFE = /[\u001b\u007f-\u009f\u2028\u2029]/;

/** Hostile bytes that fit BOTH a filename and an unquoted YAML scalar. */
const HOSTILE = "bad\nspoof: fake item\u001b[31m\u0085\u007f\u2028\u2029";
/**
 * Same, without the real newline (frontmatter is line-oriented) and with the
 * LS/PS interior: both `runUpdate`'s `id.trim()` and the frontmatter parser's
 * value `trim()` would strip them at the edges — that normalization is the
 * tool's, not the display channel's. The bytes deliberately avoid the
 * frontmatter writer's quote-trigger set (`: # { } [ ] , & * ? ! ' "`) so a
 * hostile id survives the write → reload round-trip unchanged.
 */
const HOSTILE_SCALAR = "badfake\u2028item\u2029 \u001b31m\u0085\u007f";

/** Escaped rendering of {@link HOSTILE} as it must appear on stdout. */
const HOSTILE_ESCAPED = "bad\\nspoof: fake item\\u001b[31m\\u0085\\u007f\\u2028\\u2029";
const HOSTILE_SCALAR_ESCAPED = "badfake\\u2028item\\u2029 \\u001b31m\\u0085\\u007f";

/**
 * Git-backed tracker fixture:
 *
 *   launch-mvp (initiative)
 *   ├── auth (epic)
 *   │   └── story-login (story)
 *   │       └── task-rate-limit (task)
 *   └── onboarding (epic)
 *       └── story-handbook (story)
 */
function initTree(): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-success-stdout-"));
  expect(runGit(["init"], dir).status).toBe(0);
  expect(runGit(["config", "user.email", "t@t"], dir).status).toBe(0);
  expect(runGit(["config", "user.name", "t"], dir).status).toBe(0);
  expect(runCli(["init", dir], dir).status).toBe(0);
  expect(runCli(["create", "initiative", "Launch MVP"], dir).status).toBe(0);
  expect(runCli(["create", "epic", "Auth", "--parent", "launch-mvp"], dir).status).toBe(0);
  expect(runCli(["create", "epic", "Onboarding", "--parent", "launch-mvp"], dir).status).toBe(0);
  expect(
    runCli(["create", "story", "Login", "--parent", "auth", "--id", "story-login"], dir).status,
  ).toBe(0);
  expect(
    runCli(["create", "story", "Handbook", "--parent", "onboarding", "--id", "story-handbook"], dir)
      .status,
  ).toBe(0);
  expect(
    runCli(
      ["create", "task", "Add rate limiting", "--parent", "story-login", "--id", "task-rate-limit"],
      dir,
    ).status,
  ).toBe(0);
  return dir;
}

function taskPath(dir: string): string {
  return join(dir, "tasks", "launch-mvp", "auth", "story-login", "task-rate-limit.md");
}

describe("success stdout: update", () => {
  it("renders a hostile movedFrom path inert on the reparent line", () => {
    const dir = initTree();
    const hostilePath = join(dir, "tasks", "launch-mvp", "auth", "story-login", `${HOSTILE}.md`);
    renameSync(taskPath(dir), hostilePath);

    const proc = runCli(
      ["update", "task-rate-limit", "--parent", "story-handbook", "--no-commit"],
      dir,
    );
    expect(proc.status).toBe(0);
    // One inert physical line per value: no raw ESC/DEL/C1/LS/PS and no
    // forged column-0 line from the embedded newline.
    expect(proc.stdout).not.toMatch(UNSAFE);
    expect(proc.stdout).not.toContain("\nspoof");
    expect(proc.stderr).toBe("");

    const newPath = join(
      dir,
      "tasks",
      "launch-mvp",
      "onboarding",
      "story-handbook",
      "task-rate-limit.md",
    );
    const lines = proc.stdout.split("\n");
    expect(lines[0]).toBe("arggon update: task task-rate-limit (parent)");
    expect(lines[1]).toBe(`  ${newPath}`);
    expect(lines[2]).toBe(
      `  moved from: ${join(dir, "tasks", "launch-mvp", "auth", "story-login", `${HOSTILE_ESCAPED}.md`)}`,
    );
    expect(lines[3]).toBe("  no-commit: tasks dirty state kept");
    expect(lines[4]).toBe("");
  });

  it("keeps movedFrom raw in the --json envelope", () => {
    const dir = initTree();
    const hostilePath = join(dir, "tasks", "launch-mvp", "auth", "story-login", `${HOSTILE}.md`);
    renameSync(taskPath(dir), hostilePath);

    const proc = runCli(
      ["update", "task-rate-limit", "--parent", "story-handbook", "--no-commit", "--json"],
      dir,
    );
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as { movedFrom: string; item: { id: string } };
    expect(body.movedFrom).toBe(hostilePath);
    expect(body.item.id).toBe("task-rate-limit");
  });

  it("renders a hostile renamedFrom id inert on the promotion line", () => {
    const dir = initTree();
    // Frontmatter is line-oriented, so the hostile id carries ESC/DEL/C1/LS/PS
    // (no real newline); write the raw bytes directly — stringifyFrontmatter
    // would JSON-escape them into inert text before the CLI ever sees them.
    const hostileId = `task-${HOSTILE_SCALAR}`;
    writeFileSync(
      taskPath(dir),
      "---\n" +
        "type: task\n" +
        "status: todo\n" +
        `id: ${hostileId}\n` +
        "parent: story-login\n" +
        "created: 2026-09-14\n" +
        "updated: 2026-09-14\n" +
        "---\n\nbody\n",
      "utf8",
    );

    const proc = runCli(["update", hostileId, "--type", "story", "--no-commit"], dir);
    expect(proc.status).toBe(0);
    expect(proc.stdout).not.toMatch(UNSAFE);
    expect(proc.stdout).not.toContain("\nspoof");

    const newId = `story-${HOSTILE_SCALAR}`;
    const newPath = join(dir, "tasks", "launch-mvp", "auth", newId, `${newId}.md`);
    const lines = proc.stdout.split("\n");
    expect(lines[0]).toBe(
      `arggon update: story ${newId.replace(HOSTILE_SCALAR, HOSTILE_SCALAR_ESCAPED)} (type, parent, id)`,
    );
    expect(lines[1]).toBe(
      `  ${newPath.replaceAll(newId, newId.replace(HOSTILE_SCALAR, HOSTILE_SCALAR_ESCAPED))}`,
    );
    expect(lines[2]).toBe(`  moved from: ${taskPath(dir)}`);
    expect(lines[3]).toBe(
      `  renamed from id: ${hostileId.replace(HOSTILE_SCALAR, HOSTILE_SCALAR_ESCAPED)}`,
    );
    expect(lines[4]).toBe("  no-commit: tasks dirty state kept");
    expect(lines[5]).toBe("");
  });

  it("keeps renamedFrom raw in the --json envelope", () => {
    const dir = initTree();
    const hostileId = `task-${HOSTILE_SCALAR}`;
    writeFileSync(
      taskPath(dir),
      "---\n" +
        "type: task\n" +
        "status: todo\n" +
        `id: ${hostileId}\n` +
        "parent: story-login\n" +
        "created: 2026-09-14\n" +
        "updated: 2026-09-14\n" +
        "---\n\nbody\n",
      "utf8",
    );

    const proc = runCli(["update", hostileId, "--type", "story", "--no-commit", "--json"], dir);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as { renamedFrom: string; item: { id: string } };
    expect(body.renamedFrom).toBe(hostileId);
    expect(body.item.id).toBe(`story-${HOSTILE_SCALAR}`);
  });

  it("leaves ordinary update output byte-identical", () => {
    const dir = initTree();
    const proc = runCli(
      ["update", "task-rate-limit", "--parent", "story-handbook", "--no-commit"],
      dir,
    );
    expect(proc.status).toBe(0);
    const newPath = join(
      dir,
      "tasks",
      "launch-mvp",
      "onboarding",
      "story-handbook",
      "task-rate-limit.md",
    );
    expect(proc.stdout).toBe(
      "arggon update: task task-rate-limit (parent)\n" +
        `  ${newPath}\n` +
        `  moved from: ${taskPath(dir)}\n` +
        "  no-commit: tasks dirty state kept\n",
    );
    expect(proc.stderr).toBe("");
  });
});

describe("success stdout: other commands keep repo values inert", () => {
  it("next renders a hostile title inert; --json keeps it raw", () => {
    const dir = initTree();
    // A hostile title from a hand-edited item (no real newline: frontmatter is
    // line-oriented) must not leak controls through the next suggestion.
    const title = `Fake title ${HOSTILE_SCALAR}`;
    writeFileSync(
      join(dir, "tasks", "launch-mvp", "auth", "story-login", "task-evil.md"),
      "---\n" +
        "type: task\n" +
        "status: todo\n" +
        "id: task-evil\n" +
        `title: ${title}\n` +
        "parent: story-login\n" +
        "created: 2026-09-14\n" +
        "updated: 2026-09-14\n" +
        "---\n\nbody\n",
      "utf8",
    );

    const proc = runCli(["next"], dir);
    expect(proc.status).toBe(0);
    expect(proc.stdout).not.toMatch(UNSAFE);
    expect(proc.stdout).not.toContain("\nspoof");
    expect(proc.stdout).toContain(`arggon next: task-evil — Fake title ${HOSTILE_SCALAR_ESCAPED}`);

    const json = runCli(["next", "--json"], dir);
    expect(json.status).toBe(0);
    const body = JSON.parse(json.stdout) as { suggestion: { item: { id: string; title: string } } };
    expect(body.suggestion.item.id).toBe("task-evil");
    expect(body.suggestion.item.title).toBe(title);
  });

  it("re-escapes quotes and backslashes on the human line (pinning); --json keeps them raw", () => {
    // Boundary of the byte-identity claim: `sanitizeHumanError` JSON-escapes
    // `"` and `\` in place (escaping exactly as `JSON.stringify` would), so a
    // title using them renders escaped on the human line while `--json` keeps
    // the raw bytes. This pins the escape boundary of the shared human policy.
    const dir = initTree();
    const title = 'Fix "quoted" \\ thing';
    writeFileSync(
      join(dir, "tasks", "launch-mvp", "auth", "story-login", "task-quotes.md"),
      "---\n" +
        "type: task\n" +
        "status: todo\n" +
        "id: task-quotes\n" +
        `title: ${title}\n` +
        "parent: story-login\n" +
        "created: 2026-09-14\n" +
        "updated: 2026-09-14\n" +
        "---\n\nbody\n",
      "utf8",
    );

    const proc = runCli(["next"], dir);
    expect(proc.status).toBe(0);
    expect(proc.stdout).toContain('arggon next: task-quotes — Fix \\"quoted\\" \\\\ thing');
    expect(proc.stderr).toBe("");

    const json = runCli(["next", "--json"], dir);
    expect(json.status).toBe(0);
    const body = JSON.parse(json.stdout) as { suggestion: { item: { title: string } } };
    expect(body.suggestion.item.title).toBe(title);
  });

  it("leaves an ordinary (longer-than-200-chars) next rationale byte-identical", () => {
    // The `why` line is ~330 chars: the 200-char report-value cap would clip
    // it, breaking ordinary byte-identity. The success channel uses the
    // composite-diagnostic cap, so the whole sentence (and its tail) survives.
    const dir = initTree();
    const proc = runCli(["next"], dir);
    expect(proc.status).toBe(0);
    const why = proc.stdout.split("\n")[2]!;
    expect(why).not.toMatch(/…$/);
    expect(why).toContain("stories excluded by default (--include-stories to include them))");
  });

  it("create prints an ordinary path byte-identically", () => {
    const dir = initTree();
    const proc = runCli(
      ["create", "task", "Plain work", "--parent", "story-login", "--no-commit"],
      dir,
    );
    expect(proc.status).toBe(0);
    const path = join(dir, "tasks", "launch-mvp", "auth", "story-login", "task-plain-work.md");
    expect(proc.stdout).toBe(
      "arggon create: task task-plain-work\n" +
        `  ${path}\n` +
        "  no-commit: tasks dirty state kept\n",
    );
  });
});

describe("success stdout: spec baseline argv paths", () => {
  /** Minimal spec repo (same skeleton as spec-baseline.test.ts). */
  function makeRepo(): string {
    const dir = mkdtempSync(join(tmpdir(), "arggon-success-baseline-"));
    mkdirSync(join(dir, "tasks"), { recursive: true });
    writeFileSync(join(dir, "tasks", ".convention.yml"), "version: 0\n", "utf8");
    mkdirSync(join(dir, "docs", "specs"), { recursive: true });
    writeFileSync(
      join(dir, "docs", "specs", "spec-a-001.md"),
      "---\nspec_id: a-001\ntitle: T\nstatus: proposed\ncreated: 2026-09-16\n---\n\n" +
        "# Spec: t (a-001)\n\n## Purpose\n\nWhy it exists.\n\n" +
        "## Synopsis\n\n```bash\narggon x\n```\n\nOn error the command exits 1.\n\n" +
        "## Acceptance\n\n- [x] works\n",
      "utf8",
    );
    return dir;
  }

  it("renders a hostile --save-baseline path inert; --json keeps it raw", () => {
    const dir = makeRepo();
    const hostileFile = join(dir, `${HOSTILE}.json`);

    const proc = runCli(["spec", "analyze", "--save-baseline", hostileFile], dir);
    expect(proc.status).toBe(0);
    expect(proc.stdout).not.toMatch(UNSAFE);
    expect(proc.stdout).not.toContain("\nspoof");
    expect(existsSync(hostileFile)).toBe(true);
    expect(proc.stdout).toBe(
      `arggon spec analyze: baseline written to ${join(dir, `${HOSTILE_ESCAPED}.json`)} ` +
        "(0 finding(s) across 1 spec(s))\n",
    );

    const json = runCli(["spec", "analyze", "--save-baseline", hostileFile, "--json"], dir);
    expect(json.status).toBe(0);
    const body = JSON.parse(json.stdout) as { baseline: { file: string; written: boolean } };
    expect(body.baseline.written).toBe(true);
    expect(body.baseline.file).toBe(hostileFile);
  });

  it("renders a hostile --baseline path inert on the comparison line", () => {
    const dir = makeRepo();
    const hostileFile = join(dir, `${HOSTILE}.json`);
    expect(runCli(["spec", "analyze", "--save-baseline", hostileFile], dir).status).toBe(0);

    const proc = runCli(["spec", "analyze", "--baseline", hostileFile], dir);
    expect(proc.status).toBe(0);
    expect(proc.stdout).not.toMatch(UNSAFE);
    expect(proc.stdout).not.toContain("\nspoof");
    expect(proc.stdout).toContain(
      `arggon spec analyze vs baseline ${join(dir, `${HOSTILE_ESCAPED}.json`)}: `,
    );

    const json = runCli(["spec", "analyze", "--baseline", hostileFile, "--json"], dir);
    expect(json.status).toBe(0);
    const body = JSON.parse(json.stdout) as { baseline: { file: string } };
    expect(body.baseline.file).toBe(hostileFile);
  });

  it("leaves an ordinary baseline path byte-identical", () => {
    const dir = makeRepo();
    const file = join(dir, "baseline.json");
    const save = runCli(["spec", "analyze", "--save-baseline", file], dir);
    expect(save.status).toBe(0);
    expect(save.stdout).toBe(
      `arggon spec analyze: baseline written to ${file} (0 finding(s) across 1 spec(s))\n`,
    );
    // The snapshot is committed JSON: reading it back must not be affected.
    const cmp = runCli(["spec", "analyze", "--baseline", file], dir);
    expect(cmp.status).toBe(0);
    expect(cmp.stdout).toBe(
      `arggon spec analyze vs baseline ${file}: 0 new, 0 resolved, 0 unchanged, 0 total\n`,
    );
    expect(JSON.parse(readFileSync(file, "utf8"))).toMatchObject({ count: 0 });
  });
});
