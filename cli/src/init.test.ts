import { existsSync, mkdirSync, mkdtempSync as _mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { runInit, dryRunInit, type ProposalEntry } from "./init.js";
import { arggonVersion, renderGeneratedDoc } from "./docs.js";
import { readGeneratedState, updateGeneratedSection } from "./convention.js";

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

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = resolve(repoRoot, "cli/src/cli.ts");
const tsx = resolve(repoRoot, "node_modules/tsx/dist/cli.mjs");

const TIER1_DOCS = [
  ".agents/skills/arggon-cli/SKILL.md",
  ".editorconfig",
  ".github/CODEOWNERS",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/copilot-instructions.md",
  ".mcp.json",
  "AGENTS.md",
  "CLAUDE.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "docs/tracking.md",
];

const TIER2_DOCS = [
  "ARCHITECTURE.md",
  "CHANGELOG.md",
  "SUPPORT.md",
  "docs/convention.md",
  "docs/deploy.md",
  "docs/engineering.md",
  "docs/runbooks/README.md",
];

describe("init", () => {
  it("scaffolds tasks/.convention.yml and templates", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    const result = runInit({ dir, force: false });
    expect(readFileSync(join(dir, "tasks/.convention.yml"), "utf8")).toContain("version: 3");
    expect(readFileSync(join(dir, "tasks/.convention.yml"), "utf8")).toContain("branch_patterns:");
    expect(readFileSync(join(dir, "tasks/.convention.yml"), "utf8")).toContain('bug: "fix/{id}"');
    expect(existsSync(join(dir, "templates/task.md"))).toBe(true);
    expect(existsSync(join(dir, "templates/initiative.md"))).toBe(true);
    expect(result.alreadyInitialized).toBe(false);
    expect(result.created).toContain("tasks/.convention.yml");
    expect(result.restored).toEqual([]);
  });

  it("generates the tier-1 doc set by default", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    const result = runInit({ dir, force: false });
    for (const doc of TIER1_DOCS) {
      expect(existsSync(join(dir, ...doc.split("/")))).toBe(true);
      expect(result.created).toContain(doc);
    }
    for (const doc of TIER2_DOCS) {
      expect(existsSync(join(dir, ...doc.split("/")))).toBe(false);
      expect(result.created).not.toContain(doc);
    }
    expect(result.skipped).toEqual([]);
  });

  it("generates the tier-2 doc set only with full", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    const result = runInit({ dir, force: false, full: true });
    for (const doc of [...TIER1_DOCS, ...TIER2_DOCS]) {
      expect(existsSync(join(dir, ...doc.split("/")))).toBe(true);
      expect(result.created).toContain(doc);
    }
  });

  it("is idempotent without --force when already initialized", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    runInit({ dir, force: false });
    runInit({ dir, force: false });
    expect(existsSync(join(dir, "tasks/.convention.yml"))).toBe(true);
  });

  it("second run regenerates every untouched doc (updated[]) and creates nothing", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    runInit({ dir, force: false, full: true });
    const second = runInit({ dir, force: false, full: true });
    expect(second.created).toEqual([]);
    expect(second.modified).toEqual([]);
    expect(second.skipped).toEqual([]);
    expect(second.updated).toEqual([...TIER1_DOCS, ...TIER2_DOCS].sort());
  });

  it("restores missing templates when already initialized", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    runInit({ dir, force: false });
    unlinkSync(join(dir, "templates/task.md"));
    const result = runInit({ dir, force: false });
    expect(existsSync(join(dir, "templates/task.md"))).toBe(true);
    expect(result.alreadyInitialized).toBe(true);
    expect(result.restored).toContain("templates/task.md");
  });

  it("generates missing docs on an already-initialized tree (restore-on-rerun)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    mkdirSync(join(dir, "tasks"));
    writeFileSync(join(dir, "tasks/.convention.yml"), "version: 3\n", "utf8");
    const result = runInit({ dir, force: false });
    expect(result.alreadyInitialized).toBe(true);
    expect(result.created).toEqual(TIER1_DOCS);
    expect(result.skipped).toEqual([]);
  });

  it("never overwrites existing docs, even with --force", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    writeFileSync(join(dir, "AGENTS.md"), "CUSTOM ADOPTER CONTENT", "utf8");
    const result = runInit({ dir, force: true, full: true });
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toBe("CUSTOM ADOPTER CONTENT");
    expect(result.created).not.toContain("AGENTS.md");
    expect(result.skipped).toContain("AGENTS.md");
  });

  it("errors when tasks/ exists without convention unless --force", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    mkdirSync(join(dir, "tasks"));
    writeFileSync(join(dir, "tasks/note.txt"), "x");
    expect(() => runInit({ dir, force: false })).toThrow(/--force/);
  });

  // bug-init-leaves-docs-untracked-start-blocks-on-clean-tree: init must
  // auto-commit the docs it generates so `start`'s clean-tree precondition
  // never blocks tool-generated state.
  it("auto-commits generated docs: fresh init leaves a clean git tree", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    gitInit(dir);
    const result = runInit({ dir, force: false });
    expect(result.commit?.committed).toBe(true);
    expect(result.commit?.message).toMatch(/^chore\(tasks\): generated init docs \(\d+ files\)$/);
    // start's clean-tree gate: nothing untracked, nothing modified.
    const status = git(dir, ["status", "--porcelain"]);
    expect(status).toBe("");
    // HEAD carries the generated docs, the tasks/ tree AND the provenance state.
    const tracked = git(dir, ["ls-files"]);
    for (const doc of [...TIER1_DOCS, "tasks/.convention.yml", "templates/task.md"]) {
      expect(tracked).toContain(doc);
    }
  });

  it("stays ok in a non-git directory (commit skipped, not a failure)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    const result = runInit({ dir, force: false });
    expect(existsSync(join(dir, "AGENTS.md"))).toBe(true);
    expect(result.commit?.committed).toBe(false);
    expect(result.commit?.skipReason).toMatch(/not a git repository|git not found/);
  });

  it("re-run with nothing regenerated leaves HEAD untouched (quiet no-op)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    gitInit(dir);
    const now = new Date("2026-09-14T12:00:00Z");
    runInit({ dir, force: false, now });
    const headBefore = git(dir, ["rev-parse", "HEAD"]);
    const second = runInit({ dir, force: false, now });
    // Same generation timestamp → identical bytes → "nothing to commit" skip,
    // never a noisy empty commit nor a dirty tree.
    expect(second.commit?.committed).toBe(false);
    expect(second.commit?.skipReason).toBe("nothing to commit");
    expect(git(dir, ["rev-parse", "HEAD"])).toBe(headBefore);
    expect(git(dir, ["status", "--porcelain"])).toBe("");
  });

  // bug-init-git-doctor-blindspot: a non-git tree yields a half-functional
  // tracker (no branch/worktree/push/PR, no pre-commit validate hook) — init
  // must say so instead of reporting all-healthy.
  it("warns when the target tree is not a git repository", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    const result = runInit({ dir, force: false });
    expect(result.warning).toMatch(
      /not a git repository — branch\/worktree\/push\/PR flows and the pre-commit validate hook will be unavailable/,
    );
  });

  it("carries the warning in the --json envelope and on stderr (human output only there)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    const proc = spawnSync(process.execPath, [tsx, cli, "init", "--json", dir], {
      encoding: "utf8",
      cwd: dir,
    });
    expect(proc.status).toBe(0);
    // Human-facing warning rides stderr even in --json mode? No: the JSON
    // envelope carries the additive `warning` field; stderr stays quiet there.
    expect(proc.stderr).not.toMatch(/warning/);
    const body = JSON.parse(proc.stdout) as { ok: boolean; warning?: string };
    expect(body.ok).toBe(true);
    expect(body.warning).toMatch(/not a git repository/);
  });

  it("does not warn on a git tree", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-"));
    gitInit(dir);
    const result = runInit({ dir, force: false });
    expect(result.warning).toBeUndefined();
  });
});

