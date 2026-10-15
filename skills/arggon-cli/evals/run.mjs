#!/usr/bin/env node
// Eval harness for the arggon-cli skill. Derives every command from SKILL.md
// only, runs them against a temp fixture repo, and scores pass/fail.
// Usage: node skills/arggon-cli/evals/run.mjs
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
  if (ok) pass++;
  else fail++;
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
    return {
      status: err.status ?? 1,
      stdout: String(err.stdout ?? ""),
      stderr: String(err.stderr ?? ""),
    };
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
// `validate` refuses an open item whose LIVE Context/Acceptance sections still
// carry the scaffold placeholder (PLACEHOLDER_BODY, landed after this harness was
// last green), so a fixture of bare `create`s cannot pass E9. Fill every seeded
// and case-created item's placeholders with real prose just before E9 — the
// harness scores the CLI, not the wording.
function fillPlaceholders(root) {
  const walk = (absDir) => {
    for (const entry of readdirSync(absDir, { withFileTypes: true })) {
      const abs = join(absDir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!entry.name.endsWith(".md")) continue;
      const filled = readFileSync(abs, "utf8")
        .replace(/<!-- Why this [a-z ]+ exists\. -->/, "Eval fixture item.")
        .replace(
          /<!-- The real acceptance criteria; tick each box when met\. -->/,
          "- [x] the item carries real prose",
        );
      if (filled !== readFileSync(abs, "utf8")) writeFileSync(abs, filled, "utf8");
    }
  };
  walk(root);
}
// The tracker root this fixture's `init` produced — read from disk, never
// assumed: `ArggonManager/` on the v5 layout, `tasks/` on a legacy one. A
// hardcoded `tasks/` made every path below it an ENOENT once init moved the
// tree (ADR 0012), which killed the run before the last case could be scored.
const trackerRoot = existsSync(join(dir, "ArggonManager")) ? "ArggonManager" : "tasks";

// E1: find open work
let r = run(["list", "--status", "todo", "--json"], { cwd: dir });
let body = jsonOf(r);
check(
  "E1",
  "find-todo",
  r.status === 0 &&
    body.ok === true &&
    Array.isArray(body.items) &&
    body.items.length > 0 &&
    body.items.every((i) => i.status === "todo"),
  r.stdout.slice(0, 200),
);

// E2: zero-match filter is success
r = run(["list", "--status", "done", "--json"], { cwd: dir });
body = jsonOf(r);
check(
  "E2",
  "empty-filter",
  r.status === 0 && body.ok === true && Array.isArray(body.items) && body.items.length === 0,
  r.stdout.slice(0, 200),
);

// E3: claim
r = run(["update", "task-probe", "--status", "in_progress", "--assignee", "qa-bot", "--json"], {
  cwd: dir,
});
body = jsonOf(r);
check(
  "E3",
  "claim",
  r.status === 0 && body.item.status === "in_progress" && body.item.assignee === "qa-bot",
  r.stdout.slice(0, 200),
);

// E4: claim conflict without --force
r = run(["update", "task-probe", "--status", "in_progress", "--assignee", "intruder", "--json"], {
  cwd: dir,
});
let e4 = r.status !== 0;
try {
  e4 = e4 && jsonOf(r).error.code === "UPDATE_FAILED";
} catch {
  e4 = false;
}
const still = jsonOf(run(["list", "--type", "task", "--json"], { cwd: dir })).items.find(
  (i) => i.id === "task-probe",
);
check("E4", "claim-conflict", e4 && still.assignee === "qa-bot", r.stdout.slice(0, 200));

// E5: create task under story
r = run(["create", "task", "Second", "--parent", "story-login", "--json"], { cwd: dir });
body = jsonOf(r);
check(
  "E5",
  "create-task",
  r.status === 0 && body.item.id.startsWith("task-") && body.item.path.includes("story-login/"),
  r.stdout.slice(0, 200),
);

// E6: missing parent
r = run(["create", "task", "Orphan", "--parent", "nope", "--json"], { cwd: dir });
let e6 = r.status !== 0;
try {
  e6 = e6 && jsonOf(r).error.code === "CREATE_FAILED";
} catch {
  e6 = false;
}
check("E6", "bad-parent", e6, r.stdout.slice(0, 200));

// E7: blocked without reason
r = run(["update", "task-second", "--status", "blocked", "--json"], { cwd: dir });
check("E7", "blocked-no-reason", r.status !== 0, r.stdout.slice(0, 200));

// E8: labels full replace
run(["update", "task-second", "--labels", "sec,net", "--json"], { cwd: dir });
r = run(["update", "task-second", "--labels", "net", "--json"], { cwd: dir });
body = jsonOf(r);
check(
  "E8",
  "labels-replace",
  r.status === 0 && JSON.stringify(body.item.labels) === JSON.stringify(["net"]),
  r.stdout.slice(0, 200),
);

// E9: validate clean
fillPlaceholders(join(dir, trackerRoot));
r = run(["validate", "--json"], { cwd: dir });
body = jsonOf(r);
check("E9", "validate-clean", r.status === 0 && body.ok === true, r.stdout.slice(0, 200));

// E10: board from subdir lands at root
const sub = join(dir, "docs", "deep");
mkdirSync(sub, { recursive: true });
r = run(["board", "--json"], { cwd: sub });
body = jsonOf(r);
check(
  "E10",
  "board-root-path",
  r.status === 0 && existsSync(join(dir, "board.html")) && !existsSync(join(sub, "board.html")),
  r.stdout.slice(0, 200),
);

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
  } catch {
    e11 = false;
  }
}
check("E11", "envelope-shape", e11);

