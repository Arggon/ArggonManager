import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  normalizeForZeroLoss,
  openspecAdapter,
  runSpecImport,
  SpecImportError,
} from "./spec-import.js";
import { runSpecValidate } from "./spec.js";

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string): string {
  const dir = _mkdtempSync(prefix);
  tmpDirs.push(dir);
  return dir;
}

/** Temp repo skeleton: only what findTasksDir needs (tasks/.convention.yml). */
function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-spec-import-"));
  mkdirSync(join(dir, "tasks"), { recursive: true });
  writeFileSync(join(dir, "tasks", ".convention.yml"), "version: 0\n", "utf8");
  return dir;
}

const GOLDEN_SPEC_MD = `# auth-core specification

## Purpose

Provide authentication primitives for the platform: sessions, tokens, and
password hashing.

## Requirements

### Requirement: Session lifecycle

The system SHALL create a session on login and expire it after 24 hours of
inactivity.

#### Scenario: Successful login

- **Given** a registered user with valid credentials
- **When** the user logs in
- **Then** a session is created and a cookie is set

#### Scenario: Expired session

- **Given** a session idle for more than 24 hours
- **When** the user makes a request
- **Then** the session is rejected with 401

### Requirement: Password hashing

The system SHALL store only salted bcrypt hashes of passwords.

#### Scenario: Password storage

- **Given** a new user signs up
- **When** the password is persisted
- **Then** only the bcrypt hash is stored, never the plaintext
`;

/** Write a capability's spec.md into a corpus under `dir`. */
function writeCapability(corpusDir: string, capability: string, content: string): void {
  const dir = join(corpusDir, "specs", capability);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "spec.md"), content, "utf8");
}

describe("normalizeForZeroLoss", () => {
  it("trims trailing whitespace, collapses blank runs, and trims ends", () => {
    expect(normalizeForZeroLoss("  a  \n\n\n\nb\n\n")).toBe("  a\n\nb");
    expect(normalizeForZeroLoss("a\r\nb\r\n")).toBe("a\nb");
    expect(normalizeForZeroLoss("")).toBe("");
  });
});

