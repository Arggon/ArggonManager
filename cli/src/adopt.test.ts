import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ADOPT_STORY_ID,
  ADOPT_TASK_BODY,
  ADOPT_TASK_ID,
  ADOPT_TASK_TITLE,
  buildInventory,
  formatAdoptAckReport,
  formatAdoptReport,
  runAdopt,
  runAdoptAck,
} from "./adopt.js";
import { readConventionConfig, updateGeneratedSection } from "./convention.js";
import { checksumOf } from "./docs.js";
import { runDoctor } from "./doctor.js";
import { runCreate } from "./create.js";
import { runInit } from "./init.js";
import { loadItems } from "./items.js";
import { runUpdate } from "./update.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = resolve(repoRoot, "cli/src/cli.ts");
const tsx = resolve(repoRoot, "node_modules/tsx/dist/cli.mjs");

function runCli(args: string[], cwd: string) {
  return spawnSync(process.execPath, [tsx, cli, ...args], { encoding: "utf8", cwd });
}

function tempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

/** Initialized tree (full docs) with one initiative and one epic. */
function seedTree(): string {
  const dir = tempDir("arggon-adopt-");
  runInit({ dir, force: false, full: true });
  runCreate({ cwd: dir, type: "initiative", title: "Main" });
  runCreate({ cwd: dir, type: "epic", title: "CLI", parent: "main" });
  return dir;
}

