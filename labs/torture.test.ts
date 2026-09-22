/**
 * Adversarial lab (task-adversarial-lab, story-self-improvement).
 *
 * The five adoption experiments (arggon-cv, cuentas-claras, guardian, suizo,
 * racha — reference repos under /home/arggon/Projects/<name>) produced ~20
 * findings, ALL from cross-cutting scenarios: real-process concurrency, gate
 * probes from every entry point, upgrade flows over acked state, legacy-tree
 * adoption, long MCP sessions. This suite turns those one-off scripts into a
 * permanent lab so the tool's governance invariants are enforced by CI, not
 * by weeks of agent experiments.
 *
 * PRINCIPLE: cross-cutting flows and real-process contention only. Unit-level
 * coverage that already exists is NOT re-tested here:
 * - single-winner claim starts (same/different assignee, worktrees)
 *     -> covered by cli/src/claim-race.test.ts (bug-claim-race-no-lock, PR #134)
 * - lock primitives/stale-lock breaking                      -> cli/src/lock.test.ts
 * - cascade semantics (auto-complete, acceptance skips)      -> cli/src/cascade.test.ts
 * - steal/reopen gate internals (TTY prompt parsing, arming) -> cli/src/steal-gate.test.ts,
 *                                                              cli/src/reopen-gate.test.ts
 * - MCP rules refusal in-process + tool schema               -> cli/src/mcp-server.test.ts,
 *                                                              cli/src/mcp-parity.test.ts
 * - MCP stdio handshake with one client                      -> cli/src/mcp-smoke.test.ts
 * - acked-doc regeneration in-process (bug-ack-baseline-regen-loss)
 *     -> cli/src/init-docs.test.ts, cli/src/adopt.test.ts (PR #127)
 * - tracker auto-commit path selection (single process)      -> cli/src/tracker-commit.test.ts
 *
 * SCENARIO CATALOG (scenario -> origin experiment/finding -> what it asserts):
 *
 * 1. Mixed concurrent operations on one fresh item family (N=8 processes)
 *    origin: suizo claim race / bug-claim-race-no-lock (fix PR #134), extended
 *    beyond the unit race with a MIX of operations.
 *    asserts: exactly one claimant wins; every loser gets a deterministic
 *    refusal (claim conflict or lock timeout — never a stolen state); cascade
 *    pressure writes (closing a sibling while a title bump races the same
 *    file) and cross-item comments all land; `arggon validate` reports a
 *    corruption-free tree afterwards.
 *
 * 2. Concurrent tracker auto-commit contention (N=6 processes)
 *    origin: suizo observation "necesité reintentos por lock transitorio".
 *    asserts: all comments land in their item files; git's index.lock races
 *    resolve as success or a clean, reported failure — never a corrupted
 *    state, no index.lock left behind, validate ok. Both exposed bugs are
 *    FIXED and asserted below:
 *    - bug-comment-race-no-lock: runComment holds withItemLock, so
 *      same-item concurrent comments both land (the test after scenario 2).
 *    - bug-autocommit-silent-skip: commitTrackerMutation retries the
 *      index.lock race and reports unavoidable skips, so scenario 2 asserts
 *      the tree `git status`-clean. *
 * 3. Synthetic legacy tree, full adoption flow (end-to-end CLI)
 *    origin: guardian/cuentas-claras/suizo/racha — adopt auto-hierarchy + ack
 *    sweep. asserts: init --full preserves the adopter's old-school files;
 *    adopt auto-creates the container chain + sweep checklist task; the
 *    sanctioned hand edit + `adopt --ack` re-baselines; a re-run of init
 *    keeps the acked doc byte-identical (#127); `cleanup` runs clean.
 *
 * 4. Upgrade flow over acked state (end-to-end CLI)
 *    origin: guardian ack loss / bug-ack-baseline-regen-loss (fix PR #127).
 *    Deterministic path chosen: ack everything, then hand-edit (instead of
 *    mutating templates locally — that would race the shared templates/ dir).
 *    asserts: modified[]+skip with content preserved; a --backup re-run STILL
 *    never regenerates an acknowledged doc (ack wins over any hash); the
 *    unacked --backup archive+regenerate path is covered e2e on a fresh tree.
 *
 * 5. Gate probes from every entry point (full matrix in one place)
 *    origin: guardian/suizo steal + reopen probes. asserts for steal and
 *    reopen: (a) CLI non-TTY spawn refusal, (b) MCP arggon_update refusal,
 *    (c) kernel-direct semantics (steal refused, reopen legal for human
 *    callers) — consistent messages, no path that lets an agent through.
 *
 * 6. Long MCP session (~30 mixed tool calls, one server process)
 *    origin: estanteria 53-call session. extends mcp-smoke with volume and
 *    mixed operations: create x10, update/claim x10, comment x10, list —
 *    zero errors, clean shutdown.
 *
 * Heavy scenarios get explicit per-test timeouts (30-90s): each spawned
 * process pays the tsx compile cost. Temp dirs are `.evidence`-free throwaway
 * trees under os.tmpdir().
 */
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCreate, runUpdate } from "@arggondev/lib";
import { runInit } from "../cli/src/init.js";
import { removeFixtureTree } from "../cli/src/test-tmp.js";

