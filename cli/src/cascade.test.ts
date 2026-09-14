/**
 * Automatic container completion tests (task-container-auto-done).
 *
 * When an update reaches a terminal state (done/cancelled) and every
 * sibling under a parent is terminal too, ancestor containers complete as
 * `done`, cascading up to the initiative. `--no-cascade` / cascade:false
 * opts out. The result names the affected container TYPES (`cascadeLevels`)
 * so callers can tell when the cascade reached epic level or above.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadItems } from "./items.js";
import { runCreate } from "./create.js";
import { parseFrontmatter } from "./frontmatter.js";
import { runInit } from "./init.js";
import { runUpdate } from "./update.js";

const NOW = new Date("2026-09-11T12:00:00Z");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = resolve(root, "cli/src/cli.ts");
const tsx = resolve(root, "node_modules/tsx/dist/cli.mjs");

function runCli(args: string[], cwd: string) {
  return spawnSync(process.execPath, [tsx, cli, ...args], { encoding: "utf8", cwd });
}

function chainTree(): { dir: string; tasks: string[]; bug: string } {
  const dir = mkdtempSync(join(tmpdir(), "arggon-cascade-"));
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch", id: "launch", now: NOW });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch", id: "epic-a", now: NOW });
  runCreate({
    cwd: dir,
    type: "story",
    title: "Login",
    parent: "epic-a",
    id: "story-a",
    now: NOW,
  });
  const t1 = runCreate({
    cwd: dir,
    type: "task",
    title: "One",
    parent: "story-a",
    id: "task-one",
    now: NOW,
  });
  const t2 = runCreate({
    cwd: dir,
    type: "task",
    title: "Two",
    parent: "story-a",
    id: "task-two",
    now: NOW,
  });
  const bug = runCreate({
    cwd: dir,
    type: "bug",
    title: "Bug",
    parent: "story-a",
    id: "bug-x",
    now: NOW,
  });
  for (const container of ["launch", "epic-a", "story-a"]) stripChecklist(dir, container);
  return { dir, tasks: [t1.id, t2.id], bug: bug.id };
}

/**
 * Remove the template's acceptance checklist (`- [ ]` lines) from an item
 * body, simulating a container WITHOUT an acceptance contract. The new
 * acceptance-aware rule (task-cascade-acceptance-aware) never auto-completes
 * containers with unchecked boxes; the pre-existing cascade fixtures exercise
 * the no-checklist behavior, so their bodies must be checklist-free.
 */
function stripChecklist(dir: string, id: string): void {
  const tasksDir = join(dir, "tasks");
  const walk = (current: string): string[] =>
    readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
      const full = join(current, entry.name);
      return entry.isDirectory() ? walk(full) : full;
    });
  const file = walk(tasksDir).find((f) => f.endsWith(`/${id}.md`));
  if (!file) throw new Error(`stripChecklist: '${id}' not found under ${tasksDir}`);
  const stripped = readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => !/^[ \t]*[-*] \[( |x|X)\]/.test(line))
    .join("\n");
  writeFileSync(file, stripped, "utf8");
}

function claimAndDone(dir: string, id: string): void {
  runUpdate({ cwd: dir, id, status: "in_progress", assignee: "worker", now: NOW });
  runUpdate({ cwd: dir, id, status: "done", now: NOW });
}

function statusOf(dir: string, id: string): string {
  return loadItems(join(dir, "tasks")).find((i) => i.id === id)!.status;
}

