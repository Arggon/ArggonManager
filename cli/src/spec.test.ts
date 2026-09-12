import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runSpecNew, runSpecValidate } from "./spec.js";

const repoRoot = process.cwd();

/** Temp repo skeleton: only what findTasksDir needs (tasks/.convention.yml). */
function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-spec-"));
  mkdirSync(join(dir, "tasks"), { recursive: true });
  writeFileSync(join(dir, "tasks", ".convention.yml"), "version: 0\n", "utf8");
  return dir;
}

/** Copy the repo's real spec/plan docs into a temp tree (validator is read-only). */
function copyRealDocs(dir: string): void {
  mkdirSync(join(dir, "docs", "specs"), { recursive: true });
  mkdirSync(join(dir, "docs", "plans"), { recursive: true });
  for (const name of ["spec-deps-001.md", "spec-sync-001.md"]) {
    writeFileSync(
      join(dir, "docs", "specs", name),
      readFileSync(join(repoRoot, "docs", "specs", name), "utf8"),
      "utf8",
    );
  }
  for (const name of ["plan-deps-001.md", "plan-sync-001.md"]) {
    writeFileSync(
      join(dir, "docs", "plans", name),
      readFileSync(join(repoRoot, "docs", "plans", name), "utf8"),
      "utf8",
    );
  }
}

/** Write a spec doc with the given frontmatter overrides / body. */
function writeSpec(
  dir: string,
  name: string,
  frontmatter: Record<string, string>,
  body = "# Spec: t\n\n## Purpose\n\nwhy\n\n## Synopsis\n\nusage\n\n## Acceptance\n\n- [x] done\n",
): string {
  const dirPath = join(dir, "docs", "specs");
  mkdirSync(dirPath, { recursive: true });
  const fm = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const path = join(dirPath, name);
  writeFileSync(path, `---\n${fm}\n---\n\n${body}`, "utf8");
  return path;
}

function writePlan(dir: string, name: string, frontmatter: Record<string, string>): string {
  const dirPath = join(dir, "docs", "plans");
  mkdirSync(dirPath, { recursive: true });
  const fm = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const path = join(dirPath, name);
  writeFileSync(path, `---\n${fm}\n---\n\n# Plan: t\n\n## Tasks\n`, "utf8");
  return path;
}

const validSpecFm: Record<string, string> = {
  spec_id: "foo-001",
  title: "Foo",
  status: "proposed",
  created: "2026-09-11",
};

const validPlanFm = (specPath: string): Record<string, string> => ({
  plan_id: "foo-001",
  title: "Foo plan",
  spec: specPath,
  status: "implemented",
  created: "2026-09-11",
});

describe("spec validate (real docs)", () => {
  it("passes on this repo's real docs/specs and docs/plans", () => {
    const result = runSpecValidate({ cwd: repoRoot });
    expect(result.errors).toEqual([]);
    expect(result.checked).toBeGreaterThanOrEqual(4);
  });

  it("passes on copies of the real spec-deps-001 / spec-sync-001 and plans", () => {
    const dir = makeRepo();
    copyRealDocs(dir);
    const result = runSpecValidate({ cwd: dir });
    expect(result.errors).toEqual([]);
    expect(result.checked).toBe(4);
  });
});