import { GENERATED_DOC_COUNT } from "../cli/src/docs.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "cli/src/cli.ts");
const tsx = join(root, "node_modules/tsx/dist/cli.mjs");

type Json = Record<string, unknown>;

/** Spawn one `arggon ... --json` process and return its parsed last-line JSON + raw stderr. */
function runCli(args: string[], cwd: string): { body: Json | null; stderr: string } {
  const proc = spawnSync(process.execPath, [tsx, cli, ...args], {
    encoding: "utf8",
    cwd,
    env: { ...process.env },
  });
  const out = proc.stdout.trim();
  const body = out ? (JSON.parse(out.split("\n").pop() ?? out) as Json) : null;
  return { body, stderr: proc.stderr };
}

function git(args: string[], cwd: string): string {
  const r = spawnSync("git", args, { encoding: "utf8", cwd });
  expect(r.status, `git ${args.join(" ")}: ${r.stderr}`).toBe(0);
  return r.stdout.trim();
}

/** Commit the tracker only when something is actually staged (create/update already auto-commit in git repos). */
function gitCommitIfDirty(cwd: string, message: string): void {
  git(["add", "ArggonManager"], cwd);
  const staged = spawnSync("git", ["diff", "--cached", "--quiet"], { encoding: "utf8", cwd });
  if (staged.status !== 0) git(["commit", "--quiet", "-m", message], cwd);
}

/** Plain (non-git) initialized tree with launch/auth/story-login containers. */
function freshTree(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), `arggon-lab-${prefix}-`));
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch", id: "launch" });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch", id: "auth" });
  runCreate({ cwd: dir, type: "story", title: "Login", parent: "auth", id: "story-login" });
  return dir;
}

/** Initialized GIT repo with the scaffold committed and x-tracker settings appended. */
function freshGitTree(prefix: string, tracker: string): string {
  const dir = mkdtempSync(join(tmpdir(), `arggon-lab-${prefix}-`));
  git(["-c", "init.defaultBranch=main", "init", "--quiet"], dir);
  git(["config", "user.email", "test@example.com"], dir);
  git(["config", "user.name", "Test"], dir);
  runInit({ dir, force: false });
  const yml = join(dir, "ArggonManager/.convention.yml");
  writeFileSync(yml, `${readFileSync(yml, "utf8")}${tracker}`, "utf8");
  runCreate({ cwd: dir, type: "initiative", title: "Launch", id: "launch" });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch", id: "auth" });
  runCreate({ cwd: dir, type: "story", title: "Login", parent: "auth", id: "story-login" });
  // Fixture repo, not a working checkout: stage everything so `git status`
  // starts clean (init ran in-process, so nothing else commits the scaffold).
  git(["add", "-A"], dir);
  gitCommitIfDirty(dir, "init tracker");
  return dir;
}

type SpawnResult = { body: Json | null; stderr: string };