describe("automatic container completion", () => {
  it("cascades up the whole chain when the last descendant closes", () => {
    const { dir, tasks, bug } = chainTree();
    claimAndDone(dir, tasks[0]);
    claimAndDone(dir, tasks[1]);
    // story-a still open (bug-x todo): closing bug-x completes everything.
    runUpdate({ cwd: dir, id: bug, status: "in_progress", assignee: "worker", now: NOW });
    const result = runUpdate({ cwd: dir, id: bug, status: "done", now: NOW });
    expect(result.autoCompleted).toEqual(["story-a", "epic-a", "launch"]);
    expect(result.cascadeLevels).toEqual(["story", "epic", "initiative"]);
    expect(statusOf(dir, "story-a")).toBe("done");
    expect(statusOf(dir, "epic-a")).toBe("done");
    expect(statusOf(dir, "launch")).toBe("done");
  });

  it("does not flip containers while an open descendant remains", () => {
    const { dir, tasks } = chainTree();
    const result = runUpdate({
      cwd: dir,
      id: tasks[0],
      status: "in_progress",
      assignee: "worker",
      now: NOW,
    });
    runUpdate({ cwd: dir, id: tasks[0], status: "done", now: NOW });
    expect(result.autoCompleted).toEqual([]);
    expect(statusOf(dir, "story-a")).toBe("todo");
    expect(statusOf(dir, "launch")).toBe("todo");
  });

  it("records a subtree-open skip naming the blocking sibling (task-cascade-subtree-open-visibility)", () => {
    const { dir, tasks } = chainTree();
    // Flip two leaves done, leaving bug-x open: the ancestor walk stops at
    // story-a because a sibling subtree (bug-x) is still open.
    runUpdate({ cwd: dir, id: tasks[0], status: "in_progress", assignee: "worker", now: NOW });
    runUpdate({ cwd: dir, id: tasks[0], status: "done", now: NOW });
    runUpdate({ cwd: dir, id: tasks[1], status: "in_progress", assignee: "worker", now: NOW });
    const result = runUpdate({ cwd: dir, id: tasks[1], status: "done", now: NOW });
    expect(result.autoCompleted).toEqual([]);
    expect(result.cascadeSkipped).toEqual([
      { id: "story-a", type: "story", reason: "subtree-open", sibling: "bug-x" },
    ]);
    expect(statusOf(dir, "story-a")).toBe("todo");
    // No silent stop above the skip either: nothing completed, nothing else skipped.
    expect(result.cascadeLevels).toEqual([]);
  });

  it("records no subtree-open skip when the walk completes or stops for acceptance", () => {
    const { dir, tasks, bug } = chainTree();
    // Full close: cascade completes, no skips.
    claimAndDone(dir, tasks[0]);
    claimAndDone(dir, tasks[1]);
    runUpdate({ cwd: dir, id: bug, status: "in_progress", assignee: "worker", now: NOW });
    const done = runUpdate({ cwd: dir, id: bug, status: "done", now: NOW });
    expect(done.cascadeSkipped).toEqual([]);
    expect(done.autoCompleted).toEqual(["story-a", "epic-a", "launch"]);
  });

  it("counts cancelled as closed and completes the parent as done", () => {
    const { dir, tasks, bug } = chainTree();
    runUpdate({ cwd: dir, id: tasks[0], status: "cancelled", now: NOW });
    runUpdate({ cwd: dir, id: tasks[1], status: "cancelled", now: NOW });
    runUpdate({ cwd: dir, id: bug, status: "in_progress", assignee: "worker", now: NOW });
    const result = runUpdate({ cwd: dir, id: bug, status: "done", now: NOW });
    expect(result.autoCompleted).toEqual(["story-a", "epic-a", "launch"]);
  });

  it("completes a story stuck in todo directly (unattended exception)", () => {
    const { dir, tasks, bug } = chainTree();
    claimAndDone(dir, tasks[0]);
    claimAndDone(dir, tasks[1]);
    claimAndDone(dir, bug);
    // story-a was never claimed (todo): the cascade completed it directly.
    expect(statusOf(dir, "story-a")).toBe("done");
    expect(statusOf(dir, "epic-a")).toBe("done");
  });

  it("cascade:false leaves ancestors untouched", () => {
    const { dir, tasks, bug } = chainTree();
    claimAndDone(dir, tasks[0]);
    claimAndDone(dir, tasks[1]);
    runUpdate({ cwd: dir, id: bug, status: "in_progress", assignee: "worker", now: NOW });
    const result = runUpdate({ cwd: dir, id: bug, status: "done", cascade: false, now: NOW });
    expect(result.autoCompleted).toEqual([]);
    expect(result.cascadeLevels).toEqual([]);
    expect(statusOf(dir, "story-a")).toBe("todo");
    expect(statusOf(dir, "launch")).toBe("todo");
  });

  it("reports only the story level when a sibling story keeps the epic open", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-cascade-"));
    runInit({ dir, force: false });
    runCreate({ cwd: dir, type: "initiative", title: "Launch", id: "launch", now: NOW });
    runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch", id: "epic-a", now: NOW });
    runCreate({
      cwd: dir,
      type: "story",
      title: "Login",
      parent: "epic-a",
      id: "story-a",
      now: NOW,
    });
    runCreate({
      cwd: dir,
      type: "story",
      title: "Signup",
      parent: "epic-a",
      id: "story-b",
      now: NOW,
    });
    runCreate({
      cwd: dir,
      type: "task",
      title: "One",
      parent: "story-a",
      id: "task-one",
      now: NOW,
    });
    runCreate({
      cwd: dir,
      type: "task",
      title: "Two",
      parent: "story-a",
      id: "task-two",
      now: NOW,
    });
    for (const container of ["launch", "epic-a", "story-a"]) stripChecklist(dir, container);
    claimAndDone(dir, "task-one");
    runUpdate({ cwd: dir, id: "task-two", status: "in_progress", assignee: "worker", now: NOW });
    const result = runUpdate({ cwd: dir, id: "task-two", status: "done", now: NOW });
    expect(result.autoCompleted).toEqual(["story-a"]);
    expect(result.cascadeLevels).toEqual(["story"]);
    expect(statusOf(dir, "epic-a")).toBe("todo");
  });

  it("skips already-terminal containers but keeps completing their ancestors", () => {
    const { dir, tasks, bug } = chainTree();
    claimAndDone(dir, tasks[0]);
    claimAndDone(dir, tasks[1]);
    // Complete story-a manually, out of order, while bug-x is still open.
    runUpdate({ cwd: dir, id: "story-a", status: "in_progress", assignee: "alice", now: NOW });
    runUpdate({ cwd: dir, id: "story-a", status: "done", now: NOW });
    runUpdate({ cwd: dir, id: "epic-a", status: "in_progress", now: NOW });
    // bug-x closes last: story-a is already done (skipped), epic-a and launch complete.
    runUpdate({ cwd: dir, id: bug, status: "in_progress", assignee: "worker", now: NOW });
    const result = runUpdate({ cwd: dir, id: bug, status: "done", now: NOW });
    expect(result.autoCompleted).toEqual(["epic-a", "launch"]);
    expect(statusOf(dir, "story-a")).toBe("done");
    expect(statusOf(dir, "epic-a")).toBe("done");
    expect(statusOf(dir, "launch")).toBe("done");
  });

  it("writes the auto-completed status into the container frontmatter", () => {
    const { dir, tasks, bug } = chainTree();
    claimAndDone(dir, tasks[0]);
    claimAndDone(dir, tasks[1]);
    runUpdate({ cwd: dir, id: bug, status: "in_progress", assignee: "worker", now: NOW });
    runUpdate({ cwd: dir, id: bug, status: "done", now: NOW });
    const fm = parseFrontmatter(
      readFileSync(join(dir, "tasks/launch/epic-a/story-a/story-a.md"), "utf8"),
    );
    expect(fm.data.status).toBe("done");
    expect(fm.data.updated).toBe("2026-09-11");
  });
});

