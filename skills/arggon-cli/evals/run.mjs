#!/usr/bin/env node
// Eval harness for the arggon-cli skill. Derives every command from SKILL.md
// only, runs them against a temp fixture repo, and scores pass/fail.
// Usage: node skills/arggon-cli/evals/run.mjs
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const cli = join(repoRoot, "dist", "cli.js");

let pass = 0;
let fail = 0;
const results = [];
function check(id, name, cond, extra = "") {
  const ok = Boolean(cond);
  if (ok) pass++; else fail++;
  results.push(`${ok ? "PASS" : "FAIL"} ${id} ${name}${ok ? "" : " — " + extra}`);
}

function run(args, opts = {}) {
  try {
    const stdout = execFileSync(process.execPath, [cli, ...args], {
      encoding: "utf8",
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
    });
    return { status: 0, stdout };
  } catch (err) {
    return { status: err.status ?? 1, stdout: String(err.stdout ?? ""), stderr: String(err.stderr ?? "") };
  }
}
function jsonOf(res) {
  return JSON.parse(res.stdout.trim());
}

// --- fixture: init + initiative -> epic -> story -> task (skill Quick Reference)
const dir = mkdtempSync(join(tmpdir(), "arggon-eval-"));
check("E0", "init", run(["init", dir]).status === 0);
const seed = [
  ["create", "initiative", "Eval MVP"],
  ["create", "epic", "Auth", "--parent", "eval-mvp"],
  ["create", "story", "Login", "--parent", "auth", "--id", "story-login"],
  ["create", "task", "Probe", "--parent", "story-login"],
];
for (const a of seed) {
  const r = run(a, { cwd: dir });
  if (r.status !== 0) check("E0", `seed ${a[1]} ${a[2]}`, false, r.stderr || r.stdout);
}

// E1: find open work
let r = run(["list", "--status", "todo", "--json"], { cwd: dir });
let body = jsonOf(r);
check("E1", "find-todo", r.status === 0 && body.ok === true && Array.isArray(body.items) && body.items.length > 0 && body.items.every((i) => i.status === "todo"), r.stdout.slice(0, 200));

// E2: zero-match filter is success
r = run(["list", "--status", "done", "--json"], { cwd: dir });
body = jsonOf(r);
check("E2", "empty-filter", r.status === 0 && body.ok === true && Array.isArray(body.items) && body.items.length === 0, r.stdout.slice(0, 200));

// E3: claim
r = run(["update", "task-probe", "--status", "in_progress", "--assignee", "qa-bot", "--json"], { cwd: dir });
body = jsonOf(r);
check("E3", "claim", r.status === 0 && body.item.status === "in_progress" && body.item.assignee === "qa-bot", r.stdout.slice(0, 200));

// E4: claim conflict without --force
r = run(["update", "task-probe", "--status", "in_progress", "--assignee", "intruder", "--json"], { cwd: dir });
let e4 = r.status !== 0;
try {
  e4 = e4 && jsonOf(r).error.code === "UPDATE_FAILED";
} catch { e4 = false; }
const still = jsonOf(run(["list", "--type", "task", "--json"], { cwd: dir })).items.find((i) => i.id === "task-probe");
check("E4", "claim-conflict", e4 && still.assignee === "qa-bot", r.stdout.slice(0, 200));

// E5: create task under story
r = run(["create", "task", "Second", "--parent", "story-login", "--json"], { cwd: dir });
body = jsonOf(r);
check("E5", "create-task", r.status === 0 && body.item.id.startsWith("task-") && body.item.path.includes("story-login/"), r.stdout.slice(0, 200));

// E6: missing parent
r = run(["create", "task", "Orphan", "--parent", "nope", "--json"], { cwd: dir });
let e6 = r.status !== 0;
try { e6 = e6 && jsonOf(r).error.code === "CREATE_FAILED"; } catch { e6 = false; }
check("E6", "bad-parent", e6, r.stdout.slice(0, 200));

// E7: blocked without reason
r = run(["update", "task-second", "--status", "blocked", "--json"], { cwd: dir });
check("E7", "blocked-no-reason", r.status !== 0, r.stdout.slice(0, 200));

// E8: labels full replace
run(["update", "task-second", "--labels", "sec,net", "--json"], { cwd: dir });
r = run(["update", "task-second", "--labels", "net", "--json"], { cwd: dir });
body = jsonOf(r);
check("E8", "labels-replace", r.status === 0 && JSON.stringify(body.item.labels) === JSON.stringify(["net"]), r.stdout.slice(0, 200));