describe("runAdopt: task creation", () => {
  it("creates the adoption task with the checklist body under the auto story", () => {
    const dir = seedTree();
    const now = new Date("2026-09-12T10:00:00Z");
    const result = runAdopt({ cwd: dir, now });
    expect(result.taskId).toBe("task-adopt-arggon");
    expect(result.taskCreated).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.storyId).toBe("story-arggon-adoption");
    expect(result.storyCreated).toBe(true);
    expect(existsSync(result.taskPath)).toBe(true);

    const items = loadItems(join(dir, "tasks"));
    const story = items.find((item) => item.id === ADOPT_STORY_ID);
    expect(story?.type).toBe("story");
    expect(story?.parent).toBe("cli");
    expect(story?.title).toBe("ArggonManager adoption");

    const task = items.find((item) => item.id === ADOPT_TASK_ID);
    expect(task?.type).toBe("task");
    expect(task?.status).toBe("todo");
    expect(task?.title).toBe(ADOPT_TASK_TITLE);
    expect(task?.parent).toBe(ADOPT_STORY_ID);
  });

  it("the task body carries the full ordered agent checklist", () => {
    const dir = seedTree();
    runAdopt({ cwd: dir });
    const task = loadItems(join(dir, "tasks")).find((item) => item.id === ADOPT_TASK_ID)!;
    const body = readFileSync(task.filePath, "utf8");
    expect(body).toContain(ADOPT_TASK_BODY);
    // Eight ordered checklist steps (1-8).
    expect(body.match(/^- \[ \] /gm)).toHaveLength(8);
    // Step 1: read the generated governing docs.
    expect(body).toContain("AGENTS.md");
    expect(body).toContain("docs/convention.md");
    expect(body).toContain("docs/engineering.md");
    expect(body).toContain("docs/playbooks/");
    // Step 2: sweep the adopter docs; extract, don't wholesale-copy.
    expect(body).toContain("arggon adopt --dry-run --json");
    expect(body).toContain("Extract, don't wholesale-copy");
    // Step 3: fill placeholders; SECURITY contact stays human input.
    expect(body).toContain("SECURITY.md contact is human input");
    // Step 4: backup convention; README merge rule.
    expect(body).toContain("backup/<YYYY-MM-DD>/");
    expect(body).toContain("never archive README.md");
    // Step 5: stack manifests -> one playbook per tech, researched with dates.
    expect(body).toContain("package.json / requirements.txt / go.mod / Cargo.toml / pom.xml");
    expect(body).toContain("arggon playbook new <tech>");
    expect(body).toContain("arggon playbook refresh <tech> --version <v>");
    // Step 6: baseline the sanctioned sweep edits (task-adopt-checksum-refresh).
    expect(body).toContain("arggon adopt --ack");
    expect(body).toContain("Hand edits made AFTER this ack leave the file adopter-owned");
    expect(body).toContain("acknowledgedDrifted");
    // Step 7: verification commands.
    expect(body).toContain("arggon validate");
    expect(body).toContain("arggon spec validate");
    expect(body).toContain("arggon playbook status");
    // Step 8: report + handoff to the human.
    expect(body).toContain("arggon comment task-adopt-arggon");
  });

  it("--story override parents the task to the given story (no auto story)", () => {
    const dir = seedTree();
    runCreate({ cwd: dir, type: "story", title: "Target", id: "story-target", parent: "cli" });
    const result = runAdopt({ cwd: dir, story: "story-target" });
    expect(result.storyId).toBe("story-target");
    expect(result.storyCreated).toBe(false);
    const items = loadItems(join(dir, "tasks"));
    expect(items.find((item) => item.id === ADOPT_TASK_ID)?.parent).toBe("story-target");
    expect(items.find((item) => item.id === ADOPT_STORY_ID)).toBeUndefined();
  });

  it("rejects a --story that does not resolve or is not a story", () => {
    const dir = seedTree();
    expect(() => runAdopt({ cwd: dir, story: "story-nope" })).toThrow(/does not resolve/);
    expect(() => runAdopt({ cwd: dir, story: "cli" })).toThrow(/is a epic, not a story/);
  });

  it("is idempotent: an open adoption task is reported, not duplicated", () => {
    const dir = seedTree();
    const first = runAdopt({ cwd: dir });
    const second = runAdopt({ cwd: dir });
    expect(second.taskId).toBe(first.taskId);
    expect(second.taskCreated).toBe(false);
    expect(second.skipped).toBe(true);
    expect(second.storyCreated).toBe(false);
    expect(second.taskPath).toBe(first.taskPath);
    const tasks = loadItems(join(dir, "tasks")).filter((item) => item.id === ADOPT_TASK_ID);
    expect(tasks).toHaveLength(1);
  });

  it("errors when the adoption already completed (terminal task)", () => {
    const dir = seedTree();
    runAdopt({ cwd: dir });
    runUpdate({ cwd: dir, id: ADOPT_TASK_ID, status: "in_progress", assignee: "adopt-bot" });
    runUpdate({ cwd: dir, id: ADOPT_TASK_ID, status: "done", unassign: true });
    expect(() => runAdopt({ cwd: dir })).toThrow(/already exists \(done\)/);
  });

  it("requires an initialized tree", () => {
    const dir = tempDir("arggon-adopt-naked-");
    expect(() => runAdopt({ cwd: dir })).toThrow(/not an arggon-managed tree.*arggon init/s);
  });

  it("auto-creates the container chain on a fresh init tree (no epic)", () => {
    const dir = tempDir("arggon-adopt-fresh-");
    runInit({ dir, force: false, full: true });
    const result = runAdopt({ cwd: dir });
    expect(result.createdContainers).toEqual(["arggon-adoption", "epic-arggon-adoption"]);
    expect(result.storyCreated).toBe(true);
    const items = loadItems(join(dir, "tasks"));
    const initiative = items.find((item) => item.id === "arggon-adoption");
    expect(initiative?.type).toBe("initiative");
    expect(initiative?.title).toBe("ArggonManager adoption");
    expect(initiative?.parent).toBeNull();
    const epic = items.find((item) => item.id === "epic-arggon-adoption");
    expect(epic?.type).toBe("epic");
    expect(epic?.parent).toBe("arggon-adoption");
    const story = items.find((item) => item.id === ADOPT_STORY_ID);
    expect(story?.parent).toBe("epic-arggon-adoption");
    expect(items.find((item) => item.id === ADOPT_TASK_ID)?.parent).toBe(ADOPT_STORY_ID);
  });

  it("auto-creates the containers even when an unrelated initiative exists (no epic)", () => {
    const dir = tempDir("arggon-adopt-initonly-");
    runInit({ dir, force: false });
    runCreate({ cwd: dir, type: "initiative", title: "Main" });
    const result = runAdopt({ cwd: dir });
    expect(result.createdContainers).toEqual(["arggon-adoption", "epic-arggon-adoption"]);
    const items = loadItems(join(dir, "tasks"));
    expect(items.find((item) => item.id === ADOPT_STORY_ID)?.parent).toBe("epic-arggon-adoption");
  });

  it("reuses an existing epic and creates no containers", () => {
    const dir = seedTree();
    const result = runAdopt({ cwd: dir });
    expect(result.createdContainers).toEqual([]);
    expect(result.storyCreated).toBe(true);
    const items = loadItems(join(dir, "tasks"));
    expect(items.find((item) => item.id === "arggon-adoption")).toBeUndefined();
    expect(items.find((item) => item.id === "epic-arggon-adoption")).toBeUndefined();
    expect(items.find((item) => item.id === ADOPT_STORY_ID)?.parent).toBe("cli");
  });
});