// task-init-dry-run-plan: --dry-run is a pure read — the full per-destination
// plan with ZERO writes (no files, no backup dir, no auto-commit, no state
// mutation; even the git tree stays byte-identical).
describe("init --dry-run", () => {
  it("plans a fresh scaffold and writes NOTHING (fs + git untouched)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-dry-"));
    gitInit(dir);
    const before = snapshot(dir);
    const result = dryRunInit({ dir, force: false, full: true });
    const byDest = new Map(result.plan.map((e) => [e.dest, e]));
    expect(byDest.get("tasks/.convention.yml")?.decision).toBe("created");
    expect(byDest.get("AGENTS.md")?.decision).toBe("created");
    expect(byDest.get("AGENTS.md")?.reason).toMatch(/missing on disk/);
    expect(byDest.get("ARCHITECTURE.md")?.decision).toBe("created"); // --full tier-2
    expect(result.created).toContain("AGENTS.md");
    expect(result.restored).toEqual([]);
    // Nothing on disk: no scaffold, no docs, no backup dir.
    expect(existsSync(join(dir, "tasks"))).toBe(false);
    expect(existsSync(join(dir, "AGENTS.md"))).toBe(false);
    expect(existsSync(join(dir, "templates"))).toBe(false);
    expect(snapshot(dir)).toEqual(before);
    expect(git(dir, ["status", "--porcelain"])).toBe("");
  });

  it("flags untouched docs would-update, modified docs modified-skip, acked docs acked-skip; --backup flips modified to modified-backup — still zero writes", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-dry-"));
    runInit({ dir, force: false, full: true, now: new Date("2026-09-14T12:00:00Z") });
    // Adopter edit on one doc; sanctioned ack on another.
    const agentsBefore = readFileSync(join(dir, "AGENTS.md"), "utf8");
    writeFileSync(join(dir, "AGENTS.md"), `${agentsBefore}\nadopter edit\n`, "utf8");
    ackDoc(dir, "CLAUDE.md");
    const before = snapshot(dir);

    const dry = dryRunInit({ dir, force: false, full: true });
    const byDest = new Map(dry.plan.map((e) => [e.dest, e]));
    // Untouched since last generation → regenerated from the current template.
    expect(byDest.get(".editorconfig")?.decision).toBe("updated");
    expect(dry.updated).toEqual(
      expect.arrayContaining([".editorconfig", "docs/tracking.md", ".mcp.json"]),
    );
    expect(byDest.get("AGENTS.md")?.decision).toBe("modified-skip");
    expect(byDest.get("AGENTS.md")?.reason).toMatch(/--backup/);
    expect(byDest.get("CLAUDE.md")?.decision).toBe("acked-skip");
    expect(dry.skipped).toEqual(expect.arrayContaining(["AGENTS.md", "CLAUDE.md"]));

    const dryBackup = dryRunInit({ dir, force: false, full: true, backup: true });
    const byDestB = new Map(dryBackup.plan.map((e) => [e.dest, e]));
    expect(byDestB.get("AGENTS.md")?.decision).toBe("modified-backup");
    expect(byDestB.get("AGENTS.md")?.backupDest).toMatch(/^backup\/\d{4}-\d{2}-\d{2}\/AGENTS\.md$/);
    expect(byDestB.get("CLAUDE.md")?.decision).toBe("acked-skip"); // ack wins over --backup

    // Pure read: the edited file, the ack, fs layout and git are all untouched.
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toBe(`${agentsBefore}\nadopter edit\n`);
    expect(existsSync(join(dir, "backup"))).toBe(false);
    expect(snapshot(dir)).toEqual(before);
  });

  it("plan buckets match a subsequent real run 1:1 (plan-then-run equivalence)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-dry-"));
    runInit({ dir, force: false, full: true, now: new Date("2026-09-14T12:00:00Z") });
    writeFileSync(join(dir, "AGENTS.md"), "CUSTOM ADOPTER CONTENT\n", "utf8");
    const dry = dryRunInit({ dir, force: false, full: true, backup: true });
    const real = runInit({
      dir,
      force: false,
      full: true,
      backup: true,
      now: new Date("2026-09-14T12:00:00Z"),
    });
    for (const key of ["created", "updated", "modified", "backedUp", "skipped", "restored"] as const) {
      expect(real[key]).toEqual(dry[key]);
    }
    expect(real.backedUp).toEqual(["AGENTS.md"]);
    // A follow-up dry run on the refreshed tree plans nothing but regeneration.
    const after = dryRunInit({ dir, force: false, full: true });
    expect(after.backedUp).toEqual([]);
  });

  it("e2e: init --dry-run --json is additive to the envelope and writes nothing; human output carries the plan + footer", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-dry-"));
    gitInit(dir);
    const proc = spawnSync(process.execPath, [tsx, cli, "init", "--dry-run", "--full", "--json", dir], {
      encoding: "utf8",
      cwd: dir,
    });
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as {
      ok: boolean;
      command: string;
      dryRun?: boolean;
      plan?: { dest: string; decision: string; reason: string }[];
      commit?: unknown;
    };
    expect(body.ok).toBe(true);
    expect(body.command).toBe("init");
    expect(body.dryRun).toBe(true);
    expect(body.plan?.map((e) => e.dest)).toContain("AGENTS.md");
    expect(body.commit).toBeUndefined();
    expect(existsSync(join(dir, "tasks"))).toBe(false);
    expect(git(dir, ["status", "--porcelain"])).toBe("");

    const human = spawnSync(process.execPath, [tsx, cli, "init", "--dry-run", dir], {
      encoding: "utf8",
      cwd: dir,
    });
    expect(human.status).toBe(0);
    expect(human.stdout).toContain("nothing was written (dry run)");
    expect(human.stdout).toContain("created");
    expect(existsSync(join(dir, "AGENTS.md"))).toBe(false);
  });

  it("surfaces the tasks-exists precondition error like a real run", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-dry-"));
    mkdirSync(join(dir, "tasks"));
    writeFileSync(join(dir, "tasks/note.txt"), "x", "utf8");
    expect(() => dryRunInit({ dir, force: false })).toThrow(/--force/);
  });
});