/** Spawn N CLI processes at once (real concurrency) and collect their JSON envelopes. */
function spawnAll(cwd: string, commands: Array<{ args: string[] }>): Promise<SpawnResult[]> {
  const children = commands.map(({ args }) =>
    spawn(process.execPath, [tsx, cli, ...args], {
      cwd,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
  return Promise.all(
    children.map(
      (child) =>
        new Promise<SpawnResult>((resolvePromise) => {
          let out = "";
          let err = "";
          child.stdout.on("data", (chunk: string) => (out += chunk));
          child.stderr.on("data", (chunk: string) => (err += chunk));
          child.on("close", () => {
            const trimmed = out.trim();
            const body = trimmed
              ? (JSON.parse(trimmed.split("\n").pop() ?? trimmed) as Json)
              : null;
            resolvePromise({ body, stderr: err });
          });
        }),
    ),
  );
}

function frontmatter(dir: string, ...segments: string[]): Record<string, string> {
  const raw = readFileSync(join(dir, "ArggonManager", ...segments), "utf8");
  const match = /^---\n([\s\S]*?)\n---/.exec(raw);
  const data: Record<string, string> = {};
  for (const line of (match?.[1] ?? "").split("\n")) {
    const kv = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (kv) data[kv[1]!] = kv[2]!.replace(/^"|"$/g, "");
  }
  return data;
}

// ---------------------------------------------------------------------------
// Scenario 1 — suizo claim race / bug-claim-race-no-lock (PR #134), extended
// ---------------------------------------------------------------------------

describe("lab: mixed concurrent operations on one item family (suizo / bug-claim-race-no-lock)", () => {
  it("N=8 processes (claims, sibling-done cascade pressure, comments): one claimant, deterministic losers, validate ok", async () => {
    const dir = freshTree("mixed");
    runCreate({
      cwd: dir,
      type: "task",
      title: "Race target",
      parent: "story-login",
      id: "task-target",
    });
    runCreate({
      cwd: dir,
      type: "task",
      title: "Sibling",
      parent: "story-login",
      id: "task-sibling",
    });
    // v0 transitions: todo -> done is illegal, so prime the sibling to
    // in_progress up front; the spawned processes then close it (cascade
    // pressure on the shared containers).
    runUpdate({ cwd: dir, id: "task-sibling", status: "in_progress", assignee: "worker" });

    const results = await spawnAll(dir, [
      // Claim contention on task-target: three different assignees + a same-assignee duplicate.
      {
        args: ["update", "task-target", "--status", "in_progress", "--assignee", "alice", "--json"],
      },
      { args: ["update", "task-target", "--status", "in_progress", "--assignee", "bob", "--json"] },
      {
        args: ["update", "task-target", "--status", "in_progress", "--assignee", "carol", "--json"],
      },
      {
        args: ["update", "task-target", "--status", "in_progress", "--assignee", "alice", "--json"],
      },
      // Cascade pressure: closing the sibling writes the story/epic/initiative
      // files too; a title bump races the same file from another process.
      { args: ["update", "task-sibling", "--status", "done", "--json"] },
      { args: ["update", "task-sibling", "--title", "Sibling v2", "--json"] },
      // Comments racing the claims. NOTE: they target DIFFERENT items —
      // same-item concurrent comments are covered by the test below
      // (bug-comment-race-no-lock, now fixed with withItemLock).
      { args: ["comment", "task-target", "observer one", "--author", "alice", "--json"] },
      { args: ["comment", "task-sibling", "observer two", "--author", "bob", "--json"] },
    ]);

    const claimResults = results.slice(0, 4);
    const okClaims = claimResults.filter((r) => r.body?.ok === true);
    const failedClaims = claimResults.filter((r) => r.body?.ok !== true);

    // Exactly one assignee survives across every successful claim.
    const assignees = new Set(okClaims.map((r) => (r.body!.item as Json).assignee as string));
    expect(assignees.size).toBe(1);
    const winner = [...assignees][0]!;
    const final = frontmatter(dir, "launch", "auth", "story-login", "task-target.md");
    expect(final.assignee).toBe(winner);
    expect(final.status).toBe("in_progress");

    // Every loser was refused deterministically: a claim conflict against
    // the surviving claim, or a lock timeout — never a silent overwrite
    // (that would be last-write-wins, the original bug).
    expect(failedClaims.length).toBeGreaterThanOrEqual(2);
    for (const r of failedClaims) {
      const error = r.body!.error as Json;
      expect(error.code).toBe("UPDATE_FAILED");
      const message = error.message as string;
      expect(/claim conflict|failed to acquire lock/.test(message)).toBe(true);
      if (/claim conflict/.test(message)) {
        expect(message).toContain(`claimed by '${winner}'`);
      }
    }

    // Cascade pressure + comments all landed without corrupting anything.
    const sibling = frontmatter(dir, "launch", "auth", "story-login", "task-sibling.md");
    expect(sibling.status).toBe("done");
    const target = readFileSync(
      join(dir, "ArggonManager/launch/auth/story-login/task-target.md"),
      "utf8",
    );
    expect(target).toContain("observer one");
    expect(
      readFileSync(join(dir, "ArggonManager/launch/auth/story-login/task-sibling.md"), "utf8"),
    ).toContain("observer two");

    // The tree is structurally sound after the storm.
    expect(runCli(["validate", "--json"], dir).body).toMatchObject({ ok: true });

    removeFixtureTree(dir);
  }, 90_000); // 8 concurrent tsx processes; generous wall-clock budget
});

// ---------------------------------------------------------------------------
// Scenario 2 — suizo: "necesité reintentos por lock transitorio"
// ---------------------------------------------------------------------------

describe("lab: concurrent tracker auto-commit contention (suizo lock-transitorio)", () => {
  it("N=6 commenting processes with x-tracker.auto-commit: all mutations committed, no index.lock debris", async () => {
    const dir = freshGitTree("autocommit", "x-tracker:\n  auto-commit: true\n");
    const ids = ["task-a", "task-b", "task-c", "task-d", "task-e", "task-f"];
    for (const id of ids) {
      runCreate({ cwd: dir, type: "task", title: id, parent: "story-login", id });
    }
    gitCommitIfDirty(dir, "seed tasks");

    // Six processes comment on six different items simultaneously — every
    // mutation ends in its own git commit, so git's index.lock is contended.
    // (The same-item variant is asserted by the test below — see
    // bug-comment-race-no-lock.)
    const commands = ids.map((id) => ({
      args: ["comment", id, `note on ${id}`, "--author", "agent", "--json"],
    }));
    const results = await spawnAll(dir, commands);

    // Either the mutation + commit succeeded, or the process reported a
    // clean failure — never a crash, never ok:false with the file mutated
    // but uncommitted and unexplained.
    const cleanSkips: string[] = [];
    results.forEach((r, i) => {
      expect(r.body).not.toBeNull();
      if (r.body!.ok !== true) {
        const message = (r.body!.error as Json).message as string;
        expect(/lock|index/i.test(message)).toBe(true);
        cleanSkips.push(ids[i]!);
        return;
      }
      // bug-torture-contention-flake2: a CONTENTION skip can also arrive as
      // ok:true with a `commit.skipped` payload. Under concurrent commits,
      // one process's `git commit` rewrites the index between another
      // process's `git add` and its `git commit`, clobbering the loser's
      // staged entry — its commit then reports "nothing to commit"
      // (reported in the JSON payload, quiet on stderr, well inside the 10s
      // retry budget) while its mutation sits written but uncommitted.
      const commit = r.body!.commit as Json | undefined;
      if (commit !== undefined && commit.skipped !== undefined) cleanSkips.push(ids[i]!);
    });

    // A cleanly reported skip is retried sequentially, like a real caller
    // would (comment-race.test.ts pattern): the retry re-appends the comment
    // and its commit picks up the uncommitted mutation too. This keeps the
    // contract below intact under scheduler starvation and the index-clobber
    // race without weakening the clean-tree assertion.
    // bug-torture-contention-flake3: the RETRY's own commit used to be
    // unchecked — under CI load it could re-enter contention and skip again
    // (ok:true, commit.skipped), leaving its mutation dirty with no
    // explanation and tripping the clean-tree assert below. With the
    // repo-level git-mutation lock a retry cannot re-enter contention, so a
    // skipped retry commit is itself a failure now, not a tolerated state.
    for (const id of cleanSkips) {
      const retry = runCli(["comment", id, `note on ${id}`, "--author", "agent", "--json"], dir);
      expect(retry.body, retry.stderr).toMatchObject({ ok: true });
      const retryCommit = retry.body!.commit as Json | undefined;
      expect(
        retryCommit,
        `retry commit for ${id} skipped: ${JSON.stringify(retryCommit)}`,
      ).toMatchObject({ hash: expect.any(String) });
    }

    // Every comment actually landed in its item file.
    for (const id of ids) {
      const body = readFileSync(
        join(dir, "ArggonManager/launch/auth/story-login", `${id}.md`),
        "utf8",
      );
      expect(body).toContain(`note on ${id}`);
    }

    // No git index.lock left behind and the tree is fully clean: with the
    // commitTrackerMutation retry (bug-autocommit-silent-skip fix) plus the
    // sequential retries above, every index.lock race and every reported
    // skip resolves as a landed commit — an UNREPORTED skip would still
    // leave the mutated item file dirty here, and that stays a failure.
    expect(existsSync(join(dir, ".git/index.lock"))).toBe(false);
    expect(git(["status", "--porcelain"], dir)).toBe("");

    expect(runCli(["validate", "--json"], dir).body).toMatchObject({ ok: true });

    removeFixtureTree(dir);
  }, 90_000); // 6 concurrent tsx processes + real git commits

  // Exposed by this lab while building scenario 2: two concurrent comments on
  // the SAME item used to lose one silently (runComment did an unlocked
  // read-modify-write). Fixed in bug-comment-race-no-lock: runComment now
  // serializes its read-modify-write with withItemLock, so both comments land.
  it("two concurrent comments on the same item both land (bug-comment-race-no-lock)", async () => {
    const dir = freshGitTree("comment-race", "x-tracker:\n  auto-commit: true\n");
    try {
      runCreate({
        cwd: dir,
        type: "task",
        title: "Race target",
        parent: "story-login",
        id: "task-a",
      });
      gitCommitIfDirty(dir, "seed race target");

      // Two processes comment on the SAME item simultaneously.
      const results = await spawnAll(dir, [
        { args: ["comment", "task-a", "first concurrent comment", "--author", "agent", "--json"] },
        { args: ["comment", "task-a", "second concurrent comment", "--author", "agent", "--json"] },
      ]);

      // Both processes succeed (or report a clean contention failure — the
      // item lock timeout, or git's index.lock, the known separate
      // bug-autocommit-silent-skip family). With the fix both should be ok.
      for (const r of results) {
        expect(r.body).not.toBeNull();
        if (r.body!.ok !== true) {
          const message = (r.body!.error as Json).message as string;
          expect(/failed to acquire lock|index/i.test(message)).toBe(true);
        }
      }

      // The invariant this bug was filed for: NEITHER comment is lost.
      const body = readFileSync(
        join(dir, "ArggonManager/launch/auth/story-login/task-a.md"),
        "utf8",
      );
      expect(body).toContain("first concurrent comment");
      expect(body).toContain("second concurrent comment");

      expect(runCli(["validate", "--json"], dir).body).toMatchObject({ ok: true });
    } finally {
      removeFixtureTree(dir);
    }
  }, 90_000);
});

// ---------------------------------------------------------------------------
// Scenario 3 — guardian/cuentas/suizo/racha: legacy tree adoption, full flow
// ---------------------------------------------------------------------------

describe("lab: synthetic legacy tree, full adoption flow (guardian/cuentas/suizo/racha)", () => {
  it("init --full over an old-school tree, adopt, sweep edit, ack, re-run init, cleanup", () => {
    // The "old school" tree: hand-made docs predating arggon.
    const dir = mkdtempSync(join(tmpdir(), "arggon-lab-legacy-"));
    git(["-c", "init.defaultBranch=main", "init", "--quiet"], dir);
    git(["config", "user.email", "test@example.com"], dir);
    git(["config", "user.name", "Test"], dir);
    writeFileSync(join(dir, "README.md"), "# Legacy Project\n\nOld notes.\n", "utf8");
    writeFileSync(join(dir, "DECISIONS.md"), "# Decisions\n\n- 2024: we chose SQL\n", "utf8");
    mkdirSync(join(dir, "docs"), { recursive: true });
    writeFileSync(join(dir, "docs/notes.md"), "scratch\n", "utf8");

    // init --full scaffolds around the adopter's files (never overwrites).
    const initArgs = ["init", dir, "--full", "--json"];
    const firstInit = runCli(initArgs, root);
    expect(firstInit.body).toMatchObject({ ok: true });
    // The old-school tree survives untouched (README is adopter-owned, not a
    // tracked template: init neither lists nor overwrites it).
    expect(readFileSync(join(dir, "README.md"), "utf8")).toContain("# Legacy Project");
    expect(readFileSync(join(dir, "DECISIONS.md"), "utf8")).toContain("we chose SQL");

    // adopt: auto-creates the container chain + the sweep checklist task.
    const adopt = runCli(["adopt", "--json"], dir);
    expect(adopt.body).toMatchObject({
      ok: true,
      taskId: "task-adopt-arggon",
      storyId: "story-arggon-adoption",
      storyCreated: true,
      taskCreated: true,
    });
    const taskFile = readFileSync(
      join(
        dir,
        "ArggonManager/arggon-adoption/epic-arggon-adoption/story-arggon-adoption/task-adopt-arggon.md",
      ),
      "utf8",
    );
    expect(taskFile.match(/^- \[ \] /gm)).toHaveLength(14);

    // Sanctioned sweep edit (step 3 of the checklist): fill in a placeholder.
    const agentsPath = join(dir, "AGENTS.md");
    const swept = readFileSync(agentsPath, "utf8").replace(
      "arggon list --status todo --json",
      "SWEEP: our entrypoint is npm run dev; arggon list --status todo --json",
    );
    expect(swept).not.toBe(readFileSync(agentsPath, "utf8"));
    writeFileSync(agentsPath, swept, "utf8");

    // adopt --ack re-baselines every generated doc to its current bytes.
    const ack = runCli(["adopt", "--ack", "--json"], dir);
    expect(ack.body).toMatchObject({ ok: true, command: "adopt", count: GENERATED_DOC_COUNT });
    const agentsAcked = (ack.body!.acked as Array<Json>).find((doc) => doc.path === "AGENTS.md");
    expect(agentsAcked).toBeDefined();

    // Re-running init keeps the acked doc byte-identical (#127 invariant).
    const secondInit = runCli(initArgs, root);
    expect(secondInit.body).toMatchObject({ ok: true });
    expect(secondInit.body!.skipped as string[]).toContain("AGENTS.md");
    expect(readFileSync(agentsPath, "utf8")).toBe(swept);

    // The tree is coherent and cleanup runs clean (no worktrees to prune).
    expect(runCli(["validate", "--json"], dir).body).toMatchObject({ ok: true });
    const cleanup = runCli(["cleanup", "--json"], dir);
    expect(cleanup.body).toMatchObject({ ok: true });

    removeFixtureTree(dir);
  }, 60_000); // ~7 CLI spawns, each paying the tsx compile cost
});

// ---------------------------------------------------------------------------
// Scenario 4 — guardian ack loss / bug-ack-baseline-regen-loss (fix PR #127):
// upgrade flow over acked state, end-to-end
// ---------------------------------------------------------------------------

describe("lab: upgrade flow over acked state (guardian / bug-ack-baseline-regen-loss)", () => {
  it("hand edit after ack: modified+skip, preserved across re-runs; --backup still never regenerates an acked doc", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-lab-upgrade-"));
    const initArgs = ["init", dir, "--full", "--json"];
    expect(runCli(initArgs, root).body).toMatchObject({ ok: true });

    // Baseline everything, then hand-edit one doc.
    expect(runCli(["adopt", "--ack", "--json"], dir).body).toMatchObject({ ok: true });
    const agentsPath = join(dir, "AGENTS.md");
    writeFileSync(agentsPath, "MY ACKED BASELINE v1\n", "utf8");

    // Re-run without backup: skipped, content preserved. An ACKED doc is
    // sanctioned-diverged — it is never reported as modified[] (that bucket
    // is for unacked adopter edits) and never regenerated.
    const rerun = runCli(initArgs, root);
    expect(rerun.body).toMatchObject({ ok: true });
    expect(rerun.body!.skipped as string[]).toContain("AGENTS.md");
    expect(rerun.body!.updated as string[]).not.toContain("AGENTS.md");
    expect(rerun.body!.modified as string[]).not.toContain("AGENTS.md");
    expect(readFileSync(agentsPath, "utf8")).toBe("MY ACKED BASELINE v1\n");

    // Re-run WITH --backup: the acknowledged doc still wins over any hash —
    // acked content is never regenerated (the exact regression guardian hit).
    const rerunBackup = runCli(["init", dir, "--full", "--backup", "--json"], root);
    expect(rerunBackup.body).toMatchObject({ ok: true });
    expect(rerunBackup.body!.backedUp as string[]).not.toContain("AGENTS.md");
    expect(rerunBackup.body!.updated as string[]).not.toContain("AGENTS.md");
    expect(readFileSync(agentsPath, "utf8")).toBe("MY ACKED BASELINE v1\n");

    // Control: the --backup archive+regenerate path still works for an
    // UNACKED modified doc (fresh tree, no ack).
    const plain = mkdtempSync(join(tmpdir(), "arggon-lab-upgrade-plain-"));
    expect(runCli(["init", plain, "--full", "--json"], root).body).toMatchObject({ ok: true });
    const contributing = join(plain, "CONTRIBUTING.md");
    writeFileSync(contributing, "MY CONTRIBUTOR NOTES\n", "utf8");
    const backupRun = runCli(["init", plain, "--full", "--backup", "--json"], root);
    expect(backupRun.body).toMatchObject({ ok: true });
    // The backed doc is reported via backedUp[] (not updated[]) and both
    // archived and regenerated.
    expect(backupRun.body!.backedUp as string[]).toContain("CONTRIBUTING.md");
    expect(backupRun.body!.updated as string[]).not.toContain("CONTRIBUTING.md");
    // The archive keeps the adopter's bytes; the destination is regenerated.
    const backupRoot = join(plain, "backup");
    const day = readdirSync(backupRoot)[0]!;
    expect(readFileSync(join(backupRoot, day, "CONTRIBUTING.md"), "utf8")).toBe(
      "MY CONTRIBUTOR NOTES\n",
    );
    expect(readFileSync(contributing, "utf8")).not.toBe("MY CONTRIBUTOR NOTES\n");

    removeFixtureTree(dir);
    removeFixtureTree(plain);
  }, 60_000);
});

// ---------------------------------------------------------------------------
// Scenario 5 — guardian/suizo steal+reopen probes, every entry point
// ---------------------------------------------------------------------------

type McpServer = {
  child: ReturnType<typeof spawn>;
  request: (id: number, method: string, params?: Record<string, unknown>) => Promise<Json>;
};

function startServer(cwd: string): McpServer {
  const child = spawn(process.execPath, [tsx, cli, "mcp"], {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const waiters: Array<(message: Json) => void> = [];
  let buffer = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    let index: number;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      const waiter = waiters.shift();
      if (waiter) waiter(JSON.parse(line) as Json);
    }
  });
  child.stderr.on("data", (chunk: Buffer) => process.stderr.write(chunk));
  const request = (id: number, method: string, params?: Record<string, unknown>) => {
    const pending = new Promise<Json>((resolveRequest) => waiters.push(resolveRequest));
    child.stdin!.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return pending;
  };
  return { child, request };
}

type ToolOutcome = { isError: boolean; text: string };

async function callTool(
  server: McpServer,
  id: number,
  name: string,
  args: Json,
): Promise<ToolOutcome> {
  const response = await server.request(id, "tools/call", { name, arguments: args });
  const result = response.result as { content: Array<{ text: string }>; isError?: boolean };
  return { isError: result.isError === true, text: result.content[0]!.text };
}

describe("lab: gate probes from every entry point (guardian/suizo)", () => {
  function primed(): { dir: string; doneId: string } {
    const dir = freshTree("gates");
    runCreate({
      cwd: dir,
      type: "task",
      title: "Claimed",
      parent: "story-login",
      id: "task-claimed",
    });
    runCreate({
      cwd: dir,
      type: "task",
      title: "Finished",
      parent: "story-login",
      id: "task-finished",
    });
    // v0 transitions: todo -> done goes through in_progress.
    runUpdate({ cwd: dir, id: "task-claimed", status: "in_progress", assignee: "alice" });
    runUpdate({ cwd: dir, id: "task-finished", status: "in_progress", assignee: "worker" });
    runUpdate({ cwd: dir, id: "task-finished", status: "done" });
    return { dir, doneId: "task-finished" };
  }

  async function mcpUpdate(dir: string, id: string, args: Json): Promise<ToolOutcome> {
    const server = startServer(dir);
    try {
      await server.request(1, "initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "lab-gate-probe", version: "1.0" },
      });
      server.child.stdin!.write(
        `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
      );
      return await callTool(server, 2, "arggon_update", { id, ...args });
    } finally {
      server.child.kill("SIGTERM");
    }
  }

  it("steal: refused via CLI non-TTY and MCP; kernel refuses reassignment without --force", async () => {
    const { dir } = primed();
    const claimedId = "task-claimed";

    // (a) CLI non-TTY, plain reassignment: kernel claim-steal guard refuses.
    const plain = runCli(["update", claimedId, "--assignee", "bob", "--json"], dir);
    expect(plain.body!.ok).toBe(false);
    expect((plain.body!.error as Json).message as string).toContain("claim conflict");

    // (a) CLI non-TTY with --steal: the CLI gate refuses before the kernel —
    // the repo never armed steal, and even armed it needs a TTY.
    const gated = runCli(
      ["update", claimedId, "--steal", "--assignee", "bob", "--reason", "takeover", "--json"],
      dir,
    );
    expect(gated.body!.ok).toBe(false);
    const gateMessage = (gated.body!.error as Json).message as string;
    expect(/allow-steal|TTY|non-interactive/i.test(gateMessage)).toBe(true);

    // (b) MCP arggon_update: agent rules refuse the same reassignment.
    const mcp = await mcpUpdate(dir, claimedId, { status: "in_progress", assignee: "bob" });
    expect(mcp.isError).toBe(true);
    expect(mcp.text).toContain("claim conflict");

    // (c) Kernel direct: reassignment without --force throws the same conflict.
    expect(() =>
      runUpdate({ cwd: dir, id: claimedId, status: "in_progress", assignee: "bob" }),
    ).toThrow(/claim conflict/);
    // alice's claim survived every probe.
    expect(frontmatter(dir, "launch", "auth", "story-login", "task-claimed.md").assignee).toBe(
      "alice",
    );

    removeFixtureTree(dir);
  }, 60_000);

  it("reopen: refused via CLI non-TTY and MCP; kernel keeps the human-legal transition", async () => {
    const { dir, doneId } = primed();

    // (a) CLI non-TTY: the reopen gate refuses (no TTY, no --yes override).
    const cliProbe = runCli(["update", doneId, "--status", "todo", "--json"], dir);
    expect(cliProbe.body!.ok).toBe(false);
    const cliMessage = (cliProbe.body!.error as Json).message as string;
    expect(/TTY|non-interactive|reopen/i.test(cliMessage)).toBe(true);
    expect(frontmatter(dir, "launch", "auth", "story-login", "task-finished.md").status).toBe(
      "done",
    );

    // (b) MCP arggon_update: agent rules refuse with the documented message.
    const mcp = await mcpUpdate(dir, doneId, { status: "todo" });
    expect(mcp.isError).toBe(true);
    expect(mcp.text).toContain("must not reopen");

    // (c) Kernel direct (human caller): the transition itself is legal — the
    // gate is the entry point, not the kernel. Consistent with steal, where
    // the kernel layer and the entry points refuse for different reasons.
    const kernel = runUpdate({ cwd: dir, id: doneId, status: "todo" });
    expect(kernel.item.status).toBe("todo");

    removeFixtureTree(dir);
  }, 60_000);
});

// ---------------------------------------------------------------------------
// Scenario 6 — estanteria 53-call session: long mixed MCP session
// ---------------------------------------------------------------------------

describe("lab: long MCP session (estanteria 53-call session)", () => {
  it("one server, ~30 mixed create/update/comment calls: zero errors, clean shutdown", async () => {
    const dir = freshTree("mcp-session");
    const server = startServer(dir);
    let nextId = 1;
    const outcomes: ToolOutcome[] = [];
    try {
      const initialized = await server.request(nextId++, "initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "lab-session-client", version: "1.0" },
      });
      expect(initialized.result).toMatchObject({ serverInfo: { name: "arggon" } });
      server.child.stdin!.write(
        `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
      );

      // 10 creates under the seeded story.
      for (let i = 0; i < 10; i++) {
        outcomes.push(
          await callTool(server, nextId++, "arggon_create", {
            type: "task",
            title: `Session task ${i}`,
            parent: "story-login",
            id: `task-session-${i}`,
          }),
        );
      }
      // 10 updates claiming each created task.
      for (let i = 0; i < 10; i++) {
        outcomes.push(
          await callTool(server, nextId++, "arggon_update", {
            id: `task-session-${i}`,
            status: "in_progress",
            assignee: `agent-${i}`,
          }),
        );
      }
      // 10 comments spreading handoff context across the tasks.
      for (let i = 0; i < 10; i++) {
        outcomes.push(
          await callTool(server, nextId++, "arggon_comment", {
            id: `task-session-${i}`,
            text: `handoff note ${i}`,
            author: `agent-${i}`,
          }),
        );
      }
      // One list to close the session.
      outcomes.push(await callTool(server, nextId++, "arggon_list", {}));

      expect(outcomes).toHaveLength(31);
      for (const [index, outcome] of outcomes.entries()) {
        expect(outcome.isError, `call #${index}: ${outcome.text}`).toBe(false);
      }
      const listing = JSON.parse(outcomes[outcomes.length - 1]!.text) as {
        items: Array<{ id: string }>;
      };
      for (let i = 0; i < 10; i++) {
        expect(listing.items.map((item) => item.id)).toContain(`task-session-${i}`);
      }

      // Every mutation really landed on disk (the session mutated, not just replied).
      const task = frontmatter(dir, "launch", "auth", "story-login", "task-session-7.md");
      expect(task.assignee).toBe("agent-7");
      expect(
        readFileSync(join(dir, "ArggonManager/launch/auth/story-login/task-session-7.md"), "utf8"),
      ).toContain("handoff note 7");
    } finally {
      server.child.kill("SIGTERM");
    }

    // The tree survived the session.
    expect(runCli(["validate", "--json"], dir).body).toMatchObject({ ok: true });
    removeFixtureTree(dir);
  }, 90_000); // ~31 sequential MCP round trips over a tsx-hosted server
});