describe("runAdopt: --dry-run", () => {
  it("plans the container chain on a fresh tree without writing it", () => {
    const dir = tempDir("arggon-adopt-dryfresh-");
    runInit({ dir, force: false, full: true });
    const before = loadItems(join(dir, "tasks")).map((item) => item.id).sort();
    const result = runAdopt({ cwd: dir, dryRun: true });
    expect(result.createdContainers).toEqual(["arggon-adoption", "epic-arggon-adoption"]);
    const after = loadItems(join(dir, "tasks")).map((item) => item.id).sort();
    expect(after).toEqual(before);
  });


  it("reports the plan but creates nothing", () => {
    const dir = seedTree();
    const before = loadItems(join(dir, "tasks")).map((item) => item.id).sort();
    const result = runAdopt({ cwd: dir, dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(result.taskId).toBe(ADOPT_TASK_ID);
    expect(result.taskCreated).toBe(false);
    expect(result.storyCreated).toBe(false);
    expect(result.storyId).toBe(ADOPT_STORY_ID);
    const after = loadItems(join(dir, "tasks")).map((item) => item.id).sort();
    expect(after).toEqual(before);
    expect(after).not.toContain(ADOPT_TASK_ID);
    expect(after).not.toContain(ADOPT_STORY_ID);
  });
});

describe("buildInventory", () => {
  it("classifies managed vs adopter-owned vs absent docs and stack manifests", () => {
    const dir = tempDir("arggon-adopt-inv-");
    // Pre-existing adopter docs: init must skip them (adopter-owned).
    writeFileSync(join(dir, "AGENTS.md"), "MY OWN RULES\n", "utf8");
    writeFileSync(join(dir, ".cursorrules"), "legacy cursor rules\n", "utf8");
    writeFileSync(join(dir, "README.md"), "# My project\n", "utf8");
    runInit({ dir, force: false, full: true });
    // Stack manifests (filename-only detection).
    writeFileSync(join(dir, "package.json"), "{}\n", "utf8");
    writeFileSync(join(dir, "go.mod"), "module example.com/x\n", "utf8");

    const inventory = buildInventory(dir);
    const byPath = new Map(inventory.docs.map((doc) => [doc.path, doc]));
    expect(inventory.docs.map((doc) => doc.path)).toEqual(
      [...inventory.docs.map((doc) => doc.path)].sort(),
    );

    // Adopter-owned: exists, no x-generated state.
    expect(byPath.get("AGENTS.md")).toMatchObject({ exists: true, managed: false });
    expect(byPath.get("AGENTS.md")!.bytes).toBe("MY OWN RULES\n".length);
    expect(byPath.get(".cursorrules")).toMatchObject({ exists: true, managed: false });
    expect(byPath.get("README.md")).toMatchObject({ exists: true, managed: false });
    // Arggon-managed (generated with --full, x-generated state recorded).
    expect(byPath.get("CONTRIBUTING.md")).toMatchObject({ exists: true, managed: true });
    expect(byPath.get("ARCHITECTURE.md")).toMatchObject({ exists: true, managed: true });
    expect(byPath.get("docs/convention.md")).toMatchObject({ exists: true, managed: true });
    expect(byPath.get("docs/runbooks/README.md")).toMatchObject({ exists: true, managed: true });
    expect(byPath.get(".github/CODEOWNERS")).toMatchObject({ exists: true, managed: true });
    // Absent: nothing on disk, nothing managed.
    expect(byPath.get("docs/index.md")).toMatchObject({ exists: false, managed: false });
    expect(byPath.get(".github/CONTRIBUTING.md")).toMatchObject({ exists: false, managed: false });

    expect(inventory.stackHints).toEqual(["package.json", "go.mod"]);
  });

  it("is a pure read on an empty tree (nothing managed, no stack hints)", () => {
    const dir = tempDir("arggon-adopt-inv-empty-");
    const yml = join(dir, "tasks/.convention.yml");
    const before = existsSync(yml) ? readFileSync(yml, "utf8") : null;
    const inventory = buildInventory(dir);
    expect(inventory.docs.every((doc) => !doc.exists && !doc.managed)).toBe(true);
    expect(inventory.stackHints).toEqual([]);
    const after = existsSync(yml) ? readFileSync(yml, "utf8") : null;
    expect(after).toBe(before);
  });
});

describe("formatAdoptReport", () => {
  it("prints the dry-run inventory with per-doc labels", () => {
    const dir = seedTree();
    writeFileSync(join(dir, "package.json"), "{}\n", "utf8");
    const result = runAdopt({ cwd: dir, dryRun: true });
    const report = formatAdoptReport(result);
    expect(report).toContain("arggon adopt (dry run): would create task-adopt-arggon");
    expect(report).toContain("story-arggon-adoption");
    expect(report).toContain("[managed] CONTRIBUTING.md");
    expect(report).toContain("[absent]");
    expect(report).toContain("stack hints: package.json");
  });

  it("marks a skipped creation as already tracked", () => {
    const dir = seedTree();
    runAdopt({ cwd: dir });
    const report = formatAdoptReport(runAdopt({ cwd: dir }));
    expect(report).toContain("already tracked as task-adopt-arggon");
  });
});

describe("adopt via the CLI (--json)", () => {
  it("creates the task and reports the v1 payload", () => {
    const dir = seedTree();
    const proc = runCli(["adopt", "--json"], dir);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as {
      ok: boolean;
      schemaVersion: number;
      conventionVersion: number;
      command: string;
      taskId: string;
      storyId: string;
      storyCreated: boolean;
      taskCreated: boolean;
      dryRun: boolean;
      inventory: { docs: { path: string; exists: boolean; bytes: number; managed: boolean }[]; stackHints: string[] };
    };
    expect(body.ok).toBe(true);
    expect(body.schemaVersion).toBe(1);
    expect(body.conventionVersion).toBe(3);
    expect(body.command).toBe("adopt");
    expect(body.taskId).toBe("task-adopt-arggon");
    expect(body.storyId).toBe("story-arggon-adoption");
    expect(body.storyCreated).toBe(true);
    expect(body.taskCreated).toBe(true);
    expect(body.dryRun).toBe(false);
    expect(body.inventory.docs.length).toBeGreaterThan(0);
    expect(body.inventory.docs[0]).toHaveProperty("managed");
  });

  it("--dry-run --json writes nothing", () => {
    const dir = seedTree();
    const proc = runCli(["adopt", "--dry-run", "--json"], dir);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as { ok: boolean; taskCreated: boolean; dryRun: boolean };
    expect(body.ok).toBe(true);
    expect(body.taskCreated).toBe(false);
    expect(body.dryRun).toBe(true);
    expect(loadItems(join(dir, "tasks")).some((item) => item.id === ADOPT_TASK_ID)).toBe(false);
  });

  it("fails with ADOPT_FAILED on a non-initialized tree", () => {
    const dir = tempDir("arggon-adopt-cli-naked-");
    const proc = runCli(["adopt", "--json"], dir);
    expect(proc.status).toBe(1);
    const body = JSON.parse(proc.stdout) as {
      ok: boolean;
      command: string;
      error: { code: string; message: string };
    };
    expect(body.ok).toBe(false);
    expect(body.command).toBe("adopt");
    expect(body.error.code).toBe("ADOPT_FAILED");
    expect(body.error.message).toContain("arggon init");
  });
});

describe("runAdoptAck: x-generated baseline refresh (task-adopt-checksum-refresh)", () => {
  it("acks the current content: state checksums refresh and doctor reports untouched", () => {
    const dir = seedTree();
    // The sanctioned sweep edits (step 3 of the checklist).
    writeFileSync(join(dir, "AGENTS.md"), "SWEEP: project description\n", "utf8");
    writeFileSync(join(dir, "CONTRIBUTING.md"), "SWEEP: setup + build commands\n", "utf8");
    expect(runDoctor({ cwd: dir }).docs).toMatchObject({ managed: 17, modified: 2, untouched: 15 });

    const now = new Date("2026-09-13T10:00:00Z");
    const result = runAdoptAck({ cwd: dir, now });
    expect(result.count).toBe(result.acked.length);
    expect(result.count).toBe(17);
    expect(result.acked.map((doc) => doc.path)).toEqual(
      [...result.acked.map((doc) => doc.path)].sort(),
    );
    const byPath = new Map(result.acked.map((doc) => [doc.path, doc.checksum]));
    expect(byPath.get("AGENTS.md")).toBe(checksumOf("SWEEP: project description\n"));

    const config = readConventionConfig(dir);
    const agents = config.generated["AGENTS.md"]!;
    expect(agents.checksum).toBe(checksumOf(readFileSync(join(dir, "AGENTS.md"), "utf8")));
    expect(agents.generatedAt).toBe("2026-09-13T10:00:00.000Z");
    expect(agents.template).toBe("docs/AGENTS.md");
    expect(agents.arggonVersion).toBe("0.1.0");
    // The sanctioned edits stop reporting as modified: they are acknowledged
    // (sanctioned-diverged baselines), the healthy acked bucket.
    expect(runDoctor({ cwd: dir }).docs).toMatchObject({
      managed: 17,
      modified: 0,
      untouched: 0,
      acknowledged: 17,
    });
  });

  it("next init never regenerates acked docs (skipped[], sanctioned content intact)", () => {
    const dir = seedTree();
    writeFileSync(join(dir, "AGENTS.md"), "SWEEP: project description\n", "utf8");
    runAdoptAck({ cwd: dir });
    const result = runInit({ dir, force: false, full: true });
    expect(result.modified).toEqual([]);
    // Acknowledged baselines are never regenerated (bug-ack-baseline-regen-loss):
    // the sanctioned sweep content must survive every re-run.
    expect(result.updated).not.toContain("AGENTS.md");
    expect(result.skipped).toContain("AGENTS.md");
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toBe(
      "SWEEP: project description\n",
    );
    // The entry keeps its acknowledged flag after the skip.
    expect(readConventionConfig(dir).generated["AGENTS.md"]!.acknowledged).toBe(true);
  });

  it("hand edits after acking stay protected: acknowledged bucket, still skipped by init", () => {
    const dir = seedTree();
    runAdoptAck({ cwd: dir });
    writeFileSync(join(dir, "AGENTS.md"), "LATE HAND EDIT\n", "utf8");
    // An acked doc is sanctioned-diverged, not modified (doctor honesty) —
    // but the hand edit after the ack IS visible in the informational
    // acknowledgedDrifted bucket (bug-ack-drift-promise).
    expect(runDoctor({ cwd: dir }).docs).toMatchObject({
      modified: 0,
      untouched: 0,
      acknowledged: 16,
      acknowledgedDrifted: 1,
    });
    // The state keeps the acked baseline, not the hand edit.
    expect(readConventionConfig(dir).generated["AGENTS.md"]!.checksum).not.toBe(
      checksumOf("LATE HAND EDIT\n"),
    );
    // And a later init keeps the hand edit (skipped, never overwritten —
    // acknowledged entries are never regenerated regardless of hash).
    const result = runInit({ dir, force: false, full: true });
    expect(result.modified).not.toContain("AGENTS.md");
    expect(result.updated).not.toContain("AGENTS.md");
    expect(result.skipped).toContain("AGENTS.md");
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toBe("LATE HAND EDIT\n");
  });

  it("creates nothing: untracked docs stay untracked, missing files are skipped", () => {
    const dir = seedTree();
    // Adopter-owned doc with no x-generated entry.
    writeFileSync(join(dir, "docs/index.md"), "ADOPTER OWNED\n", "utf8");
    // A tracked doc missing on disk.
    rmSync(join(dir, "SUPPORT.md"));
    const baseline = readConventionConfig(dir).generated["SUPPORT.md"]!.checksum;

    const result = runAdoptAck({ cwd: dir });
    const paths = result.acked.map((doc) => doc.path);
    expect(paths).not.toContain("docs/index.md");
    expect(paths).not.toContain("SUPPORT.md");
    expect(readFileSync(join(dir, "docs/index.md"), "utf8")).toBe("ADOPTER OWNED\n");
    const config = readConventionConfig(dir);
    expect(config.generated["docs/index.md"]).toBeUndefined();
    // The missing file's entry keeps its old checksum (still missing, not acked).
    expect(config.generated["SUPPORT.md"]!.checksum).toBe(baseline);
    // The other tracked docs are still acked and present.
    expect(config.generated["AGENTS.md"]).toBeDefined();
    expect(result.count).toBe(16);
  });

  it("is standalone: works when the adoption task is already done", () => {
    const dir = seedTree();
    runAdopt({ cwd: dir });
    runUpdate({ cwd: dir, id: ADOPT_TASK_ID, status: "in_progress", assignee: "adopt-bot" });
    runUpdate({ cwd: dir, id: ADOPT_TASK_ID, status: "done", unassign: true });
    const result = runAdoptAck({ cwd: dir });
    expect(result.count).toBe(17);
  });

  it("with no x-generated entries the ack is a no-op (state file byte-identical)", () => {
    const dir = tempDir("arggon-adopt-ack-nostate-");
    runInit({ dir, force: false, full: true });
    const yml = join(dir, "tasks/.convention.yml");
    writeFileSync(yml, updateGeneratedSection(readFileSync(yml, "utf8"), {}), "utf8");
    const before = readFileSync(yml, "utf8");
    const result = runAdoptAck({ cwd: dir });
    expect(result.acked).toEqual([]);
    expect(result.count).toBe(0);
    expect(readFileSync(yml, "utf8")).toBe(before);
  });

  it("requires an initialized tree", () => {
    const dir = tempDir("arggon-adopt-ack-naked-");
    expect(() => runAdoptAck({ cwd: dir })).toThrow(/not an arggon-managed tree.*arggon init/s);
  });
});

describe("formatAdoptAckReport", () => {
  it("lists the acked docs with their new checksums plus the count", () => {
    const dir = seedTree();
    const report = formatAdoptAckReport(runAdoptAck({ cwd: dir }));
    expect(report).toContain("17 generated doc(s) acknowledged as the new baseline");
    expect(report).toContain("AGENTS.md — sha256:");
    expect(report).toContain(".agents/skills/arggon-cli/SKILL.md — sha256:");
  });
});

describe("adopt --ack via the CLI (--json)", () => {
  it("acks the generated docs and reports the v1 payload", () => {
    const dir = seedTree();
    writeFileSync(join(dir, "AGENTS.md"), "SWEEP: project description\n", "utf8");
    const proc = runCli(["adopt", "--ack", "--json"], dir);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as {
      ok: boolean;
      schemaVersion: number;
      conventionVersion: number;
      command: string;
      acked: { path: string; checksum: string }[];
      count: number;
    };
    expect(body.ok).toBe(true);
    expect(body.schemaVersion).toBe(1);
    expect(body.conventionVersion).toBe(3);
    expect(body.command).toBe("adopt");
    const agents = body.acked.find((doc) => doc.path === "AGENTS.md")!;
    expect(agents.checksum).toBe(checksumOf("SWEEP: project description\n"));
    expect(body.count).toBe(body.acked.length);
    expect(runDoctor({ cwd: dir }).docs.modified).toBe(0);
  });

  it("prints the acked list + count in human output", () => {
    const dir = seedTree();
    const proc = runCli(["adopt", "--ack"], dir);
    expect(proc.status).toBe(0);
    expect(proc.stdout).toContain("acknowledged as the new baseline");
    expect(proc.stdout).toContain("AGENTS.md — sha256:");
  });

  it("fails with ADOPT_FAILED on a non-initialized tree", () => {
    const dir = tempDir("arggon-adopt-ack-cli-naked-");
    const proc = runCli(["adopt", "--ack", "--json"], dir);
    expect(proc.status).toBe(1);
    const body = JSON.parse(proc.stdout) as {
      ok: boolean;
      command: string;
      error: { code: string; message: string };
    };
    expect(body.ok).toBe(false);
    expect(body.command).toBe("adopt");
    expect(body.error.code).toBe("ADOPT_FAILED");
    expect(body.error.message).toContain("arggon init");
  });
});
