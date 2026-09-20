/**
 * Automatic container completion tests (task-container-auto-done).
 *
 * When an update reaches a terminal state (done/cancelled) and every
 * sibling under a parent is terminal too, ancestor containers complete as
 * `done`, cascading up to the initiative. `--no-cascade` / cascade:false
 * opts out. The result names the affected container TYPES (`cascadeLevels`)
 * so callers can tell when the cascade reached epic level or above.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync as _mkdtempSync, closeSync, openSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { loadItems } from "./items.js";
import { runCreate } from "./create.js";
import { parseFrontmatter } from "./frontmatter.js";
import { runInit } from "./init.js";
import { lockFilePathFor } from "./lock.js";
import { removeFixtureTree } from "./test-tmp.js";
import { runUpdate } from "./update.js";

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test
// through the shared bounded-retry helper (test-tmp.ts) — the real CLI
// children spawned by the race tests settle only on close, and a
// still-settling fs entry must never trip the one-shot ENOTEMPTY race in
// plain recursive rmSync.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) removeFixtureTree(dir);
});
function mkdtempSync(prefix: string, options?: { encoding?: "utf8" }): string {
  const dir = _mkdtempSync(prefix, options);
  tmpDirs.push(dir);
  return dir;
}

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
  const tasksDir = join(dir, "ArggonManager");
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
  return loadItems(join(dir, "ArggonManager")).find((i) => i.id === id)!.status;
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
      readFileSync(join(dir, "ArggonManager/launch/epic-a/story-a/story-a.md"), "utf8"),
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

  it("always emits cascadeSkipped and autoCompleted as arrays, empty when no cascade (bug-cascadeskipped-array-alignment)", () => {
    const { dir, last } = cliTree();
    // Non-terminal status: cascade does not run at all.
    const res = runCli(["update", last, "--title", "renamed", "--json"], dir);
    expect(res.status).toBe(0);
    const envelope = JSON.parse(res.stdout) as {
      ok: boolean;
      autoCompleted: string[];
      cascadeSkipped: string[];
    };
    expect(envelope.ok).toBe(true);
    expect(envelope.autoCompleted).toEqual([]);
    expect(envelope.cascadeSkipped).toEqual([]);
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
    const path = join(dir, "ArggonManager/launch/epic-a/story-a/story-a.md");
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

/**
 * Cascade ancestor-write guard (bug-cascade-lost-update).
 *
 * Before the fix, autoCompleteAncestors wrote ancestor files while holding
 * only the CHILD's item lock. The interleave that loses data:
 *
 *   P1 (cascade from a child done-flip)      P2 (direct update of the ancestor)
 *   ---------------------------------        ----------------------------------
 *   holds CHILD lock only                    acquires ANCESTOR lock
 *   reads ancestor snapshot S_old            reads ancestor, edits, writes
 *   writes ancestor from S_old  ----clobber---->  P2's change is LOST
 *                                            (or symmetric: P1's done is lost
 *                                             when P2 writes back its stale read)
 *
 * The child lock covers one item, not the ancestor write set, so nothing
 * serialized the two writers on the ancestor file. The fix holds the
 * ANCESTOR's item lock across the cascade's fresh re-read + write, with the
 * documented lock ordering CHILD -> ANCESTORS strictly upward.
 */