describe("spec validate (error codes)", () => {
  it("reports missing frontmatter with SPEC_MISSING_FRONTMATTER", () => {
    const dir = makeRepo();
    const path = join(dir, "docs", "specs");
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, "spec-nofm-001.md"), "# no frontmatter\n", "utf8");
    const result = runSpecValidate({ cwd: dir });
    expect(result.errors.map((e) => e.code)).toContain("SPEC_MISSING_FRONTMATTER");
  });

  it("reports each missing required field with SPEC_MISSING_FIELD", () => {
    const dir = makeRepo();
    for (const field of ["spec_id", "title", "status", "created"]) {
      const fm = { ...validSpecFm };
      delete fm[field];
      writeSpec(dir, `spec-missing-${field}-001.md`, fm);
      const result = runSpecValidate({ cwd: dir });
      const hits = result.errors.filter((e) => e.code === "SPEC_MISSING_FIELD");
      expect(hits.some((e) => e.message.includes(`'${field}'`)), field).toBe(true);
    }
  });

  it("reports an out-of-enum status with SPEC_BAD_STATUS", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-badstatus-001.md", { ...validSpecFm, status: "shipped" });
    const result = runSpecValidate({ cwd: dir });
    expect(result.errors.map((e) => e.code)).toContain("SPEC_BAD_STATUS");
  });

  it("accepts the full status enum including superseded", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-superseded-001.md", { ...validSpecFm, status: "superseded" });
    const result = runSpecValidate({ cwd: dir });
    expect(result.errors).toEqual([]);
  });

  it("reports a malformed created date with SPEC_BAD_DATE", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-baddate-001.md", { ...validSpecFm, created: "11/09/2026" });
    const result = runSpecValidate({ cwd: dir });
    expect(result.errors.map((e) => e.code)).toContain("SPEC_BAD_DATE");
  });

  it("reports a non-kebab-case spec_id with SPEC_BAD_ID", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-badid-001.md", { ...validSpecFm, spec_id: "Foo_001" });
    const result = runSpecValidate({ cwd: dir });
    expect(result.errors.map((e) => e.code)).toContain("SPEC_BAD_ID");
  });

  it("is strict about acceptance criteria: a spec without any is an error", () => {
    const dir = makeRepo();
    writeSpec(
      dir,
      "spec-noaccept-001.md",
      validSpecFm,
      "# Spec: t\n\n## Purpose\n\nwhy\n\n## Synopsis\n\nusage\n",
    );
    const result = runSpecValidate({ cwd: dir });
    const hit = result.errors.find((e) => e.code === "SPEC_MISSING_SECTION");
    expect(hit).toBeDefined();
    expect(hit?.message).toContain("Acceptance");
  });

  it("accepts Spanish / numbered / equivalent section names (real-spec style)", () => {
    const dir = makeRepo();
    writeSpec(
      dir,
      "spec-es-001.md",
      validSpecFm,
      "# Spec: t\n\n## 1. Propósito\n\npor qué\n\n## 2. Modelo de datos\n\nentidades\n\n## 6. Aceptación\n\n- [x] ok\n",
    );
    const result = runSpecValidate({ cwd: dir });
    expect(result.errors).toEqual([]);
  });

  it("counts a non-empty intro as the Purpose section", () => {
    const dir = makeRepo();
    writeSpec(
      dir,
      "spec-intro-001.md",
      validSpecFm,
      "# Spec: t\n\nThis intro paragraph explains the purpose.\n\n## Synopsis\n\nusage\n\n## Acceptance criteria\n\n- [x] ok\n",
    );
    const result = runSpecValidate({ cwd: dir });
    expect(result.errors).toEqual([]);
  });

  it("reports a missing Synopsis/Design equivalent", () => {
    const dir = makeRepo();
    writeSpec(
      dir,
      "spec-nosyn-001.md",
      validSpecFm,
      "# Spec: t\n\n## Purpose\n\nwhy\n\n## Acceptance\n\n- [x] ok\n",
    );
    const result = runSpecValidate({ cwd: dir });
    const hits = result.errors.filter((e) => e.code === "SPEC_MISSING_SECTION");
    expect(hits.length).toBe(1);
    expect(hits[0]!.message).toContain("Synopsis");
  });

  it("reports a plan pointing at a non-existent spec with PLAN_SPEC_NOT_FOUND", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-real-001.md", validSpecFm);
    writePlan(dir, "plan-broken-001.md", validPlanFm("docs/specs/spec-missing-001.md"));
    const result = runSpecValidate({ cwd: dir });
    expect(result.errors.map((e) => e.code)).toContain("PLAN_SPEC_NOT_FOUND");
  });

  it("reports missing plan frontmatter fields with PLAN_MISSING_FIELD", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-real-001.md", validSpecFm);
    writePlan(dir, "plan-full-001.md", validPlanFm("docs/specs/spec-real-001.md"));
    // missing plan_id
    writePlan(dir, "plan-noid-001.md", {
      title: "Plan",
      spec: "docs/specs/spec-real-001.md",
      status: "proposed",
      created: "2026-09-11",
    });
    // missing spec
    writePlan(dir, "plan-nospec-001.md", {
      plan_id: "nospec-001",
      title: "Plan",
      status: "proposed",
      created: "2026-09-11",
    });
    const result = runSpecValidate({ cwd: dir });
    const hits = result.errors.filter((e) => e.code === "PLAN_MISSING_FIELD");
    expect(hits.some((e) => e.message.includes("'plan_id'"))).toBe(true);
    expect(hits.some((e) => e.message.includes("'spec'"))).toBe(true);
  });

  it("reports two specs sharing a spec_id with SPEC_DUPLICATE_ID", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-dup-a-001.md", validSpecFm);
    writeSpec(dir, "spec-dup-b-001.md", validSpecFm);
    const result = runSpecValidate({ cwd: dir });
    const hits = result.errors.filter((e) => e.code === "SPEC_DUPLICATE_ID");
    expect(hits.length).toBe(1);
    expect(hits[0]!.path).toContain("spec-dup-b-001.md");
    expect(hits[0]!.message).toContain("spec-dup-a-001.md");
  });

  it("validates a single file outside docs/specs with --file", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-real-001.md", validSpecFm);
    const outside = join(dir, "notes-spec-001.md");
    writeFileSync(
      outside,
      "---\nspec_id: notes-001\ntitle: Notes\nstatus: proposed\ncreated: 2026-09-11\n---\n\n# Notes\n\n## Purpose\n\nwhy\n\n## Synopsis\n\nusage\n\n## Acceptance\n\n- [x] ok\n",
      "utf8",
    );
    const result = runSpecValidate({ cwd: dir, file: outside });
    expect(result.errors).toEqual([]);
    expect(result.checked).toBe(1);
  });

  it("treats a --file named plan-* as a plan", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-real-001.md", validSpecFm);
    writePlan(dir, "plan-single-001.md", validPlanFm("docs/specs/spec-real-001.md"));
    const result = runSpecValidate({ cwd: dir, file: join(dir, "docs", "plans", "plan-single-001.md") });
    expect(result.errors).toEqual([]);
    expect(result.checked).toBe(1);
  });

  it("reports an unreadable --file path with SPEC_READ_FAILED", () => {
    const dir = makeRepo();
    const result = runSpecValidate({ cwd: dir, file: join(dir, "does-not-exist.md") });
    expect(result.errors.map((e) => e.code)).toContain("SPEC_READ_FAILED");
  });
});