// E9: validate clean
r = run(["validate", "--json"], { cwd: dir });
body = jsonOf(r);
check("E9", "validate-clean", r.status === 0 && body.ok === true, r.stdout.slice(0, 200));

// E10: board from subdir lands at root
const sub = join(dir, "docs", "deep");
mkdirSync(sub, { recursive: true });
r = run(["board", "--json"], { cwd: sub });
body = jsonOf(r);
check("E10", "board-root-path", r.status === 0 && existsSync(join(dir, "board.html")) && !existsSync(join(sub, "board.html")), r.stdout.slice(0, 200));

// E11: envelope shape across commands
const samples = [
  ["list", ["list", "--json"]],
  ["create", ["create", "task", "Env", "--parent", "story-login", "--json"]],
  ["update", ["update", "task-env", "--title", "Env2", "--json"]],
  ["validate", ["validate", "--json"]],
  ["board", ["board", "--json"]],
];
let e11 = true;
for (const [cmd, a] of samples) {
  const rr = run(a, { cwd: dir });
  try {
    const b = jsonOf(rr);
    if (b.schemaVersion !== 1 || b.command !== cmd) e11 = false;
  } catch { e11 = false; }
}
check("E11", "envelope-shape", e11);

// E12: @me resolution via GITHUB_USER
r = run(["list", "--assignee", "@me", "--json"], { cwd: dir, env: { GITHUB_USER: "qa-bot" } });
body = jsonOf(r);
check("E12", "assignee-me", r.status === 0 && body.items.length > 0 && body.items.every((i) => i.assignee === "qa-bot"), r.stdout.slice(0, 200));

// --- Round 2: adversarial (naive skill readings must still land correctly) ---

// E13: non-kebab labels rejected
r = run(["update", "task-second", "--labels", "Bad Label", "--json"], { cwd: dir });
check("E13", "labels-validated", r.status !== 0, r.stdout.slice(0, 200));

// E14: --id still gets the leaf prefix
r = run(["create", "task", "Whatever", "--parent", "story-login", "--id", "probe2", "--json"], { cwd: dir });
body = jsonOf(r);
check("E14", "id-prefix", r.status === 0 && body.item.id === "task-probe2", r.stdout.slice(0, 200));

// E15: human-readable list for quick scans
r = run(["list", "--status", "todo"], { cwd: dir });
check("E15", "human-list", r.status === 0 && r.stdout.includes("task-second") && (() => { try { JSON.parse(r.stdout.trim()); return false; } catch { return true; } })(), r.stdout.slice(0, 200));

// E17: todo-transition unclaims (runs before E16 breaks the tree)
r = run(["update", "task-probe", "--status", "todo", "--json"], { cwd: dir });
body = jsonOf(r);
check("E17", "unclaim", r.status === 0 && body.item.status === "todo" && body.item.assignee === null, r.stdout.slice(0, 200));

// E16: broken tree -> validate fails loudly
writeFileSync(join(dir, "tasks", "eval-mvp", "auth", "story-login", "task-broken.md"),
  '---\ntype: task\nstatus: bogus\nid: task-broken\nparent: story-login\n---\n# Broken\n');
r = run(["validate", "--json"], { cwd: dir });
let e16 = r.status !== 0;
try { e16 = e16 && jsonOf(r).ok === false && jsonOf(r).error.code === "VALIDATE_FAILED"; } catch { e16 = false; }
check("E16", "validate-broken", e16, r.stdout.slice(0, 200));

// E18: outside any repo fails with a usable error
const outside = mkdtempSync(join(tmpdir(), "arggon-eval-outside-"));
r = run(["list", "--json"], { cwd: outside });
let e18 = r.status !== 0;
try { e18 = e18 && jsonOf(r).error.code === "LIST_FAILED"; } catch { e18 = false; }
rmSync(outside, { recursive: true, force: true });
check("E18", "outside-repo", e18, r.stdout.slice(0, 200));

console.log(results.join("\n"));
console.log(`\n${pass} passed, ${fail} failed`);
rmSync(dir, { recursive: true, force: true });
rmSync(join(repoRoot, "board.html"), { force: true });
process.exit(fail === 0 ? 0 : 1);