/**
 * Cascade predictability (task-cascade-predictability): the human output of
 * `arggon update` carries a visible warning when the cascade auto-completes
 * containers at epic level or above. Cascades that stop at a story stay
 * quiet (the plain auto-completed line is enough). The `--json` envelope
 * gains `cascadeLevels` additively (ids were already in `autoCompleted`).
 */
describe("cascade notice in human output", () => {
  /** Kernel-built tree; only the final `update` goes through the real CLI. */
  function cliTree(): { dir: string; last: string } {
    const { dir, tasks, bug } = chainTree();
    claimAndDone(dir, tasks[0]);
    claimAndDone(dir, tasks[1]);
    runUpdate({ cwd: dir, id: bug, status: "in_progress", assignee: "worker", now: NOW });
    return { dir, last: bug };
  }

  it("warns on human output when the cascade reaches epic level", () => {
    const { dir, last } = cliTree();
    const res = runCli(["update", last, "--status", "done"], dir);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("auto-completed: story-a, epic-a, launch");
    expect(res.stdout).toContain(
      "⚠ cascade: auto-completed epic 'epic-a' (and 1 more ancestor)" +
        " — use --no-cascade to keep containers open",
    );
  });

  it("stays quiet when only a story auto-completes", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-cascade-"));
    runInit({ dir, force: false });
    runCreate({ cwd: dir, type: "initiative", title: "Launch", id: "launch", now: NOW });
    runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch", id: "epic-a", now: NOW });
    runCreate({
      cwd: dir,
      type: "story",
      title: "Login",
      parent: "epic-a",
      id: "story-a",
      now: NOW,
    });
    runCreate({
      cwd: dir,
      type: "story",
      title: "Signup",
      parent: "epic-a",
      id: "story-b",
      now: NOW,
    });
    runCreate({
      cwd: dir,
      type: "task",
      title: "One",
      parent: "story-a",
      id: "task-one",
      now: NOW,
    });
    runCreate({
      cwd: dir,
      type: "task",
      title: "Two",
      parent: "story-a",
      id: "task-two",
      now: NOW,
    });
    for (const container of ["launch", "epic-a", "story-a"]) stripChecklist(dir, container);
    claimAndDone(dir, "task-one");
    runUpdate({ cwd: dir, id: "task-two", status: "in_progress", assignee: "worker", now: NOW });
    const res = runCli(["update", "task-two", "--status", "done"], dir);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("auto-completed: story-a");
    expect(res.stdout).not.toContain("cascade: auto-completed");
  });

  it("keeps the --json envelope additive with cascadeLevels", () => {
    const { dir, last } = cliTree();
    const res = runCli(["update", last, "--status", "done", "--json"], dir);
    expect(res.status).toBe(0);
    const envelope = JSON.parse(res.stdout) as {
      ok: boolean;
      autoCompleted: string[];
      cascadeLevels: string[];
    };
    expect(envelope.ok).toBe(true);
    expect(envelope.autoCompleted).toEqual(["story-a", "epic-a", "launch"]);
    expect(envelope.cascadeLevels).toEqual(["story", "epic", "initiative"]);
  });
});