describe("spec import openspec — golden mapping", () => {
  it("maps Purpose and Requirements verbatim with checklists and provenance", () => {
    const repo = makeRepo();
    const corpus = mkdtempSync(join(tmpdir(), "arggon-corpus-"));
    writeCapability(corpus, "auth-core", GOLDEN_SPEC_MD);

    const result = runSpecImport({ cwd: repo, path: corpus, today: "2026-09-16" });
    expect(result.created).toEqual([
      {
        capability: "auth-core",
        file: "docs/specs/spec-auth-core-001.md",
        specId: "auth-core-001",
        source: "specs/auth-core/spec.md",
      },
    ]);

    const doc = readFileSync(join(repo, "docs", "specs", "spec-auth-core-001.md"), "utf8");
    expect(doc).toContain("spec_id: auth-core-001");
    expect(doc).toContain("status: proposed");
    expect(doc).toContain("Provide authentication primitives");
    // Requirements copied verbatim (Given/When/Then preserved)
    expect(doc).toContain("### Requirement: Session lifecycle");
    expect(doc).toContain("- **Given** a registered user with valid credentials");
    expect(doc).toContain("- **Then** the session is rejected with 401");
    // One checklist per requirement, one checkbox per scenario
    expect(doc.match(/### Verification checklist/g)?.length).toBe(2);
    expect(doc).toContain("- [ ] Scenario: Successful login");
    expect(doc).toContain("- [ ] Scenario: Expired session");
    // Provenance line
    expect(doc).toContain(
      "*Source: specs/auth-core/spec.md — migrated 2026-09-16 via arggon spec import openspec.*",
    );
  });

  it("produces docs that pass spec validate with zero errors", () => {
    const repo = makeRepo();
    const corpus = mkdtempSync(join(tmpdir(), "arggon-corpus-"));
    writeCapability(corpus, "auth-core", GOLDEN_SPEC_MD);
    runSpecImport({ cwd: repo, path: corpus, today: "2026-09-16" });
    const validation = runSpecValidate({ cwd: repo });
    expect(validation.errors).toEqual([]);
  });

  it("numbers consecutive capabilities in sorted order", () => {
    const repo = makeRepo();
    const corpus = mkdtempSync(join(tmpdir(), "arggon-corpus-"));
    for (const name of ["zeta", "alpha", "mid"]) {
      writeCapability(corpus, name, GOLDEN_SPEC_MD.replace("auth-core", name));
    }
    writeCapability(corpus, "unrelated", GOLDEN_SPEC_MD); // never sorted first
    const result = runSpecImport({ cwd: repo, path: corpus, today: "2026-09-16" });
    expect(result.created.map((e) => e.file)).toEqual([
      "docs/specs/spec-alpha-001.md",
      "docs/specs/spec-mid-002.md",
      "docs/specs/spec-unrelated-003.md",
      "docs/specs/spec-zeta-004.md",
    ]);
  });

  it("continues the global numbering after existing specs/plans", () => {
    const repo = makeRepo();
    mkdirSync(join(repo, "docs", "plans"), { recursive: true });
    writeFileSync(join(repo, "docs", "plans", "plan-seed-006.md"), "# Plan\n", "utf8");
    const corpus = mkdtempSync(join(tmpdir(), "arggon-corpus-"));
    writeCapability(corpus, "auth-core", GOLDEN_SPEC_MD);
    const result = runSpecImport({ cwd: repo, path: corpus, today: "2026-09-16" });
    expect(result.created[0]!.file).toBe("docs/specs/spec-auth-core-007.md");
  });
});

describe("spec import openspec — zero-loss", () => {
  it("fails loudly with a per-file diff on a mutated source and writes nothing", () => {
    const repo = makeRepo();
    const corpus = mkdtempSync(join(tmpdir(), "arggon-corpus-"));
    // Mutate with preamble prose after the H1: the section shape still parses
    // (only Purpose/Requirements), but the paragraph is dropped by the mapping,
    // so this hits the zero-loss mismatch path with a real diff. (An
    // unsupported `## Extra` section fails earlier, at parse.)
    writeCapability(
      corpus,
      "broken",
      GOLDEN_SPEC_MD.replace(
        "\n## Purpose",
        "\nStray preamble paragraph the mapper must not drop.\n\n## Purpose",
      ),
    );
    let error: unknown;
    try {
      runSpecImport({ cwd: repo, path: corpus, today: "2026-09-16" });
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(SpecImportError);
    const failure = (error as SpecImportError).failures[0]!;
    expect(failure.capability).toBe("broken");
    expect(failure.message).toMatch(/zero-loss mismatch/);
    expect(failure.diff?.some((line) => line.includes("Stray preamble"))).toBe(true);
    expect(existsSync(join(repo, "docs", "specs"))).toBe(false);
  });
});

describe("spec import openspec — all-or-nothing", () => {
  it("writes zero files when one file among several fails", () => {
    const repo = makeRepo();
    const corpus = mkdtempSync(join(tmpdir(), "arggon-corpus-"));
    writeCapability(corpus, "good-a", GOLDEN_SPEC_MD);
    writeCapability(corpus, "bad", `${GOLDEN_SPEC_MD}\n## Extra\n\nmystery content\n`);
    writeCapability(corpus, "good-b", GOLDEN_SPEC_MD);
    expect(() => runSpecImport({ cwd: repo, path: corpus, today: "2026-09-16" })).toThrow(
      SpecImportError,
    );
    expect(existsSync(join(repo, "docs", "specs"))).toBe(false);
  });
});

describe("spec import openspec — collision refusal", () => {
  it("refuses to overwrite an existing target file and writes nothing", () => {
    const repo = makeRepo();
    const corpus = mkdtempSync(join(tmpdir(), "arggon-corpus-"));
    writeCapability(corpus, "auth-core", GOLDEN_SPEC_MD);
    writeCapability(corpus, "other", GOLDEN_SPEC_MD.replace("auth-core", "other"));

    // Simulate the race where the target file appears after numbering: the
    // first planned file collides with a pre-existing spec.
    const docsDir = join(repo, "docs", "specs");
    mkdirSync(docsDir, { recursive: true });
    const existing = "# Spec: pre-existing\n";
    writeFileSync(join(docsDir, "spec-auth-core-001.md"), existing, "utf8");

    let threw: unknown;
    try {
      runSpecImport({ cwd: repo, path: corpus, today: "2026-09-16", startNumber: 1 });
    } catch (err) {
      threw = err;
    }
    expect(threw).toBeInstanceOf(SpecImportError);
    const collision = (threw as SpecImportError).failures.find((f) =>
      f.message.includes("refusing to overwrite"),
    );
    expect(collision?.message).toContain("spec-auth-core-001.md");
    // Nothing was (over)written, not even for the non-colliding capability.
    expect(readFileSync(join(docsDir, "spec-auth-core-001.md"), "utf8")).toBe(existing);
    expect(existsSync(join(docsDir, "spec-other-002.md"))).toBe(false);
  });

  it("rejects non-kebab-case capability directories before writing", () => {
    const repo = makeRepo();
    const corpus = mkdtempSync(join(tmpdir(), "arggon-corpus-"));
    writeCapability(corpus, "Bad_Cap", GOLDEN_SPEC_MD);
    expect(() => runSpecImport({ cwd: repo, path: corpus, today: "2026-09-16" })).toThrow(
      SpecImportError,
    );
    expect(existsSync(join(repo, "docs", "specs"))).toBe(false);
  });
});

describe("spec import openspec — dry run", () => {
  it("inventories files, previews the mapping plan, and writes nothing", () => {
    const repo = makeRepo();
    const corpus = mkdtempSync(join(tmpdir(), "arggon-corpus-"));
    writeCapability(corpus, "auth-core", GOLDEN_SPEC_MD);
    writeCapability(corpus, "billing", GOLDEN_SPEC_MD.replace("auth-core", "billing"));

    const docsBefore = existsSync(join(repo, "docs"))
      ? JSON.stringify(readdirSync(join(repo, "docs")))
      : null;
    const result = runSpecImport({ cwd: repo, path: corpus, dryRun: true, today: "2026-09-16" });
    expect(result.dryRun).toBe(true);
    expect(result.created).toEqual([]);
    expect(result.inventory.map((e) => e.file)).toEqual([
      "docs/specs/spec-auth-core-001.md",
      "docs/specs/spec-billing-002.md",
    ]);
    // Nothing written at all
    if (docsBefore === null) {
      expect(existsSync(join(repo, "docs"))).toBe(false);
    } else {
      expect(JSON.stringify(readdirSync(join(repo, "docs")))).toBe(docsBefore);
    }
    // A subsequent real import produces the same plan and succeeds
    const real = runSpecImport({ cwd: repo, path: corpus, today: "2026-09-16" });
    expect(real.created.map((e) => e.file)).toEqual(result.inventory.map((e) => e.file));
  });
});

describe("spec import openspec — CLI wiring (e2e)", () => {
  // Regression: `.command("import openspec")` bound the literal "openspec" to
  // the handler's first positional and silently ignored the real <path>. These
  // tests exercise the commander wiring end-to-end, not just runSpecImport.
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const cli = resolve(root, "cli/src/cli.ts");
  const tsx = resolve(root, "node_modules/tsx/dist/cli.mjs");
  function runCli(args: string[], cwd: string) {
    return spawnSync(process.execPath, [tsx, cli, ...args], { encoding: "utf8", cwd });
  }
  function makeCorpus(): string {
    const corpus = mkdtempSync(join(tmpdir(), "arggon-corpus-"));
    writeCapability(corpus, "auth-core", GOLDEN_SPEC_MD);
    writeCapability(corpus, "billing", GOLDEN_SPEC_MD.replace("auth-core", "billing"));
    return corpus;
  }

  it("creates the mapped specs through the real CLI", () => {
    const repo = makeRepo();
    const corpus = makeCorpus();
    const proc = runCli(["spec", "import", "openspec", corpus], repo);
    expect(proc.status).toBe(0);
    expect(proc.stdout).toContain("created 2 file(s)");
    expect(existsSync(join(repo, "docs", "specs", "spec-auth-core-001.md"))).toBe(true);
    expect(existsSync(join(repo, "docs", "specs", "spec-billing-002.md"))).toBe(true);
  });

  it("emits a success envelope with created entries (--json)", () => {
    const repo = makeRepo();
    const corpus = makeCorpus();
    const proc = runCli(["spec", "import", "openspec", corpus, "--json"], repo);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as {
      ok: boolean;
      command: string;
      created: Array<{ specId: string }>;
    };
    expect(body.ok).toBe(true);
    expect(body.command).toBe("spec");
    expect(body.created.map((e) => e.specId)).toEqual(["auth-core-001", "billing-002"]);
  });

  it("dry-run via the CLI writes nothing and reports the inventory", () => {
    const repo = makeRepo();
    const corpus = makeCorpus();
    const proc = runCli(["spec", "import", "openspec", corpus, "--dry-run", "--json"], repo);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as {
      dryRun: boolean;
      inventory: Array<{ file: string }>;
    };
    expect(body.dryRun).toBe(true);
    expect(body.inventory).toHaveLength(2);
    expect(existsSync(join(repo, "docs"))).toBe(false);
  });

  it("rejects an unsupported format with SPEC_IMPORT_FAILED", () => {
    const repo = makeRepo();
    const corpus = makeCorpus();
    const proc = runCli(["spec", "import", "raindrops", corpus, "--json"], repo);
    expect(proc.status).toBe(1);
    const body = JSON.parse(proc.stdout) as {
      ok: boolean;
      error: { code: string; message: string };
    };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("SPEC_IMPORT_FAILED");
    expect(body.error.message).toContain("supported: openspec");
    expect(existsSync(join(repo, "docs"))).toBe(false);
  });

  it("reports a zero-loss failure through the CLI with per-file diffs and writes nothing", () => {
    const repo = makeRepo();
    const corpus = mkdtempSync(join(tmpdir(), "arggon-corpus-"));
    // Preamble prose between the H1 and the first H2: accepted by the parser
    // shape (only Purpose/Requirements sections) but dropped by the mapping,
    // so this exercises the zero-loss mismatch path with a real line diff
    // (an unsupported `## Extra` section would fail earlier, at parse).
    writeCapability(
      corpus,
      "broken",
      GOLDEN_SPEC_MD.replace(
        "\n## Purpose",
        "\nStray preamble paragraph the mapper must not drop.\n\n## Purpose",
      ),
    );
    const proc = runCli(["spec", "import", "openspec", corpus, "--json"], repo);
    expect(proc.status).toBe(1);
    const body = JSON.parse(proc.stdout) as {
      ok: boolean;
      error: { code: string };
      failures: Array<{ capability: string; diff?: string[] }>;
    };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("SPEC_IMPORT_FAILED");
    expect(body.failures[0]!.capability).toBe("broken");
    expect(body.failures[0]!.diff?.some((line) => line.includes("Stray preamble"))).toBe(true);
    expect(existsSync(join(repo, "docs"))).toBe(false);
  });
});

describe("spec import openspec — adapter extension point", () => {
  it("runs a custom adapter unchanged through the shared orchestration", () => {
    const repo = makeRepo();
    const corpus = mkdtempSync(join(tmpdir(), "arggon-corpus-"));
    mkdirSync(join(corpus, "notes"), { recursive: true });
    writeFileSync(
      join(corpus, "notes", "widget.md"),
      "# widget\n\nWhy: widgets exist.\n\nMusts: be round.\n",
      "utf8",
    );
    const custom = {
      format: "notes",
      discover: (root: string) => [
        {
          capability: "widget",
          absPath: join(root, "notes", "widget.md"),
          sourceRel: "notes/widget.md",
        },
      ],
      parse: (raw: string) => ({
        purpose: `Why: ${raw.split("Why: ")[1]!.split("\n")[0]!}`,
        requirements: raw.split("Musts: ")[1]!.trim(),
      }),
      // The raw body is flat prose, not `## ` sections — the source side of
      // the zero-loss comparison reconstructs from parsed instead.
      assembleSource: (_raw: string, parsed: { purpose: string; requirements: string }) =>
        `## Purpose\n\n${parsed.purpose}\n\n## Requirements\n\n${parsed.requirements}`,
      map: (
        parsed: { purpose: string; requirements: string },
        meta: {
          specId: string;
          title: string;
          date: string;
          sourceRel: string;
          capability: string;
        },
      ) => openspecAdapter.map(parsed, meta),
    };
    const result = runSpecImport({ cwd: repo, path: corpus, adapter: custom, today: "2026-09-16" });
    expect(result.created[0]!.file).toBe("docs/specs/spec-widget-001.md");
    const doc = readFileSync(join(repo, "docs", "specs", "spec-widget-001.md"), "utf8");
    expect(doc).toContain("Why: widgets exist.");
    expect(doc).toContain("be round.");
    expect(doc).toContain("- [ ] Requirement verified as stated above.");
  });
});
