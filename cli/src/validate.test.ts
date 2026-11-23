import {
  cpSync,
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runValidate } from "@arggondev/lib";
import { runCli } from "./test-spawn.js";

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string, options?: { encoding?: "utf8" }): string {
  const dir = _mkdtempSync(prefix, options);
  tmpDirs.push(dir);
  return dir;
}

const fixtures = join(process.cwd(), "fixtures");
const invalidRoot = join(fixtures, "tasks-invalid");

function invalidCases(): string[] {
  return readdirSync(invalidRoot).filter((name) => {
    if (name === "README.md") return false;
    return statSync(join(invalidRoot, name)).isDirectory();
  });
}

describe("validate", () => {
  it("passes the minimal valid fixture", () => {
    const result = runValidate({ cwd: join(fixtures, "tasks-valid/minimal") });
    expect(result.errors).toEqual([]);
  });

  it("passes the sample launch-mvp tree", () => {
    const result = runValidate({ cwd: process.cwd() });
    expect(result.errors).toEqual([]);
  });

  it("passes fixtures/tasks-valid golden tree", () => {
    const result = runValidate({ cwd: join(fixtures, "tasks-valid") });
    expect(result.errors).toEqual([]);
  });

  it.each(invalidCases())("rejects invalid fixture %s", (name) => {
    const result = runValidate({ cwd: join(invalidRoot, name) });
    expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
  });

  it("reports missing parent with PARENT_MISSING", () => {
    const result = runValidate({ cwd: join(invalidRoot, "parent-missing") });
    expect(result.errors.some((e) => e.code === "PARENT_MISSING")).toBe(true);
  });

  it("reports unknown status with UNKNOWN_STATUS", () => {
    const result = runValidate({ cwd: join(invalidRoot, "bad-status") });
    expect(result.errors.some((e) => e.code === "UNKNOWN_STATUS")).toBe(true);
  });

  it("reports broken yaml with file path", () => {
    const result = runValidate({ cwd: join(invalidRoot, "broken-yaml") });
    expect(result.errors.some((e) => e.code === "BROKEN_YAML")).toBe(true);
    expect(result.errors.find((e) => e.code === "BROKEN_YAML")?.path).toContain("y.md");
  });

  it("reports missing container index", () => {
    const result = runValidate({ cwd: join(invalidRoot, "missing-index") });
    expect(result.errors.some((e) => e.code === "MISSING_INDEX")).toBe(true);
  });

  // bug-validate-does-not-check-frontmatter-present: the structural cases. A
  // validator that checks the CONTENT of a structure must also check that the
  // structure EXISTS — these are the shapes that used to report `ok`.
  it("reports a deleted frontmatter block on an item file, naming the file", () => {
    const result = runValidate({ cwd: join(invalidRoot, "missing-frontmatter") });
    const issue = result.errors.find((e) => e.code === "MISSING_FRONTMATTER");
    expect(issue).toBeDefined();
    expect(issue?.path).toBe("tasks/demo/e1/s1/task-wiped.md");
  });

  it("reports a deleted frontmatter block on a container index, naming the file", () => {
    const result = runValidate({ cwd: join(invalidRoot, "missing-frontmatter-index") });
    const issue = result.errors.find((e) => e.code === "MISSING_FRONTMATTER");
    expect(issue?.path).toBe("tasks/demo/e1/s1/s1.md");
  });

  it("reports an unterminated frontmatter block as its own code", () => {
    const result = runValidate({ cwd: join(invalidRoot, "unterminated-frontmatter") });
    const issue = result.errors.find((e) => e.code === "UNTERMINATED_FRONTMATTER");
    expect(issue).toBeDefined();
    expect(issue?.path).toBe("tasks/demo/e1/s1/task-open.md");
  });

  it("reports a zero-byte item file (no block at all)", () => {
    const result = runValidate({ cwd: join(invalidRoot, "empty-item-file") });
    const issue = result.errors.find((e) => e.code === "MISSING_FRONTMATTER");
    expect(issue?.path).toBe("tasks/demo/e1/s1/task-empty.md");
  });

  // The no-false-positive half of the rule: requiring a block is only safe
  // because it applies to item POSITIONS, so an ordinary Markdown file that the
  // layout reserves nothing for must stay silently ignored (as before).
  it("does not demand frontmatter from a .md outside an item position", () => {
    const result = runValidate({ cwd: join(invalidRoot, "non-item-markdown") });
    expect(result.errors.filter((e) => e.code === "MISSING_FRONTMATTER")).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("reports invalid branch with INVALID_BRANCH", () => {
    const result = runValidate({ cwd: join(invalidRoot, "invalid-branch") });
    expect(result.errors.some((e) => e.code === "INVALID_BRANCH")).toBe(true);
  });

  it("reports bad branch_patterns with INVALID_BRANCH_PATTERN", () => {
    const result = runValidate({ cwd: join(invalidRoot, "invalid-branch-patterns") });
    expect(result.errors.some((e) => e.code === "INVALID_BRANCH_PATTERN")).toBe(true);
  });
});

// bug-validate-stdout-injection M1: the human report interpolates
// repo-controlled paths/messages (hostile filename, frontmatter values), so
// each line is display-sanitized on stdout; exit codes and --json are untouched.
describe("validate human output sanitization (bug-validate-stdout-injection)", () => {
  const HOSTILE = "bad\nspoof: fake item\u001b[31m\u0085\u007f\u2028\u2029.md";

  /** Minimal tracker with one item whose FILE NAME carries the hostile bytes. */
  function hostileRepo(): string {
    const dir = mkdtempSync(join(tmpdir(), "arggon-validate-"));
    mkdirSync(join(dir, "tasks"), { recursive: true });
    writeFileSync(join(dir, "tasks", ".convention.yml"), "version: 0\n", "utf8");
    writeFileSync(
      join(dir, "tasks", HOSTILE),
      "---\ntype: task\nid: task-bad\nstatus: bogus\n---\nbody\n",
      "utf8",
    );
    return dir;
  }

  it("renders a hostile item filename inert on stdout (exit code unchanged)", () => {
    const dir = hostileRepo();
    const proc = runCli(["validate"], dir);
    expect(proc.status).toBe(1);
    // One inert physical line per issue: no raw ESC/DEL/C1/LS/PS and no
    // forged column-0 line from the embedded newline.
    expect(proc.stdout).not.toContain("\u001b");
    expect(proc.stdout).not.toContain("\u0085");
    expect(proc.stdout).not.toContain("\u007f");
    expect(proc.stdout).not.toContain("\u2028");
    expect(proc.stdout).not.toContain("\u2029");
    expect(proc.stdout).not.toContain("\nspoof");
    expect(proc.stdout).toContain(
      "error tasks/bad\\nspoof: fake item\\u001b[31m\\u0085\\u007f\\u2028\\u2029.md: unknown status 'bogus' [UNKNOWN_STATUS]",
    );
    expect(proc.stderr).toBe("");
  });

  it("--json keeps the raw hostile path, stays valid, exit code unchanged", () => {
    const dir = hostileRepo();
    const proc = runCli(["validate", "--json"], dir);
    expect(proc.status).toBe(1);
    const body = JSON.parse(proc.stdout) as {
      ok: boolean;
      errors: { path: string; code: string }[];
      error: { code: string };
    };
    expect(body.ok).toBe(false);
    expect(body.errors.some((e) => e.path.includes(HOSTILE))).toBe(true);
    expect(body.error.code).toBe("VALIDATE_FAILED");
  });

  it("leaves ordinary (non-hostile) error lines byte-identical", () => {
    const proc = runCli(["validate"], join(invalidRoot, "bad-status"));
    expect(proc.status).toBe(1);
    expect(proc.stdout).toBe(
      "error tasks/x/x.md: unknown status 'shipping' [UNKNOWN_STATUS]\n" +
        "warning tasks: tracker uses the legacy tasks/ layout — run `arggon migrate --layout` to move it to ArggonManager/ (docs included) [LEGACY_LAYOUT]\n" +
        "arggon validate: failed with 1 error(s), 1 warning(s)\n",
    );
  });
});

// task-validate-missing-frontmatter-command-surface-assertions: the structural
// cases above all call the library's runValidate. A command-surface regression
// (generic throw, dropped code, envelope replaced by human output) would keep
// them green, so spawn the real CLI on a fixture COPY and assert the declared
// envelope: ArggonManager/docs/json-output.md §`validate` / §`validate` failure
// and the codes declared in ArggonManager/docs/convention.md — not this item's
// prose. runCli is the same command surface as `dist/cli.js validate --json`
// (same cli.ts entry), without depending on a built artifact in the test tree.
describe("validate command surface for missing frontmatter (task-validate-missing-frontmatter-command-surface-assertions)", () => {
  type Issue = { code: string; path: string; message: string };
  type ValidateEnvelope = {
    ok: boolean;
    command: string;
    errors: Issue[];
    error?: { code: string };
  };

  function runValidateCommand(fixtureName: string) {
    const dir = mkdtempSync(join(tmpdir(), "arggon-validate-command-"));
    cpSync(join(invalidRoot, fixtureName), dir, { recursive: true });
    const proc = runCli(["validate", "--json"], dir);
    expect(proc.stderr).toBe("");
    return { proc, body: JSON.parse(proc.stdout) as ValidateEnvelope };
  }

  it("emits MISSING_FRONTMATTER with the offending path and a non-zero exit", () => {
    const { proc, body } = runValidateCommand("missing-frontmatter");
    expect(proc.status).toBe(1);
    expect(body.command).toBe("validate");
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("VALIDATE_FAILED");
    // Whole-code equality: a BROKEN_YAML fallback (or a renamed code) is a
    // regression, not a passing test.
    expect(body.errors.map((e) => e.code)).toEqual(["MISSING_FRONTMATTER"]);
    expect(body.errors[0]?.path).toBe("tasks/demo/e1/s1/task-wiped.md");
  });

  it("emits UNTERMINATED_FRONTMATTER as its own code at the command surface", () => {
    const { proc, body } = runValidateCommand("unterminated-frontmatter");
    expect(proc.status).toBe(1);
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("VALIDATE_FAILED");
    expect(body.errors.map((e) => e.code)).toEqual(["UNTERMINATED_FRONTMATTER"]);
    expect(body.errors[0]?.path).toBe("tasks/demo/e1/s1/task-open.md");
  });

  it("exits 0 on a non-item markdown file (the command check does not over-fire)", () => {
    const { proc, body } = runValidateCommand("non-item-markdown");
    expect(proc.status).toBe(0);
    expect(body.ok).toBe(true);
    expect(body.errors).toEqual([]);
    expect(body.error).toBeUndefined();
  });

  it("asserts the codes against the declared authority, not the item prose", () => {
    const convention = readFileSync(
      join(process.cwd(), "ArggonManager/docs/convention.md"),
      "utf8",
    );
    expect(convention).toContain("MISSING_FRONTMATTER");
    expect(convention).toContain("UNTERMINATED_FRONTMATTER");
    const envelope = readFileSync(join(process.cwd(), "ArggonManager/docs/json-output.md"), "utf8");
    expect(envelope).toContain('"code": "VALIDATE_FAILED"');
  });
});