/** Acknowledge one generated doc as the sanctioned baseline (adopt --ack effect). */
function ackDoc(dir: string, dest: string): void {
  const statePath = join(dir, "tasks", ".convention.yml");
  const state = readGeneratedState(dir);
  state[dest] = { ...state[dest]!, acknowledged: true };
  writeFileSync(statePath, updateGeneratedSection(readFileSync(statePath, "utf8"), state), "utf8");
}

// task-init-propose-acked-updates: `init --propose` is the safe upgrade
// channel for acked/modified docs — fresh template renders land in
// `<dest>.proposed-<version>` SIDE FILES; originals stay byte-identical,
// x-generated state is never mutated, nothing is committed.
describe("init --propose", () => {
  const NOW = new Date("2026-09-17T12:00:00Z");

  /** Fixture: initialized tree, AGENTS.md acked then hand-edited (outdated). */
  function setupAckedDrift(dir: string): string {
    runInit({ dir, force: false, now: NOW });
    ackDoc(dir, "AGENTS.md");
    const original = readFileSync(join(dir, "AGENTS.md"), "utf8");
    writeFileSync(join(dir, "AGENTS.md"), `${original}\nadopter edit\n`, "utf8");
    return original;
  }

  function proposalOf(proposals: ProposalEntry[], dest: string): ProposalEntry {
    const p = proposals.find((e) => e.dest === dest);
    expect(p).toBeDefined();
    return p!;
  }

  /**
   * Simulate upstream template drift (spec-propose-section-backports-007):
   * rewrite AGENTS.md's FIRST committed version (init's auto-commit, amended)
   * to the current render MINUS its last few lines, so the current template
   * render "gained" those lines after this repo was inited. Returns the
   * current render and the gained lines.
   */
  function simulateTemplateGain(dir: string): { render: string; gainedLines: string[] } {
    const render = renderGeneratedDoc({
      templatesDir: resolve(repoRoot, "templates"),
      root: dir,
      template: "docs/AGENTS.md",
      dest: "AGENTS.md",
      now: NOW,
    })!;
    const lines = render.split("\n");
    const cut = Math.max(1, lines.length - 4);
    const base = lines.slice(0, cut).join("\n");
    writeFileSync(join(dir, "AGENTS.md"), base, "utf8");
    git(dir, ["add", "AGENTS.md"]);
    git(dir, ["commit", "--amend", "--no-edit"]);
    return { render, gainedLines: lines.slice(cut) };
  }

  /** Fixture: git-inited tree whose committed AGENTS.md predates a template gain. */
  function setupSectionFixture(dir: string): { render: string; gainedLines: string[] } {
    gitInit(dir);
    runInit({ dir, force: false, now: NOW });
    const gained = simulateTemplateGain(dir);
    writeFileSync(join(dir, "AGENTS.md"), `${gained.render}\nadopter edit\n`, "utf8");
    ackDoc(dir, "AGENTS.md");
    return gained;
  }

  it("section-level: template gained a section since init -> region proposal only, original untouched", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-propose-sec-"));
    const { render, gainedLines } = setupSectionFixture(dir);
    const disk = `${render}\nadopter edit\n`;
    const version = arggonVersion();

    const result = runInit({ dir, force: false, propose: true, now: NOW });

    const p = proposalOf(result.proposals ?? [], "AGENTS.md");
    expect(p.decision).toBe("proposed");
    expect(p.mode).toBe("sections");
    expect(p.regions).toEqual([{ kind: "added", added: gainedLines.length, removed: 0 }]);
    const proposalFile = join(dir, ...p.proposalPath.split("/"));
    expect(existsSync(proposalFile)).toBe(true);
    const content = readFileSync(proposalFile, "utf8");
    expect(content).toContain(`arggon:proposed-update dest="AGENTS.md" version="${version}"`);
    expect(content).toContain('mode="sections"');
    expect(content).toContain("arggon adopt --ack");
    expect(content).toContain(`region 1 of 1 — added (+${gainedLines.length}/-0)`);
    for (const line of gainedLines) {
      if (line.trim()) expect(content).toContain(`    ${line}`);
    }
    // Anchors: the unchanged baseline text just before the gained region.
    expect(content).toContain("anchor-before");
    // Does NOT contain the rest of the doc: an early render line is absent.
    const earlyLine = render.split("\n")[1]!;
    expect(gainedLines).not.toContain(earlyLine);
    expect(content).not.toContain(earlyLine);
    // Original byte-untouched; state unmutated (acked stays acked).
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toBe(disk);
  });

  it("no git history -> whole-file fallback (today's behavior)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-propose-"));
    const original = setupAckedDrift(dir); // no gitInit: no committed baseline
    const result = runInit({ dir, force: false, propose: true, now: NOW });
    const p = proposalOf(result.proposals ?? [], "AGENTS.md");
    expect(p.decision).toBe("proposed");
    expect(p.mode).toBe("whole-file");
    expect(p.regions).toBeUndefined();
    expect(p.removed).toBeGreaterThan(0);
    const content = readFileSync(join(dir, ...p.proposalPath.split("/")), "utf8");
    // Whole render, not a region block list.
    expect(content).toContain(original);
    expect(content).not.toContain("anchor-before");
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toBe(`${original}\nadopter edit\n`);
  });

  it("removed-only template content -> informational entry, no side file, nothing deleted", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-propose-rem-"));
    gitInit(dir);
    runInit({ dir, force: false, now: NOW });
    // Amend the FIRST committed version to carry a section the template LOST.
    const render = renderGeneratedDoc({
      templatesDir: resolve(repoRoot, "templates"),
      root: dir,
      template: "docs/AGENTS.md",
      dest: "AGENTS.md",
      now: NOW,
    })!;
    writeFileSync(
      join(dir, "AGENTS.md"),
      `${render}\n## Removed upstream section\n\nThe template later lost this.\n`,
      "utf8",
    );
    git(dir, ["add", "AGENTS.md"]);
    git(dir, ["commit", "--amend", "--no-edit"]);
    const disk = `${render}\nadopter edit\n`;
    writeFileSync(join(dir, "AGENTS.md"), disk, "utf8");
    ackDoc(dir, "AGENTS.md");

    const result = runInit({ dir, force: false, propose: true, now: NOW });
    const p = proposalOf(result.proposals ?? [], "AGENTS.md");
    expect(p.decision).toBe("informational");
    expect(p.note).toBeDefined();
    expect(existsSync(join(dir, ...p.proposalPath.split("/")))).toBe(false);
    // Adopter content untouched.
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toBe(disk);
  });

  it("--propose-whole-file forces today's whole-file proposal for the same fixture", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-propose-wf-"));
    const { render } = setupSectionFixture(dir);
    const result = runInit({
      dir,
      force: false,
      propose: true,
      proposeWholeFile: true,
      now: NOW,
    });
    const p = proposalOf(result.proposals ?? [], "AGENTS.md");
    expect(p.decision).toBe("proposed");
    expect(p.mode).toBe("whole-file");
    expect(p.regions).toBeUndefined();
    const content = readFileSync(join(dir, ...p.proposalPath.split("/")), "utf8");
    expect(content).toContain(render);
    expect(content).not.toContain('mode="sections"');
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toBe(`${render}\nadopter edit\n`);
  });

  it("proposes for an acked doc whose render differs from disk: side file written, original intact, state unmutated", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-propose-"));
    const original = setupAckedDrift(dir);
    const before = snapshot(dir);
    const version = arggonVersion();

    const result = runInit({ dir, force: false, propose: true, now: NOW });

    const p = proposalOf(result.proposals ?? [], "AGENTS.md");
    expect(p.decision).toBe("proposed");
    expect(p.proposalPath).toBe(`AGENTS.md.proposed-${version}`);
    expect(p.template).toBe("docs/AGENTS.md");
    expect(p.basedOnVersion).toBe(version);
    const proposalFile = join(dir, ...p.proposalPath.split("/"));
    expect(existsSync(proposalFile)).toBe(true);
    const content = readFileSync(proposalFile, "utf8");
    // Distinguishing header ABOVE the standard generated marker.
    expect(content).toContain(`arggon:proposed-update dest="AGENTS.md" version="${version}"`);
    expect(content.indexOf("arggon:proposed-update")).toBeLessThan(content.indexOf("arggon:generated"));
    expect(content).toContain("arggon adopt --ack");
    expect(p.removed).toBeGreaterThan(0);
    expect(p.added).toBeGreaterThanOrEqual(0);
    // Original byte-untouched.
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toBe(`${original}\nadopter edit\n`);
    // x-generated state NOT mutated, and only the side file changed on disk.
    const after = snapshot(dir);
    expect(after.files["tasks/.convention.yml"]).toBe(before.files["tasks/.convention.yml"]);
    const proposalKey = `AGENTS.md.proposed-${version}`;
    expect(Object.keys(after.files)).toContain(proposalKey);
    delete (after.files as Record<string, string>)[proposalKey];
    expect(after.files).toEqual(before.files);
    expect(result.commit).toBeUndefined();
  });

  it("proposes nothing for unchanged dests (render matches disk)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-propose-"));
    runInit({ dir, force: false, now: NOW });
    const result = runInit({ dir, force: false, propose: true, now: NOW });
    expect(result.proposals ?? []).toEqual([]);
    expect(existsSync(join(dir, "AGENTS.md.proposed-0.0.0"))).toBe(false);
  });

  it("proposes for a modified (unacked) doc too; tier-2 only with --full", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-propose-"));
    runInit({ dir, force: false, full: true, now: NOW });
    writeFileSync(join(dir, "ARCHITECTURE.md"), "CUSTOM\n", "utf8");
    writeFileSync(join(dir, "CLAUDE.md"), `${readFileSync(join(dir, "CLAUDE.md"), "utf8")}\nx\n`, "utf8");

    const tier1 = runInit({ dir, force: false, propose: true, now: NOW });
    expect((tier1.proposals ?? []).map((p) => p.dest)).toContain("CLAUDE.md");
    expect((tier1.proposals ?? []).map((p) => p.dest)).not.toContain("ARCHITECTURE.md");

    const tier2 = runInit({ dir, force: false, full: true, propose: true, now: NOW });
    expect((tier2.proposals ?? []).map((p) => p.dest)).toContain("ARCHITECTURE.md");
    expect(existsSync(join(dir, `ARCHITECTURE.md.proposed-${arggonVersion()}`))).toBe(true);
  });

  it("is idempotent: re-running overwrites its own same-version proposal (never accumulates)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-propose-"));
    setupAckedDrift(dir);
    runInit({ dir, force: false, propose: true, now: NOW });
    const first = readdirSync(dir).filter((n) => n.startsWith("AGENTS.md.proposed-"));
    expect(first).toEqual([`AGENTS.md.proposed-${arggonVersion()}`]);
    const second = runInit({ dir, force: false, propose: true, now: NOW });
    expect(proposalOf(second.proposals ?? [], "AGENTS.md").decision).toBe("proposed");
    expect(readdirSync(dir).filter((n) => n.startsWith("AGENTS.md.proposed-"))).toEqual(first);
  });

  it("absorbs: a dest that now matches upstream gets its same-version proposal removed and reported", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-propose-"));
    setupAckedDrift(dir);
    runInit({ dir, force: false, propose: true, now: NOW });
    // The agent merges: restores the doc to the sanctioned template render.
    const render = renderGeneratedDoc({
      templatesDir: resolve(repoRoot, "templates"),
      root: dir,
      template: "docs/AGENTS.md",
      dest: "AGENTS.md",
      now: NOW,
    });
    expect(render).not.toBeNull();
    writeFileSync(join(dir, "AGENTS.md"), render!, "utf8");

    const result = runInit({ dir, force: false, propose: true, now: NOW });
    const p = proposalOf(result.proposals ?? [], "AGENTS.md");
    expect(p.decision).toBe("absorbed");
    expect(existsSync(join(dir, ...p.proposalPath.split("/")))).toBe(false);
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toBe(render!);
  });

  it("reports an older-version proposal as stale and leaves it on disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-propose-"));
    setupAckedDrift(dir);
    writeFileSync(join(dir, "AGENTS.md.proposed-0.1.0"), "OLD PROPOSAL\n", "utf8");
    const result = runInit({ dir, force: false, propose: true, now: NOW });
    const stale = (result.proposals ?? []).filter((p) => p.decision === "stale");
    expect(stale.map((p) => p.proposalPath)).toContain("AGENTS.md.proposed-0.1.0");
    expect(stale.find((p) => p.proposalPath === "AGENTS.md.proposed-0.1.0")?.basedOnVersion).toBe("0.1.0");
    expect(readFileSync(join(dir, "AGENTS.md.proposed-0.1.0"), "utf8")).toBe("OLD PROPOSAL\n");
    // And the current-version proposal is still written alongside.
    expect((result.proposals ?? []).some((p) => p.decision === "proposed" && p.dest === "AGENTS.md")).toBe(true);
  });

  it("dry-run + propose lists would-write/would-remove and writes NOTHING", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-propose-"));
    setupAckedDrift(dir);
    writeFileSync(join(dir, "AGENTS.md.proposed-0.1.0"), "OLD\n", "utf8");
    const before = snapshot(dir);
    const result = dryRunInit({ dir, force: false, propose: true, now: NOW });
    expect((result.proposals ?? []).some((p) => p.decision === "proposed")).toBe(true);
    expect(result.plan.map((e) => e.dest)).toContain("AGENTS.md");
    // Pure read: no proposal file written, stale file untouched, fs + git intact.
    expect(existsSync(join(dir, `AGENTS.md.proposed-${arggonVersion()}`))).toBe(false);
    expect(snapshot(dir)).toEqual(before);
  });

  it("errors on nonsensical combos and on a non-initialized tree", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-propose-"));
    expect(() => runInit({ dir, force: false, propose: true, backup: true })).toThrow(/--backup/);
    expect(() => runInit({ dir, force: true, propose: true })).toThrow(/--force/);
    expect(() => runInit({ dir, force: false, propose: true })).toThrow(/arggon init` first/);
    expect(() => dryRunInit({ dir, force: false, propose: true, backup: true })).toThrow(/--backup/);
  });

  it("e2e: init --propose --json carries the additive proposals[] shape; human output lists proposals; --propose --backup fails", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-init-propose-"));
    const { gainedLines } = setupSectionFixture(dir); // git-inited + template gain simulated
    const version = arggonVersion();

    const json = spawnSync(process.execPath, [tsx, cli, "init", "--propose", "--json", dir], {
      encoding: "utf8",
      cwd: dir,
    });
    expect(json.status).toBe(0);
    const body = JSON.parse(json.stdout) as {
      ok: boolean;
      proposals?: {
        dest: string;
        proposalPath: string;
        decision: string;
        template: string;
        basedOnVersion: string;
        mode?: string;
        regions?: { kind: string; added: number; removed: number }[];
      }[];
      commit?: unknown;
    };
    expect(body.ok).toBe(true);
    const p = body.proposals?.find((e) => e.dest === "AGENTS.md");
    expect(p?.decision).toBe("proposed");
    expect(p?.mode).toBe("sections");
    expect(p?.regions).toEqual([{ kind: "added", added: gainedLines.length, removed: 0 }]);
    expect(p?.proposalPath).toBe(`AGENTS.md.proposed-${version}`);
    expect(p?.template).toBe("docs/AGENTS.md");
    expect(p?.basedOnVersion).toBe(version);
    expect(body.commit).toBeUndefined();
    expect(existsSync(join(dir, `AGENTS.md.proposed-${version}`))).toBe(true);

    const human = spawnSync(process.execPath, [tsx, cli, "init", "--propose", dir], {
      encoding: "utf8",
      cwd: dir,
    });
    expect(human.status).toBe(0);
    expect(human.stdout).toMatch(/proposed/);
    expect(human.stdout).toMatch(/adopt --ack/);

    const combo = spawnSync(process.execPath, [tsx, cli, "init", "--propose", "--backup", "--json", dir], {
      encoding: "utf8",
      cwd: dir,
    });
    expect(combo.status).not.toBe(0);
    const comboBody = JSON.parse(combo.stdout) as { ok: boolean; error?: { message?: string } };
    expect(comboBody.ok).toBe(false);
    expect(comboBody.error?.message).toMatch(/--propose does not combine with --backup/);
  });
});

/** Byte-identical fs + git snapshot (task-init-dry-run-plan invariants). */
function snapshot(dir: string): { head: string | null; files: Record<string, string> } {
  const files: Record<string, string> = {};
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const abs = join(current, entry.name);
      const rel = relative(dir, abs);
      if (rel.startsWith(".git")) continue;
      if (entry.isDirectory()) walk(abs);
      else files[rel] = readFileSync(abs, "utf8");
    }
  };
  walk(dir);
  // Fresh scaffolds may have no commit yet (unborn HEAD) — that's fine: the
  // invariant is that the snapshot (and the porcelain status) does not move.
  let head: string | null = null;
  try {
    head = git(dir, ["rev-parse", "HEAD"]).trim();
  } catch {
    head = null;
  }
  return { head, files };
}

/** Minimal git repo with a committer identity so auto-commits can land. */function gitInit(dir: string): void {
  execFileSync("git", ["init", "-q"], { cwd: dir, stdio: "pipe" });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir, stdio: "pipe" });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: dir, stdio: "pipe" });
}

function git(dir: string, args: string[]): string {
  return execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: "pipe" });
}