describe("spec new", () => {
  it("scaffolds the next global NNN and the scaffolded docs validate clean", () => {
    const dir = makeRepo();
    writeSpec(dir, "spec-existing-005.md", { ...validSpecFm, spec_id: "existing-005" });
    const result = runSpecNew({ cwd: dir, slug: "my-feature", title: "My feature", plan: true });
    expect(result.files).toEqual([
      "docs/specs/spec-my-feature-006.md",
      "docs/plans/plan-my-feature-006.md",
    ]);
    expect(existsSync(join(dir, "docs", "specs", "spec-my-feature-006.md"))).toBe(true);
    const validation = runSpecValidate({ cwd: dir });
    expect(validation.errors).toEqual([]);
    const content = readFileSync(join(dir, "docs", "plans", "plan-my-feature-006.md"), "utf8");
    expect(content).toContain("spec: docs/specs/spec-my-feature-006.md");
    expect(content).toContain("title: Plan for My feature");
  });

  it("counts plan numbers toward the global maximum", () => {
    const dir = makeRepo();
    writePlan(dir, "plan-seed-009.md", validPlanFm("docs/specs/spec-x-001.md"));
    const result = runSpecNew({ cwd: dir, slug: "after-plan" });
    expect(result.files).toEqual(["docs/specs/spec-after-plan-010.md"]);
  });

  it("never overwrites: a second run numbers up and leaves the first files intact", () => {
    const dir = makeRepo();
    const first = runSpecNew({ cwd: dir, slug: "twice", title: "Twice" });
    const before = readFileSync(join(dir, first.files[0]!), "utf8");
    const second = runSpecNew({ cwd: dir, slug: "twice", title: "Twice" });
    expect(second.files[0]).not.toBe(first.files[0]);
    expect(readFileSync(join(dir, first.files[0]!), "utf8")).toBe(before);
    expect(second.files[0]).toMatch(/spec-twice-\d+\.md$/);
  });

  it("defaults the title to the humanized slug", () => {
    const dir = makeRepo();
    const result = runSpecNew({ cwd: dir, slug: "cold-start" });
    const content = readFileSync(join(dir, result.files[0]!), "utf8");
    expect(content).toContain("title: cold start");
    expect(content).toContain("spec_id: cold-start-001");
    expect(content).toContain("status: proposed");
  });

  it("rejects a non-kebab-case slug", () => {
    const dir = makeRepo();
    expect(() => runSpecNew({ cwd: dir, slug: "Bad Slug" })).toThrow(/kebab-case/);
  });
});
