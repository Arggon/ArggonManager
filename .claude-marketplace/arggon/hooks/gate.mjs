// arggon:generated template="claude/arggon/hooks/gate.mjs"
/**
 * ArggonManager gate hooks for the Claude Code plugin seam (ADR 0014,
 * task-claude-plugin-seam). Zero dependencies (node: stdlib only), one file,
 * four modes passed as argv[2]:
 *
 *   pre            — PreToolUse: global git gates (never `git push --force`,
 *                    never `git commit --no-verify`) for every session, plus
 *                    the dispatch-scoped reviewer backstop (below).
 *   subagent-start — SubagentStart: opens the backstop window for the
 *                    dispatch whose agent_type is the plugin's standards
 *                    reviewer.
 *   subagent-stop  — SubagentStop: closes that dispatch's contribution to the
 *                    window (counted, so parallel dispatches hold it open).
 *   stop           — Stop: clears the session's reviewer state (belt and
 *                    braces for a dispatch that never returned).
 *
 * Reviewer backstop: ZCode has no agent identity in its hook payload, so the
 * ZCode gate marks the session on the Agent tool call. Claude Code instead
 * fires `SubagentStart` / `SubagentStop` with `agent_id` + `agent_type`, so
 * the window opens on the reviewer's own lifecycle event. `agent_type` is the
 * PLUGIN-SCOPED id — `arggon:arggon-standards-reviewer` — matched here as
 * `(^|:)arggon-standards-reviewer$` (pinned to the shipped agent file by
 * cli/src/init-claude.test.ts, which reads the id out of
 * `templates/docs/claude/arggon/agents/` and asserts both this matcher and the
 * hooks.json `SubagentStart` matcher follow it; a rename that misses either
 * fails the suite instead of silently disarming the backstop). While the
 * window is open the gate denies, for that session: Write/Edit (and the other
 * file-writing tools), mutating `arggon` shell invocations, git history
 * commands, and the mutating arggon MCP tools UNDER BOTH NAMES the two
 * registrations produce — the bare `mcp__arggon__*` of the generated
 * `.mcp.json` and the plugin-scoped `mcp__plugin_arggon_arggon__*` of the
 * plugin's own `mcpServers` entry (spec-claude-code-adapter-024 §MCP wiring).
 * `arggon_comment` stays open under both: it is the verdict channel.
 * `arggon_handoff` is DENIED with that set: a handoff appends a tracker section
 * to an item body, which is a mutation, not a verdict channel. This diverges
 * from the ZCode gate, which leaves `arggon_handoff` unlisted rather than
 * denied — recorded on task-claude-gate-polish as a candidate ZCode follow-up,
 * deliberately not changed on that seam here.
 *
 * State is a small JSON counter under the OS temp dir keyed by a hash of the
 * project dir + session id — never inside the repo, never a tracker file.
 *
 * Failure posture (deliberate, the seam's documented fail-open rule): an
 * unparseable or empty hook payload is fail-open (exit 0) — this gate is
 * defense-in-depth behind the kernel invariants (no reopen, no steal), and
 * deny-on-bad-payload would brick every gated tool on one malformed event.
 * The marker counter is lock-free last-writer-wins: two truly-parallel
 * SubagentStart hooks can lose an increment, worst case the window closes one
 * dispatch early — bounded by the session-scoped key and the 2h TTL. If the
 * client skips SubagentStop for an errored dispatch, Stop (or the TTL) clears
 * the marker.
 *
 * Deny-pattern scope (bug-gate-deny-pattern-matches-quoted-text-blocking-
 * benign-writes, ported from the ZCode gate — same semantics, same reasons):
 * the shell gates match the command's WORDS, not its quoted arguments. Text
 * inside single or double quotes is documentation — the payload of an `arggon
 * comment` documenting a probe, a commit message citing a denied form — and a
 * deny pattern occurring only inside such a span denies nothing. Quoted text
 * the shell will still EXECUTE is never exempted: a span that is the command
 * payload of a sh-family shell — wherever the shell sits, wrapper prefixes
 * included (`sudo sh -c "…"`, `ls | xargs sh -c '…'`), the payload flag in
 * combined short form included (`bash -lc "…"`, `sh -ec '…'` — any final flag
 * word containing `c`) — or the argument of `eval`, a span carrying a command
 * substitution (`$( … )` or backticks), and the tail of an unterminated quote
 * all stay in the scan. The shell test accepts fail-closed OVER-denial of
 * inert look-alikes (`echo sh -c "…"` is denied). Recorded residual, accepted
 * for this gate's accidental-use threat model: variable indirection is NOT
 * caught — `X='<denied form>'; $X` keeps the assignment value exempt (inert
 * text at scan time) while the unquoted expansion executes later; this gate is
 * not a shell parser. Real invocations are unquoted at their head, so the deny
 * matrix (force push, --no-verify, refspec-plus) is unchanged. Concretely: the
 * gates run against `scanText` below, which blanks inert quoted spans
 * (length-preserving) and keeps everything else verbatim.
 *
 * Output contract: exit 0 = allow (silent), exit 2 = deny (stderr is the
 * reason the client shows), anything else = hook error (fail-open on
 * PreToolUse, which is what the seam documents).
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MODE = process.argv[2];
const STATE_DIR = join(tmpdir(), "arggon-claude-hooks");
/** A dispatch that never returned must not pin the session forever. */
const MARKER_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * The mutating MCP tool suffixes. `arggon_comment` stays allowed (verdict
 * channel); `arggon_handoff` is NOT an exception — it appends a handoff section
 * to an item body, so it mutates the tracker like the rest of this set.
 */