/**
 * Acceptance-aware cascade (task-cascade-acceptance-aware): the tie-breakers
 * scenario. A container whose OWN body still has unchecked acceptance
 * checkboxes is never auto-completed — "done = acceptance checklist
 * complete" wins over status mirroring. Nothing above the skipped container
 * completes either (its subtree is not closed). Containers without any
 * checklist keep completing as before.
 */
describe("acceptance-aware cascade", () => {
  /** story-a gets an acceptance contract (its body gains a checklist). */
  function storyWithChecklist(dir: string, box: "[ ]" | "[x]"): void {
    const path = join(dir, "tasks/launch/epic-a/story-a/story-a.md");
    const raw = readFileSync(path, "utf8");
    const section = `## Acceptance\n\n- ${box} tie-breakers resolved\n`;
    const withSection = raw.includes("## Acceptance")
      ? raw.replace(/## Acceptance[\s\S]*$/, section)
      : `${raw}\n${section}`;
    writeFileSync(path, withSection, "utf8");
  }

  it("does not auto-complete a story with an unchecked acceptance box (nor its ancestors)", () => {
    const { dir, tasks, bug } = chainTree();
    storyWithChecklist(dir, "[ ]");
    claimAndDone(dir, tasks[0]);
    claimAndDone(dir, tasks[1]);
    runUpdate({ cwd: dir, id: bug, status: "in_progress", assignee: "worker", now: NOW });
    const result = runUpdate({ cwd: dir, id: bug, status: "done", now: NOW });
    expect(result.autoCompleted).toEqual([]);
    expect(result.cascadeSkipped).toEqual([
      { id: "story-a", type: "story", reason: "acceptance-incomplete" },
    ]);
    expect(statusOf(dir, "story-a")).toBe("todo");
    expect(statusOf(dir, "epic-a")).toBe("todo");
    expect(statusOf(dir, "launch")).toBe("todo");
  });

  it("completes the chain once the acceptance box is ticked", () => {
    const { dir, tasks, bug } = chainTree();
    storyWithChecklist(dir, "[ ]");
    claimAndDone(dir, tasks[0]);
    claimAndDone(dir, tasks[1]);
    runUpdate({ cwd: dir, id: bug, status: "in_progress", assignee: "worker", now: NOW });
    const blocked = runUpdate({ cwd: dir, id: bug, status: "done", now: NOW });
    expect(blocked.cascadeSkipped).toHaveLength(1);
    // Tick the box (the honest path to done) and re-run any terminal update.
    storyWithChecklist(dir, "[x]");
    const result = runUpdate({ cwd: dir, id: bug, status: "done", now: NOW });
    expect(result.cascadeSkipped).toEqual([]);
    expect(result.autoCompleted).toEqual(["story-a", "epic-a", "launch"]);
    expect(statusOf(dir, "story-a")).toBe("done");
    expect(statusOf(dir, "launch")).toBe("done");
  });

  it("treats a fully-ticked checklist as acceptance-complete", () => {
    const { dir, tasks, bug } = chainTree();
    storyWithChecklist(dir, "[x]");
    claimAndDone(dir, tasks[0]);
    claimAndDone(dir, tasks[1]);
    runUpdate({ cwd: dir, id: bug, status: "in_progress", assignee: "worker", now: NOW });
    const result = runUpdate({ cwd: dir, id: bug, status: "done", now: NOW });
    expect(result.autoCompleted).toEqual(["story-a", "epic-a", "launch"]);
    expect(result.cascadeSkipped).toEqual([]);
  });

  it("surfaces the skip in human output and the --json envelope", () => {
    const { dir, tasks, bug } = chainTree();
    storyWithChecklist(dir, "[ ]");
    claimAndDone(dir, tasks[0]);
    claimAndDone(dir, tasks[1]);
    runUpdate({ cwd: dir, id: bug, status: "in_progress", assignee: "worker", now: NOW });
    const human = runCli(["update", bug, "--status", "done"], dir);
    expect(human.status).toBe(0);
    expect(human.stdout).toContain(
      "cascade skipped: story 'story-a' — acceptance checklist incomplete",
    );
    // Second tree for the JSON run (the first run already consumed the state).
    const { dir: dir2, tasks: tasks2, bug: bug2 } = chainTree();
    storyWithChecklist(dir2, "[ ]");
    claimAndDone(dir2, tasks2[0]);
    claimAndDone(dir2, tasks2[1]);
    runUpdate({ cwd: dir2, id: bug2, status: "in_progress", assignee: "worker", now: NOW });
    const res = runCli(["update", bug2, "--status", "done", "--json"], dir2);
    expect(res.status).toBe(0);
    const envelope = JSON.parse(res.stdout) as {
      cascadeSkipped: Array<{ id: string; reason: string }>;
    };
    expect(envelope.cascadeSkipped).toEqual([
      { id: "story-a", type: "story", reason: "acceptance-incomplete" },
    ]);
  });

  it("acceptanceComplete: no checklist, all-checked, and unchecked cases", async () => {
    const { acceptanceComplete } = await import("./items.js");
    expect(acceptanceComplete("no checkboxes here")).toBe(true);
    expect(acceptanceComplete("- [x] done\n- [X] also done")).toBe(true);
    expect(acceptanceComplete("  - [ ] indented pending")).toBe(false);
    expect(acceptanceComplete("- [x] done\n- [ ] pending")).toBe(false);
  });
});