// E12: @me resolution via GITHUB_USER
r = run(["list", "--assignee", "@me", "--json"], { cwd: dir, env: { GITHUB_USER: "qa-bot" } });
body = jsonOf(r);
check(
  "E12",
  "assignee-me",
  r.status === 0 && body.items.length > 0 && body.items.every((i) => i.assignee === "qa-bot"),
  r.stdout.slice(0, 200),
);

// --- Round 2: adversarial (naive skill readings must still land correctly) ---

// E13: non-kebab labels rejected
r = run(["update", "task-second", "--labels", "Bad Label", "--json"], { cwd: dir });
check("E13", "labels-validated", r.status !== 0, r.stdout.slice(0, 200));

// E14: --id still gets the leaf prefix
r = run(["create", "task", "Whatever", "--parent", "story-login", "--id", "probe2", "--json"], {
  cwd: dir,
});
body = jsonOf(r);
check("E14", "id-prefix", r.status === 0 && body.item.id === "task-probe2", r.stdout.slice(0, 200));

// E15: human-readable list for quick scans
r = run(["list", "--status", "todo"], { cwd: dir });
check(
  "E15",
  "human-list",
  r.status === 0 &&
    r.stdout.includes("task-second") &&
    (() => {
      try {
        JSON.parse(r.stdout.trim());
        return false;
      } catch {
        return true;
      }
    })(),
  r.stdout.slice(0, 200),
);

// E17: todo-transition unclaims (runs before E16 breaks the tree)
r = run(["update", "task-probe", "--status", "todo", "--json"], { cwd: dir });
body = jsonOf(r);
check(
  "E17",
  "unclaim",
  r.status === 0 && body.item.status === "todo" && body.item.assignee === null,
  r.stdout.slice(0, 200),
);

// E16: broken tree -> validate fails loudly
writeFileSync(
  join(dir, trackerRoot, "eval-mvp", "auth", "story-login", "task-broken.md"),
  "---\ntype: task\nstatus: bogus\nid: task-broken\nparent: story-login\n---\n# Broken\n",
);
r = run(["validate", "--json"], { cwd: dir });
let e16 = r.status !== 0;
try {
  e16 = e16 && jsonOf(r).ok === false && jsonOf(r).error.code === "VALIDATE_FAILED";
} catch {
  e16 = false;
}
check("E16", "validate-broken", e16, r.stdout.slice(0, 200));

// E18: outside any repo fails with a usable error
const outside = mkdtempSync(join(tmpdir(), "arggon-eval-outside-"));
r = run(["list", "--json"], { cwd: outside });
let e18 = r.status !== 0;
try {
  e18 = e18 && jsonOf(r).error.code === "LIST_FAILED";
} catch {
  e18 = false;
}
rmSync(outside, { recursive: true, force: true });
check("E18", "outside-repo", e18, r.stdout.slice(0, 200));

// ---------------------------------------------------------------------------
// E19 — friction --report derived from the AGENT FILE ALONE.
//
// deftai/directive#3633 shipped a skill documented as the sanctioned escalation
// route and an agent that was actively escalating still missed it, because the
// skill was absent from the host's discovery inventory: the friction was
// "absorbed into the session", which is silent loss and looks like success. ADR
// 0024 §2 answers that by putting the trigger in the generated AGENT FILES, not
// only in a skill reference — so this case reproduces the failure mode: the whole
// bundled skill tree is deleted from the fixture, and the only thing the deriving
// agent may read is `.opencode/agents/arggon-maker.md`. If the trigger text stops
// carrying the workflow, this case fails instead of a real session going silent.
// ---------------------------------------------------------------------------
rmSync(join(dir, ".agents", "skills"), { recursive: true, force: true });
const skillGone = !existsSync(
  join(dir, ".agents", "skills", "arggon-cli", "references", "friction.md"),
);
const agentText = readFileSync(join(dir, ".opencode", "agents", "arggon-maker.md"), "utf8");
const block =
  /<!-- arggon:friction-trigger begin[\s\S]*?<!-- arggon:friction-trigger end -->/.exec(
    agentText,
  )?.[0] ?? "";
check(
  "E19",
  "trigger-in-agent-file",
  skillGone &&
    /arggon:friction-trigger begin/.test(block) &&
    block.includes('arggon friction "<one line>" --command "<argv shape>"') &&
    block.includes("arggon friction --report"),
  `skillGone=${skillGone} block=${block.length}`,
);
// Both modes, from the block above and nothing else.
const state = join(dir, "state");
const captureEnv = { ...process.env, ARGGON_STATE_DIR: state };
r = run(["friction", "eval probe", "--command", "friction --report", "--json"], {
  cwd: dir,
  env: captureEnv,
});
let e19b = r.status === 0;
try {
  e19b = e19b && typeof jsonOf(r).record?.fingerprint === "string";
} catch {
  e19b = false;
}
check("E19", "capture", e19b, r.stdout.slice(0, 200));
r = run(["friction", "--report", "--json"], { cwd: dir, env: captureEnv });
let e19c = r.status === 0;
try {
  body = jsonOf(r);
  e19c =
    e19c &&
    body.report === true &&
    body.count === 1 &&
    body.classes === 1 &&
    body.optedOut === false &&
    body.dedupeScope === "local-only" &&
    body.rows?.[0]?.count === 1;
} catch {
  e19c = false;
}
check("E19", "report", e19c, r.stdout.slice(0, 200));

console.log(results.join("\n"));
console.log(`\n${pass} passed, ${fail} failed`);
rmSync(dir, { recursive: true, force: true });
rmSync(join(repoRoot, "board.html"), { force: true });
process.exit(fail === 0 ? 0 : 1);