const MUTATING_MCP_TOOLS = new Set([
  "arggon_create",
  "arggon_update",
  "arggon_start",
  "arggon_branch",
  "arggon_cleanup",
  "arggon_priority",
  "arggon_sync",
  "arggon_import_issues",
  "arggon_handoff",
]);

/**
 * The two tool-name prefixes one Claude Code session carries the arggon tools
 * under: the generated repo-root `.mcp.json` registers the server as `arggon`
 * (`mcp__arggon__*`) and the plugin's own `mcpServers` entry registers the same
 * server scoped to the plugin (`mcp__plugin_arggon_arggon__*`). Both are the
 * same `arggon mcp` process, so the backstop must deny the same set under both
 * — a deny set that only knew the bare spelling would leave the plugin-scoped
 * route open.
 */
const MCP_TOOL_PREFIXES = ["mcp__arggon__", "mcp__plugin_arggon_arggon__"];

/** File-writing tools a read-only reviewer dispatch never needs. */
const FILE_WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);

/**
 * Shell subcommands that mutate the tracker or the history, matched as words
 * anywhere in the command (covers `arggon update …`, `npm run arggon -- …`,
 * `npx arggon-manager update …`, and the dist bin directly).
 */
const MUTATING_ARGGON_WORDS =
  /\b(?:arggon|arggon-manager)\s+(?:--?[a-z-]+\s+)*(?:update|create|branch|start|cleanup|priority|sync|import-issues|migrate)\b/;

/** Git history mutations the reviewer never runs. */
const REVIEWER_SHELL_GATES = [
  { re: /\bgit\b[^;&|]*\spush\b/, why: "git push" },
  { re: /\bgit\b[^;&|]*\scommit\b/, why: "git commit" },
  { re: /\bgit\b[^;&|]*\smerge\b/, why: "git merge" },
  { re: /\bgit\b[^;&|]*\srebase\b/, why: "git rebase" },
];

/** Global gates: every session, every mode of work. */
const GLOBAL_SHELL_GATES = [
  {
    re: /\bgit\b[^;&|]*\spush\b(?=[^;&|]*\s(?:--force\b|-f[a-z]*|\+\S))/,
    why: "force push (git push --force / -f<letters>, incl. -fu / refspec-plus +ref)",
  },
  { re: /\bgit\b[^;&|]*\scommit\b[^;&|]*--no-verify\b/, why: "git commit --no-verify" },
];

function deny(why) {
  process.stderr.write(`arggon gate: denied — ${why}\n`);
  process.exit(2);
}

function allow() {
  process.exit(0);
}

function readInput() {
  const raw = readFileSync(0, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/** Project dir: Claude Code exports it to every hook process; fall back to the payload's cwd. */
function projectDir(input) {
  return (
    process.env.CLAUDE_PROJECT_DIR ?? (typeof input.cwd === "string" && input.cwd) ?? process.cwd()
  );
}

function statePath(input) {
  const key = createHash("sha256")
    .update(`${projectDir(input)}\n${String(input.session_id ?? "")}`)
    .digest("hex")
    .slice(0, 24);
  return join(STATE_DIR, `${key}.json`);
}

function readMarker(input) {
  try {
    const parsed = JSON.parse(readFileSync(statePath(input), "utf8"));
    if (typeof parsed.count !== "number" || typeof parsed.ts !== "number") return 0;
    if (Date.now() - parsed.ts > MARKER_TTL_MS) return 0;
    return Math.max(0, parsed.count);
  } catch {
    return 0;
  }
}

function writeMarker(input, count) {
  mkdirSync(STATE_DIR, { recursive: true });
  if (count <= 0) {
    rmSync(statePath(input), { force: true });
    return;
  }
  writeFileSync(statePath(input), JSON.stringify({ count, ts: Date.now() }), "utf8");
}

function reviewerActive(input) {
  return readMarker(input) > 0;
}

/** True for the plugin's standards-reviewer agent id, plain or plugin-qualified. */
function isReviewerDispatch(input) {
  const type = input?.agent_type ?? input?.tool_input?.subagent_type;
  return typeof type === "string" && /(^|:)arggon-standards-reviewer$/.test(type);
}

/** True when `tool` is a mutating arggon MCP tool under either registration prefix. */
function isMutatingMcpTool(tool) {
  for (const prefix of MCP_TOOL_PREFIXES) {
    if (tool.startsWith(prefix) && MUTATING_MCP_TOOLS.has(tool.slice(prefix.length))) return true;
  }
  return false;
}

function bashCommand(input) {
  const command = input?.tool_input?.command;
  return typeof command === "string" ? command : "";
}

/**
 * [start, end) spans of shell-quoted text in `command`: single- and
 * double-quoted regions, honoring backslash escapes outside quotes and inside
 * double quotes (none inside single quotes, per POSIX). An unterminated quote
 * yields NO span for its tail, so that text stays in the scan (fail-closed).
 */
function quotedSpans(command) {
  const spans = [];
  let quote = null;
  let start = -1;
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote !== null) {
      if (ch === quote) {
        spans.push([start, i + 1]);
        quote = null;
      } else if (quote === '"' && ch === "\\") {
        i++;
      }
    } else if (ch === "\\") {
      i++;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      start = i;
    }
  }
  return spans;
}