describe("cascade ancestor-write guard (bug-cascade-lost-update)", () => {
  type Json = Record<string, unknown>;

  /** Spawn one `arggon ... --json` process; resolve its parsed last-line JSON + stderr. */
  function spawnJson(args: string[], cwd: string, timeoutMs: number): Promise<Json | null> {
    return new Promise((resolvePromise) => {
      const child = spawn(process.execPath, [tsx, cli, ...args], {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let out = "";
      let err = "";
      child.stdout.on("data", (chunk: string) => (out += chunk));
      child.stderr.on("data", (chunk: string) => (err += chunk));
      child.on("close", () => {
        const trimmed = out.trim();
        resolvePromise(trimmed ? (JSON.parse(trimmed.split("\n").pop() ?? trimmed) as Json) : null);
      });
      setTimeout(() => child.kill("SIGKILL"), timeoutMs).unref();
      void err;
    });
  }

  /** Tree where bug-x is the LAST open leaf: flipping it done fires the full cascade. */
  function primedTree(): { dir: string; bug: string; storyPath: string } {
    const { dir, bug } = chainTree();
    claimAndDone(dir, "task-one");
    claimAndDone(dir, "task-two");
    runUpdate({ cwd: dir, id: bug, status: "in_progress", assignee: "worker", now: NOW });
    return { dir, bug, storyPath: join(dir, "ArggonManager/launch/epic-a/story-a/story-a.md") };
  }

  /** Hold the story's item lock from THIS test process (same lock family/format as lock.ts). */
  function holdLock(itemPath: string): { release: () => void; lockPath: string } {
    const lockPath = lockFilePathFor(itemPath);
    const fd = openSync(lockPath, "wx");
    writeFileSync(fd, JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }));
    return { lockPath, release: () => { try { unlinkSync(lockPath); } finally { closeSync(fd); } } };
  }

  it(
    "repro: the cascade never writes an ancestor while the ancestor's item lock is held",
    async () => {
      const { dir, bug, storyPath } = primedTree();
      const { release } = holdLock(storyPath);
      try {
        // The done-flip runs in a REAL separate process (its pid differs from
        // ours, so the lock genuinely contends). Before the fix the cascade
        // wrote story-a WITHOUT ever trying to take its lock: story-a ended
        // "done" even though another writer held the lock and was mid
        // read-modify-write on the same file — the lost-update window, open
        // deterministically. With the guard, the cascade blocks, times out
        // per the lock-family convention, and REPORTS the skip instead of
        // writing unguarded.
        const body = await spawnJson(["update", bug, "--status", "done", "--json"], dir, 25_000);
        expect(body).not.toBeNull();
        expect(body!.ok).toBe(true);
        // The guard held: nothing was written to the locked ancestor...
        expect(statusOf(dir, "story-a")).toBe("todo");
        // ...and the skip is reported, not silent.
        expect(body!.cascadeSkipped).toEqual([
          { id: "story-a", type: "story", reason: "lock-timeout" },
        ]);
        expect(body!.autoCompleted).toEqual([]);
      } finally {
        release();
      }

      // The child's own flip landed even though the cascade was skipped (the
      // skip must never fail a succeeded mutation).
      expect(statusOf(dir, bug)).toBe("done");

      // Retrigger the cascade (any terminal update re-walks the ancestors):
      // with the lock released, the story completes and the chain closes.
      const retried = runUpdate({ cwd: dir, id: bug, status: "done", now: NOW });
      expect(retried.autoCompleted).toEqual(["story-a", "epic-a", "launch"]);
      expect(retried.cascadeSkipped).toEqual([]);
      expect(statusOf(dir, "story-a")).toBe("done");
      expect(statusOf(dir, "launch")).toBe("done");
    },
    40_000, // the guarded cascade waits out the 10s lock budget in a real process
  );

  it("two concurrent sibling done-flips both land and the ancestor ends consistent", async () => {
    // Three rounds of the exact torture-scenario-1 shape (task two siblings
    // racing their final done-flips into the same cascade) — each round on a
    // fresh tree so both siblings are genuinely open.
    for (let round = 0; round < 3; round++) {
      // Fresh tree per round: task-one closed up front; task-two and bug-x
      // both primed to in_progress so TWO siblings can race their final
      // done-flips — each flip's cascade walks the same story/epic/initiative
      // files from a separate process.
      const { dir, bug } = chainTree();
      claimAndDone(dir, "task-one");
      runUpdate({ cwd: dir, id: "task-two", status: "in_progress", assignee: "worker", now: NOW });
      runUpdate({ cwd: dir, id: bug, status: "in_progress", assignee: "worker", now: NOW });

      const [flip, retitle] = await Promise.all([
        spawnJson(["update", bug, "--status", "done", "--json"], dir, 30_000),
        spawnJson(["update", "task-two", "--status", "done", "--json"], dir, 30_000),
      ]);

      // Both flips succeeded — neither status was lost (the child writes were
      // already lock-serialized; this asserts no regression).
      expect(flip, `round ${round}: ${JSON.stringify(flip)}`).toMatchObject({ ok: true });
      expect(retitle, `round ${round}: ${JSON.stringify(retitle)}`).toMatchObject({ ok: true });
      expect(statusOf(dir, bug)).toBe("done");
      expect(statusOf(dir, "task-two")).toBe("done");

      // The ancestor ends CONSISTENT: whoever's cascade fired last saw a
      // closed subtree and completed it — or both reported the walk honestly
      // (subtree-open) if their snapshots predate the other's write. What is
      // forbidden is a silent half-state, so retrigger and require closure.
      const closed = runUpdate({ cwd: dir, id: bug, status: "done", now: NOW });
      expect(closed.cascadeSkipped).toEqual([]);
      expect(statusOf(dir, "story-a")).toBe("done");
      expect(statusOf(dir, "epic-a")).toBe("done");
      expect(statusOf(dir, "launch")).toBe("done");
      removeFixtureTree(dir);
    }
  }, 120_000);
});