/**
 * True when the quoted span [start, end) will still be EXECUTED rather than
 * printed or stored: it is the command payload of a sh-family shell — wherever
 * that shell sits in the command, wrapper prefixes included (`sh -c "…"`,
 * `sudo sh -c "…"`, `ls | xargs sh -c '…'`), the payload flag in combined
 * short form included (`bash -lc "…"`, `sh -ec '…'`: the final flag word only
 * needs to CONTAIN `c` — requiring exactly `-c` let `-lc` / `-ec` payloads
 * blank as inert and run, a deny→allow regression the ZCode seam's review
 * probed) — or the argument of `eval`, or it carries a command substitution
 * (`$( … )` / backticks — the substituted text runs). A gate match inside such
 * a span is a real invocation and must still deny. The shell test is
 * deliberately UNANCHORED in the head, so inert look-alikes are over-denied
 * fail-closed (`echo sh -c "…"`); and this is deliberately NOT a shell parser:
 * a quoted assignment value that a later unquoted `$var` expansion runs
 * (`X='…'; $X`) is inert at scan time and stays exempt — a recorded residual,
 * see "Deny-pattern scope" in the header.
 */
function quotedSpanExecutes(command, start, end) {
  if (/\$\(|`/.test(command.slice(start, end))) return true;
  const head = command.slice(0, start);
  return /\S*sh\s+(?:-\S+\s+)*-\S*c\S*\s*$/.test(head) || /\beval\s+$/.test(head);
}

/**
 * The command with inert quoted spans blanked (same length, spaces in place,
 * so nothing shifts): the text the shell gates scan. Quoted spans that still
 * execute and unterminated quote tails are kept verbatim — see
 * "Deny-pattern scope" in the header.
 */
function scanText(command) {
  let out = command;
  for (const [start, end] of quotedSpans(command).reverse()) {
    if (quotedSpanExecutes(command, start, end)) continue;
    out = out.slice(0, start) + " ".repeat(end - start) + out.slice(end);
  }
  return out;
}

function pre(input) {
  const tool = typeof input.tool_name === "string" ? input.tool_name : "";
  if (tool === "Bash") {
    // Scan the command's words, not its quoted arguments (see "Deny-pattern
    // scope" in the header): inert quoted text is blanked before matching.
    const scanned = scanText(bashCommand(input));
    for (const gate of GLOBAL_SHELL_GATES) {
      if (gate.re.test(scanned)) deny(`${gate.why} is denied by the arggon plugin gate`);
    }
    if (reviewerActive(input)) {
      if (MUTATING_ARGGON_WORDS.test(scanned)) {
        deny(
          "a reviewer dispatch is in flight — tracker mutations are denied (post the verdict with arggon_comment)",
        );
      }
      for (const gate of REVIEWER_SHELL_GATES) {
        if (gate.re.test(scanned)) deny(`reviewer dispatch in flight — ${gate.why} is denied`);
      }
    }
    allow();
  }
  if (FILE_WRITE_TOOLS.has(tool)) {
    if (reviewerActive(input)) {
      deny("a reviewer dispatch is in flight — the reviewer is read-only");
    }
    allow();
  }
  if (isMutatingMcpTool(tool)) {
    if (reviewerActive(input)) {
      deny(
        `a reviewer dispatch is in flight — ${tool} is denied (read with arggon_show, post the verdict with arggon_comment)`,
      );
    }
    allow();
  }
  allow();
}

function subagentStart(input) {
  if (isReviewerDispatch(input)) {
    writeMarker(input, readMarker(input) + 1);
  }
  process.exit(0);
}

function subagentStop(input) {
  if (isReviewerDispatch(input)) {
    writeMarker(input, readMarker(input) - 1);
  }
  process.exit(0);
}

function stop(input) {
  writeMarker(input, 0);
  process.exit(0);
}

if (MODE === "pre") pre(readInput());
else if (MODE === "subagent-start") subagentStart(readInput());
else if (MODE === "subagent-stop") subagentStop(readInput());
else if (MODE === "stop") stop(readInput());
else {
  process.stderr.write(
    "arggon gate: mode required (pre | subagent-start | subagent-stop | stop)\n",
  );
  process.exit(1);
}
