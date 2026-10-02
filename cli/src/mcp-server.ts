import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { arggonVersion } from "./docs.js";
import { bundledTemplatesDir } from "./package-assets.js";
import {
  HANDOFF_SESSION_CAP,
  ITEM_TYPES,
  STATUSES,
  commentOperation,
  createOperation,
  handoffOperation,
  importIssuesOperation,
  listOperation,
  nextOperation,
  parseCsvList,
  priorityOperation,
  reportOperation,
  showOperation,
  syncOperation,
  updateOperation,
  validateOperation,
  type CommandOutcome,
} from "@arggondev/lib";

/**
 * Stdio MCP server exposing the shared kernel (list/create/update/comment) as
 * MCP tools. No new schema logic: tool handlers call the shared kernel
 * operations (`lib/src/operations.ts`, exported by the `@arggondev/lib`
 * entry) — the same path the CLI uses — and return the documented `--json`
 * envelope objects as tool text.
 * Agent playbook rules are enforced by passing `agent: true` to runUpdate —
 * the MCP layer cannot reopen done/cancelled items or steal claims.
 *
 * Full tool surface (ADR 0014, task-mcp-full-surface): ZCode has no code-mode
 * tool API, so the MCP server is a client's complete native surface. Beyond
 * the core nine it exposes `priority`/`sync`/`import_issues` through their
 * kernel operations in-process, and `start`/`branch`/`cleanup` by spawning
 * the arggon CLI itself (argv array, never a shell — injection-safe by
 * construction) and returning the CLI's `--json` envelope. One implementation
 * path keeps the worktree ergonomics (the CLI's link-farm `start --worktree`,
 * `cleanup --prune`); the spawned CLI is the same path agents already use, so
 * the kernel rules (no reopen, no steal — no `--force` surface anywhere) hold
 * unchanged. Kernel failures surface as tool errors and never kill the
 * session; a child that dies without an envelope (crash, timeout kill)
 * throws a tool-level error carrying a clipped stderr tail.
 *
 * Session attribution (task-opencode-v2-mcp-meta): OpenCode V2 sends the
 * invoking session ID in `CallToolRequest.params._meta.sessionID` for calls
 * made on behalf of a session (https://opencode.ai/v2/docs/mcp-servers/). The
 * server uses it as the DEFAULT `session` for arggon_handoff and the DEFAULT
 * `author` for arggon_comment/arggon_handoff; explicit tool arguments always
 * win. The value is normalized once at the boundary
 * (task-opencode-v2-mcp-meta-hardening): a single-line token cut at the first
 * whitespace/control/format character and capped at `HANDOFF_SESSION_CAP` (64)
 * with `…`, so every consumer inherits the bound and a crafted value can never
 * inject a heading line or an unbounded author. It is opaque correlation
 * metadata only — never authentication or authorization, never logged, and it
 * triggers no state transitions (the shared rules module stays the only path
 * for updates).
 */

const SUPPORTED_PROTOCOL_VERSIONS = ["2024-11-05", "2025-03-26", "2025-06-18"] as const;
const DEFAULT_PROTOCOL_VERSION = "2025-06-18";

const SERVER_INFO = { name: "arggon", version: arggonVersion() };

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

const TOOLS: ToolDefinition[] = [
  {
    name: "arggon_list",
    description:
      "List work items under the tracker root (ArggonManager/, legacy tasks/) with optional filters. Returns the arggon `list --json` envelope: {ok, schemaVersion, conventionVersion, command, items}.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: [...STATUSES],
          description: "exact v0 status filter",
        },
        type: {
          type: "string",
          enum: [...ITEM_TYPES],
          description: "exact v0 type filter",
        },
        assignee: {
          type: "string",
          description:
            "exact assignee login; @me resolves via GITHUB_USER, then GITHUB_ACTOR, then `gh api user`",
        },
        parent: {
          type: "string",
          description:
            'exact parent item id (sugar for the "parent:" filter predicate); ANDed with the other filters',
        },
        filter: {
          type: "string",
          description: 'compact filter expression, e.g. "status:todo !label:security"',
        },
        view: {
          type: "string",
          description: "saved view name from the tracker .convention.yml x-views",
        },
        stale: {
          type: "boolean",
          description:
            "list claimed items whose claimed_at lease is older than older_than (claims from before claimed_at count as stale)",
          default: false,
        },
        older_than: {
          type: "string",
          description: "stale threshold for stale: <number><d|h|m> (e.g. 7d, 12h, 30m)",
        },
        full: {
          type: "boolean",
          description:
            "emit complete WorkItem shapes (default: compact per ADR 0006 — null/empty optional fields omitted)",
          default: false,
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "arggon_create",
    description:
      "Create a work item under a parent container. Returns the arggon `create --json` envelope: {ok, schemaVersion, conventionVersion, command, id, path, item}.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: [...ITEM_TYPES], description: "item type to create" },
        title: { type: "string", description: "human title (non-empty)" },
        parent: {
          type: "string",
          description: "parent container id (required for non-initiatives)",
        },
        id: {
          type: "string",
          description: "optional explicit id stem (leaves get task-/bug- prefix)",
        },
        assignee: { type: "string", description: "optional assignee login" },
        labels: {
          type: "string",
          description:
            "label the new item at creation (comma-separated; same rules as update --labels)",
        },
        status: {
          type: "string",
          enum: ["todo", "in_progress", "blocked", "cancelled"],
          description: "initial status (todo ↛ done: claim first)",
        },
        blocked_reason: {
          type: "string",
          description: "required when status is blocked",
        },
        issue: {
          type: "integer",
          minimum: 1,
          description:
            "GitHub issue number recorded in the additive issue frontmatter field (start --open-pr appends Closes #N)",
        },
        full: {
          type: "boolean",
          description:
            "emit complete WorkItem shapes (default: compact per ADR 0006 — null/empty optional fields omitted)",
          default: false,
        },
      },
      required: ["type", "title"],
      additionalProperties: false,
    },
  },
  {
    name: "arggon_update",
    description:
      "Update frontmatter fields of one work item. Runs with agent playbook rules: done/cancelled items cannot be reopened and claimed items cannot be stolen. Returns the arggon `update --json` envelope: {ok, schemaVersion, conventionVersion, command, id, path, item, changed}.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "work item id" },
        title: { type: "string", description: "new title (non-empty)" },
        status: {
          type: "string",
          enum: [...STATUSES],
          description: "new status (must follow v0 transitions)",
        },
        assignee: {
          type: "string",
          description: "new assignee (claimable types need one when in_progress)",
        },
        branch: { type: "string", description: "set working branch (empty string clears)" },
        parent: {
          type: "string",
          description:
            "reparent the item under this container id (same edge validation as the CLI: unknown parent, wrong parent type, cycles fail)",
        },
        type: {
          type: "string",
          enum: ["story"],
          description:
            "convert the item's type in place; v1 supports only 'story' (promote a task: moves the file to the story layout under the grandparent epic, renames task-x to story-x, rewrites depends_on references, keeps issue/labels/body; refuses bugs, stories, and missing epics)",
        },
        unassign: { type: "boolean", description: "clear assignee", default: false },
        labels: { type: "string", description: "replace the full labels list (comma-separated)" },
        depends_on: {
          type: "string",
          description:
            "replace the full depends_on list of item ids (comma-separated; empty clears)",
        },
        add_depends_on: {
          type: "string",
          description: "append one depends_on id (no-op when already present)",
        },
        issue: {
          type: "integer",
          minimum: 0,
          description:
            "set the GitHub issue number in the additive issue frontmatter field (positive integer; 0 clears it)",
        },
        blocked_reason: {
          type: "string",
          description: "required when status is blocked; forbidden otherwise",
        },
        no_cascade: {
          type: "boolean",
          description:
            "skip automatic container completion when this update closes the last open descendant",
          default: false,
        },
        full: {
          type: "boolean",
          description:
            "emit complete WorkItem shapes (default: compact per ADR 0006 — null/empty optional fields omitted)",
          default: false,
        },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "arggon_comment",
    description:
      "Append a timestamped, author-attributed comment section to a work item's body (agent handoff context: why blocked, what the next agent should know). Body-only write: frontmatter is never touched (no `updated` bump; works on done/cancelled items — this is not a reopen). Returns the arggon `comment --json` envelope: {ok, schemaVersion, conventionVersion, command, id, path, comment: {author, date, lines}}.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "work item id" },
        text: { type: "string", description: "comment text (multiline supported; non-empty)" },
        author: {
          type: "string",
          description:
            "author login (optional; explicit non-empty value wins; default: the normalized `_meta.sessionID` when the client sends one — single line, capped at 64 chars — else @me resolution: GITHUB_USER, then GITHUB_ACTOR, then `gh api user`)",
        },
      },
      required: ["id", "text"],
      additionalProperties: false,
    },
  },
  {
    name: "arggon_handoff",
    description:
      "Append a structured, bounded session-end handoff section to a work item's body: `### handoff <date> @<author>[ (session: <id>)] — next: <step>` + bounded lines for branch (auto-detected from git when omitted) and optional open questions. Appends through the same body-only path as arggon_comment (frontmatter never touched, works on done/cancelled items). Each field is capped at 200 characters (the session identifier at 64; longer input truncates). Returns the arggon `handoff --json` envelope: {ok, schemaVersion, conventionVersion, command, id, path, comment: {author, date, lines}, handoff: {branch, next, openQuestions?, session?}}.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "work item id" },
        next: {
          type: "string",
          description:
            "the first thing the resuming agent should do (required; capped at 200 chars)",
        },
        branch: {
          type: "string",
          description: "working branch (optional; auto-detected from git when omitted)",
        },
        open_questions: {
          type: "string",
          description:
            "open questions, semicolon-separated by convention (optional; capped at 200 chars)",
        },
        session: {
          type: "string",
          description:
            "session identifier for provenance, rendered in the heading (optional; explicit non-empty value wins; default: the normalized `_meta.sessionID` — single line, capped at 64 chars)",
        },
        author: {
          type: "string",
          description:
            "author login (optional; explicit non-empty value wins; default: the normalized `_meta.sessionID` when the client sends one — single line, capped at 64 chars — else @me resolution: GITHUB_USER, then GITHUB_ACTOR, then `gh api user`)",
        },
      },
      required: ["id", "next"],
      additionalProperties: false,
    },
  },
  {
    name: "arggon_show",
    description:
      "Read one work item with bounded output (ADR 0006): frontmatter fields plus the body's last comments by default; the full body is an explicit opt-in. Pure read — never writes. Returns the arggon `show --json` envelope: {ok, schemaVersion, conventionVersion, command, item, path, comments[, body]}.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "work item id" },
        meta: {
          type: "boolean",
          description: "frontmatter only — no body, no comments (highest precedence)",
          default: false,
        },
        body: {
          type: "boolean",
          description: "full body including ALL comments (the unbounded explicit opt-in)",
          default: false,
        },
        tail_comments: {
          type: "number",
          description: "compact view: include the last N comments instead of the default 3",
        },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "arggon_next",
    description:
      "Suggest the next claimable item (ADR 0006 next-first + ADR 0009 priority-major): ready items (depends_on all done/cancelled) rank first by the orchestrator priority (p0 best; unprioritized with the p3 tier), then by downstream weight — the unblocks count — with lexicographic id on ties; blocked items are suggested only when nothing is ready. Pure read — never writes. Returns the arggon `next --json` envelope: {ok, schemaVersion, conventionVersion, command, suggestion} where suggestion is {item, parentChain, reason, blockedBy, unblocks} or null when the pool is empty.",
    inputSchema: {
      type: "object",
      properties: {
        ready: {
          type: "boolean",
          description:
            "limit the pool to ready items (unclaimed todos whose depends_on are all done/cancelled)",
          default: false,
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "arggon_report",
    description:
      "Aggregate leaf (task/bug) statuses per story, grouped by epic — display only, never writes. Returns the arggon `report --json` envelope: {ok, schemaVersion, conventionVersion, command, groups[, trend]}.",
    inputSchema: {
      type: "object",
      properties: {
        trend: {
          type: "boolean",
          description: "mine git history: weekly completions and cycle time (pure read)",
          default: false,
        },
        since: {
          type: "string",
          description: "trend window start, YYYY-MM-DD (requires trend)",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "arggon_validate",
    description:
      "Validate tracker frontmatter and tree integrity (parent edges, statuses, claim/blocked invariants, depends_on). Pure read — never writes. Returns the arggon `validate --json` envelope: {ok, schemaVersion, conventionVersion, command, layout, errors, warnings}; ok is false and the result is a tool error when there is at least one error.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "arggon_priority",
    description:
      "Move legacy pN labels into the priority field on all items (highest label wins, all pN labels removed, non-priority labels kept; idempotent; never auto-commits — review and commit once). Returns the arggon `priority migrate --json` envelope: {ok, schemaVersion, conventionVersion, command, dryRun, scanned, changed, entries}.",
    inputSchema: {
      type: "object",
      properties: {
        dry_run: {
          type: "boolean",
          description: "plan only: print the per-item changes and write NOTHING",
          default: false,
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "arggon_sync",
    description:
      "Reconcile item branch fields with open GitHub PRs; check mode reports matches without modifying (default), write mode fills empty branch fields. Returns the arggon `sync --json` envelope: {ok, schemaVersion, conventionVersion, command, mode, matched, unmatched, pending, errors}.",
    inputSchema: {
      type: "object",
      properties: {
        check: {
          type: "boolean",
          description: "check mode: report matches without modifying (default)",
          default: false,
        },
        write: {
          type: "boolean",
          description: "write mode: fill empty branch fields from PRs",
          default: false,
        },
        repo: {
          type: "string",
          description: "owner/name; default detected from the origin remote",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "arggon_import_issues",
    description:
      "Import GitHub issues into the tracker as task/bug items (idempotent; x-import maps labels to types; `dry_run: true` plans without writing). Requires the `gh` CLI. Returns the arggon `import-issues --json` envelope: {ok, schemaVersion, conventionVersion, command, dryRun, story, entries, created, skipped, commit}.",
    inputSchema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: "owner/name; default from gh's own resolution from the repo root",
        },
        parent: {
          type: "string",
          description:
            "target story for imported tasks (default: story-imported-issues, created under the first epic when missing)",
        },
        dry_run: {
          type: "boolean",
          description: "print the mapping plan (would-create / would-skip) without writing",
          default: false,
        },
        no_commit: {
          type: "boolean",
          description:
            "keep the tracker dirty: skip the tracker auto-commit of the imported items (default: on; x-tracker.auto-commit: false opts out tree-wide)",
          default: false,
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "arggon_start",
    description:
      "Claim an item, check out its branch, commit, push, and optionally open a draft PR (`worktree: true` runs the flow inside a linked git worktree at ../<repo-name>-<id>, prepared before the claim commit and kept on failure). Spawns the arggon CLI; push and the PR step hit the network. Returns the arggon `start --json` envelope: {ok, schemaVersion, conventionVersion, command, item, branch, created, pushed, prUrl, worktreePath, linkedNodeModules, linkedWorkspaces, manifestCoverage, ...}.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "work item id" },
        assignee: {
          type: "string",
          description: "claim as this login (default: GITHUB_USER / GITHUB_ACTOR)",
        },
        open_pr: {
          type: "boolean",
          description: "open a draft PR after pushing",
          default: false,
        },
        worktree: {
          type: "boolean",
          description:
            "run the flow inside a linked git worktree at ../<repo-name>-<id> (recorded on the item as worktree_path; the worktree is prepared before the claim commit and kept on failure)",
          default: false,
        },
        no_hook: {
          type: "boolean",
          description:
            "skip the x-worktree.post-start hook (it only runs when a new worktree is created)",
          default: false,
        },
        take_over_worktree: {
          type: "boolean",
          description:
            "take over a worktree whose stamped owner session is dead: records a dated take-over naming the replaced stamp and re-stamps the worktree (only when the single-writer detection fired; requires worktree)",
          default: false,
        },
        post_start_shell: {
          type: "string",
          enum: ["inherit", "login"],
          description:
            'shell for the x-worktree.post-start hook: "inherit" (default) or "login" ($SHELL -lc; overrides x-worktree.post-start-shell)',
        },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "arggon_branch",
    description:
      "Check out the working branch for an item (generated from branch_patterns). Spawns the arggon CLI. Returns the arggon `branch --json` envelope: {ok, schemaVersion, conventionVersion, command, item, branch, created}.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "work item id" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "arggon_cleanup",
    description:
      "List worktrees of done/cancelled items whose branches are merged (`prune: true` removes them, deletes their merged branches, and clears the worktree_path records; when the repo declares `x-worktree.services`, each removable worktree's Compose project is torn down first). `release` instead reaps one dropped claim's worktree. Spawns the arggon CLI. Returns the arggon `cleanup --json` envelope: {ok, schemaVersion, conventionVersion, command, base, candidates, pruned, failures[, release, released][, compose][, commit]}.",
    inputSchema: {
      type: "object",
      properties: {
        prune: {
          type: "boolean",
          description:
            "remove removable worktrees (git worktree remove), delete their merged branches, and clear the worktree_path records",
          default: false,
        },
        // Lean by design (ADR 0006/0014 schema budget): the release contract is
        // named in the tool description and documented in
        // ArggonManager/docs/agents.md §Worktrees — the properties stay bare.
        release: { type: "string" },
        take_over_worktree: { type: "boolean", default: false },
        no_commit: {
          type: "boolean",
          description:
            "keep the tracker dirty: skip the tracker auto-commit of the cleared worktree_path records (default: on with prune; x-tracker.auto-commit: false opts out tree-wide)",
          default: false,
        },
        no_gh: {
          type: "boolean",
          description:
            "ancestry-only classification: skip the gh fallback that detects squash-merged PRs when the branch fails the ancestry check (offline/CI use)",
          default: false,
        },
      },
      additionalProperties: false,
    },
  },
];

/** How the server re-invokes the arggon CLI (see `cliSpawn` below). */
export type CliSpawnSpec = { command: string; args: string[] };

/** One MCP server session bound to fixed streams and a fixed repo root. */
export type McpServerOptions = {
  /** Repo root (parent of the tracker dir); all tool calls run against this tree. */
  cwd: string;
  input: Readable;
  output: Writable;
  /** Called when the client closes its end (tests use this to finish). */
  onClose?: () => void;
  /**
   * How `arggon_start`/`arggon_branch`/`arggon_cleanup` re-enter the CLI.
   * Default: derived from the running process — the built bin (`arggon mcp`
   * → `argv = [node, <root>/dist/cli.js, "mcp"]`) and source runs
   * (`npm run arggon -- mcp` → tsx + `cli.ts`) both re-enter themselves;
   * anything else (embedding the server in another process) must inject the
   * spec or the three spawn tools fail with a remediation message.
   */
  cliSpawn?: CliSpawnSpec;
};

export function runMcpServer(opts: McpServerOptions): void {
  const write = (message: Record<string, unknown>): void => {
    opts.output.write(`${JSON.stringify(message)}\n`);
  };

  const respond = (id: string | number | null, result: Record<string, unknown>): void => {
    write({ jsonrpc: "2.0", id, result });
  };

  const respondError = (id: string | number | null, code: number, message: string): void => {
    write({ jsonrpc: "2.0", id, error: { code, message } });
  };

  const handleInitialize = (params: Record<string, unknown>): Record<string, unknown> => {
    const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
    const protocolVersion = (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
      ? requested
      : DEFAULT_PROTOCOL_VERSION;
    return {
      protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER_INFO,
    };
  };

  /**
   * One tool result: the kernel operation's documented `--json` envelope as
   * JSON text. `ok: false` (a kernel failure, or a pure read like validate
   * that found problems) surfaces as a tool error without throwing through the
   * session; the session continues (failure isolation, ADR 0011).
   */
  const toolResult = (outcome: { ok: boolean; envelope: unknown }): Record<string, unknown> => ({
    content: [{ type: "text", text: JSON.stringify(outcome.envelope) }],
    ...(outcome.ok ? {} : { isError: true }),
  });

  const callTool = (params: Record<string, unknown>): Record<string, unknown> => {
    const name = params.name;
    const args = (params.arguments ?? {}) as Record<string, unknown>;
    // OpenCode V2 session context (opaque correlation, may be absent); used
    // only as the default attribution below, never for any decision.
    const metaSession = sessionIDFromMeta(params);
    if (name === "arggon_list") {
      return toolResult(
        listOperation({
          cwd: opts.cwd,
          status: str(args.status),
          type: str(args.type),
          parent: str(args.parent),
          assignee: str(args.assignee),
          filter: str(args.filter),
          view: str(args.view),
          stale: args.stale === true,
          olderThan: str(args.older_than),
          full: args.full === true,
        }),
      );
    }
    if (name === "arggon_create") {
      return toolResult(
        createOperation({
          cwd: opts.cwd,
          type: str(args.type) ?? "",
          title: str(args.title) ?? "",
          parent: str(args.parent),
          id: str(args.id),
          assignee: str(args.assignee),
          labels: str(args.labels) !== undefined ? parseCsvList(str(args.labels)!) : undefined,
          status: str(args.status),
          blockedReason: str(args.blocked_reason),
          issue: typeof args.issue === "number" ? args.issue : undefined,
          templatesDir: bundledTemplatesDir(),
          full: args.full === true,
          // Tracker auto-commit resolves like the CLI (`x-tracker.auto-commit`,
          // default ON) so both entry points stay envelope-identical.
        }),
      );
    }
    if (name === "arggon_update") {
      return toolResult(
        updateOperation({
          cwd: opts.cwd,
          id: str(args.id) ?? "",
          title: str(args.title),
          status: str(args.status),
          assignee: str(args.assignee),
          branch: str(args.branch),
          parent: str(args.parent),
          type: str(args.type),
          unassign: args.unassign === true,
          labels: str(args.labels),
          dependsOn: str(args.depends_on),
          addDependsOn: str(args.add_depends_on),
          issue: typeof args.issue === "number" ? args.issue : undefined,
          blockedReason: str(args.blocked_reason),
          cascade: args.no_cascade !== true,
          full: args.full === true,
          agent: true,
        }),
      );
    }
    if (name === "arggon_comment") {
      return toolResult(
        commentOperation({
          cwd: opts.cwd,
          id: str(args.id) ?? "",
          text: str(args.text) ?? "",
          // Explicit author wins; otherwise the V2 session ID is the default.
          author: explicitOrMeta(str(args.author), metaSession),
          // Tracker auto-commit resolves like the CLI.
        }),
      );
    }
    if (name === "arggon_handoff") {
      return toolResult(
        handoffOperation({
          cwd: opts.cwd,
          id: str(args.id) ?? "",
          next: str(args.next) ?? "",
          branch: str(args.branch),
          openQuestions: str(args.open_questions),
          // Explicit session/author win; otherwise the V2 session ID is both
          // the default provenance session and the default author.
          session: explicitOrMeta(str(args.session), metaSession),
          author: explicitOrMeta(str(args.author), metaSession),
          // Tracker auto-commit resolves like the CLI.
        }),
      );
    }
    if (name === "arggon_show") {
      return toolResult(
        showOperation({
          cwd: opts.cwd,
          id: str(args.id) ?? "",
          meta: args.meta === true,
          body: args.body === true,
          tailComments: typeof args.tail_comments === "number" ? args.tail_comments : undefined,
        }),
      );
    }
    if (name === "arggon_next") {
      return toolResult(nextOperation({ cwd: opts.cwd, ready: args.ready === true }));
    }
    if (name === "arggon_report") {
      return toolResult(
        reportOperation({
          cwd: opts.cwd,
          trend: args.trend === true,
          since: str(args.since),
        }),
      );
    }
    if (name === "arggon_validate") {
      return toolResult(validateOperation({ cwd: opts.cwd }));
    }
    if (name === "arggon_priority") {
      return toolResult(
        priorityOperation({
          cwd: opts.cwd,
          dryRun: args.dry_run === true,
        }),
      );
    }
    if (name === "arggon_sync") {
      return toolResult(
        syncOperation({
          cwd: opts.cwd,
          check: args.check === true,
          write: args.write === true,
          repo: str(args.repo),
        }),
      );
    }
    if (name === "arggon_import_issues") {
      return toolResult(
        importIssuesOperation({
          cwd: opts.cwd,
          repo: str(args.repo),
          parent: str(args.parent),
          dryRun: args.dry_run === true,
          // Tracker auto-commit resolves like the CLI (`x-tracker.auto-commit`,
          // default ON) so both entry points stay envelope-identical.
          commit: args.no_commit === true ? false : undefined,
          templatesDir: bundledTemplatesDir(),
        }),
      );
    }
    if (name === "arggon_start") {
      return toolResult(
        spawnedOutcome(opts, "start", [
          str(args.id) ?? "",
          ...(typeof args.assignee === "string" ? ["--assignee", args.assignee] : []),
          ...(args.open_pr === true ? ["--open-pr"] : []),
          ...(args.worktree === true ? ["--worktree"] : []),
          ...(args.no_hook === true ? ["--no-hook"] : []),
          ...(args.take_over_worktree === true ? ["--take-over-worktree"] : []),
          ...(typeof args.post_start_shell === "string"
            ? ["--post-start-shell", args.post_start_shell]
            : []),
        ]),
      );
    }
    if (name === "arggon_branch") {
      return toolResult(spawnedOutcome(opts, "branch", [str(args.id) ?? ""]));
    }
    if (name === "arggon_cleanup") {
      return toolResult(
        spawnedOutcome(opts, "cleanup", [
          ...(args.prune === true ? ["--prune"] : []),
          ...(typeof args.release === "string" ? ["--release", args.release] : []),
          ...(args.take_over_worktree === true ? ["--take-over-worktree"] : []),
          ...(args.no_commit === true ? ["--no-commit"] : []),
          ...(args.no_gh === true ? ["--no-gh"] : []),
        ]),
      );
    }
    throw new Error(`unknown tool "${String(name)}"`);
  };

  const dispatch = (message: JsonRpcRequest): void => {
    const params = message.params ?? {};
    switch (message.method) {
      case "initialize":
        respond(message.id as string | number, handleInitialize(params));
        return;
      case "ping":
        respond(message.id as string | number, {});
        return;
      case "tools/list":
        respond(message.id as string | number, { tools: TOOLS });
        return;
      case "tools/call": {
        try {
          respond(message.id as string | number, callTool(params));
        } catch (err) {
          // Unknown tool name: a tool-level failure, not a protocol error.
          const message2 = err instanceof Error ? err.message : String(err);
          respond(message.id as string | number, {
            content: [{ type: "text", text: message2 }],
            isError: true,
          });
        }
        return;
      }
      default:
        if (message.id !== undefined && message.id !== null) {
          respondError(message.id, -32601, `method not found: ${message.method}`);
        }
    }
  };

  const rl = createInterface({ input: opts.input, crlfDelay: Infinity });
  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let message: JsonRpcRequest;
    try {
      message = JSON.parse(trimmed) as JsonRpcRequest;
    } catch {
      respondError(null, -32700, "parse error: line is not valid JSON");
      return;
    }
    // Notifications (no id) get no response; unknown ones are ignored.
    dispatch(message);
  });
  rl.on("close", () => {
    opts.onClose?.();
  });
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Wall-clock budget for one spawned CLI flow (`start` pushes; PRs included). */
const CLI_SPAWN_TIMEOUT_MS = 600_000;
/** Envelope read-back bound (only start/branch/cleanup spawn the CLI). */
const CLI_SPAWN_MAX_BUFFER = 32 * 1024 * 1024;
/** Tool-error message budget for a clipped child stderr tail. */
const CLI_SPAWN_ERROR_CHARS = 500;

/**
 * Clip an error detail to the tool-error budget, keeping the TAIL (the failing
 * line is usually last in a CLI's stderr).
 */
function clipTail(text: string, max = CLI_SPAWN_ERROR_CHARS): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `…${trimmed.slice(trimmed.length - max)}`;
}

/**
 * Derive the CLI re-entry spec from how this server process was launched.
 * Built bin: `arggon mcp` → `argv = [node, <root>/dist/cli.js, "mcp"]` —
 * re-spawn `[node, <root>/dist/cli.js]`. Wrapper source run: `npm run arggon
 * -- mcp` → `argv = [node, <tsx>/cli.mjs, <root>/cli/src/cli.ts, "mcp"]` —
 * re-spawn `[node, <tsx>/cli.mjs, <root>/cli/src/cli.ts]`. Loader source run
 * (`node --import <tsx loader> <root>/cli/src/cli.ts`, the spawn shape every
 * test chain uses since the wrapper re-exec fix): node strips its own options
 * out of argv — argv[1] is already the entry, the `--import` target lives in
 * `process.execArgv` — so re-spawn with the runtime flags forwarded ahead of
 * the entry (the `child_process.fork` default). Forwarding `execArgv` whole
 * also covers `NODE_OPTIONS`-driven registrations, because the child inherits
 * the environment. Anything else returns undefined and the spawn tools fail
 * with the remediation message instead of re-spawning an unrelated entry —
 * tests inject; under vitest the check rejects the forks worker
 * (`dist/workers/forks.js`, what argv[1] actually is there; the suffix checks
 * are deliberately narrow, not basename claims).
 */
export function deriveDefaultCliSpawn(): CliSpawnSpec | undefined {
  const entry = process.argv[1];
  if (!entry) return undefined;
  if (entry.endsWith("cli.js")) return { command: process.execPath, args: [entry] };
  const source = process.argv[2];
  if (entry.endsWith("cli.mjs") && typeof source === "string" && source.endsWith(".ts")) {
    return { command: process.execPath, args: [entry, source] };
  }
  if (entry.endsWith("cli.ts")) {
    return { command: process.execPath, args: [...process.execArgv, entry] };
  }
  return undefined;
}

/**
 * Run one CLI flow (`start`/`branch`/`cleanup`) and return its `--json`
 * envelope as the tool outcome (ADR 0014). The child gets an argv array —
 * never a shell — so tool arguments cannot inject commands. A child that
 * exits with a parsable envelope (kernel failure, `ok: false` on stdout)
 * becomes a tool error result; a child that dies without one (crash, timeout
 * kill) throws a tool-level error carrying a clipped stderr tail — both keep
 * the MCP session alive.
 */
function spawnedOutcome(
  opts: { cwd: string; cliSpawn?: CliSpawnSpec },
  command: string,
  args: string[],
): CommandOutcome {
  const spec = opts.cliSpawn ?? deriveDefaultCliSpawn();
  if (!spec) {
    throw new Error(
      `arggon_${command} spawns the arggon CLI; launch \`arggon mcp\` through the built bin ` +
        `(or \`npm run arggon -- mcp\`), or inject options.cliSpawn (tests)`,
    );
  }
  const proc = spawnSync(spec.command, [...spec.args, command, "--json", ...args], {
    cwd: opts.cwd,
    encoding: "utf8",
    timeout: CLI_SPAWN_TIMEOUT_MS,
    maxBuffer: CLI_SPAWN_MAX_BUFFER,
  });
  const stdout = typeof proc.stdout === "string" ? proc.stdout : "";
  const stderr = typeof proc.stderr === "string" ? proc.stderr : "";
  let envelope: unknown;
  try {
    envelope = JSON.parse(stdout);
  } catch {
    const why =
      proc.error?.message ??
      (proc.signal !== null ? `killed by ${proc.signal}` : `exit code ${proc.status ?? "unknown"}`);
    throw new Error(
      `arggon ${command} did not emit a JSON envelope (${why}): ${clipTail(stderr) || "no stderr"}`,
    );
  }
  const ok = (envelope as { ok?: unknown }).ok === true;
  if (ok) return { ok: true, envelope, exitCode: 0 } as CommandOutcome;
  return {
    ok: false,
    envelope,
    exitCode: proc.status === 0 ? 1 : (proc.status ?? 1),
  } as CommandOutcome;
}

/**
 * Single-line token delimiter: any whitespace, control, format or surrogate
 * character. Session IDs are tokens (`ses_…`); everything from the first
 * delimiter is dropped, so a crafted `_meta.sessionID` can never smuggle a
 * second line or heading into an item body. A surrogate (`Cs`) matches only
 * when unpaired — a valid pair is one code point and matches nothing here —
 * so cutting at one keeps a lone surrogate out of the normalized value
 * (task-opencode2-mcp-nits).
 */
const META_TOKEN_DELIMITER = /[\s\p{Cc}\p{Cf}\p{Cs}]/u;

/**
 * Normalize the meta-derived session ID into a bounded single-line token:
 * trim surrounding whitespace, cut at the first whitespace/control/format
 * character, then cap at `HANDOFF_SESSION_CAP` (64) characters with `…` — the
 * exact bound the handoff `session` field enforces. Returns undefined when the
 * value normalizes to nothing (whitespace-only, control-only, empty), so
 * consumers fall back to their normal defaults.
 *
 * Normalizing here (task-opencode-v2-mcp-meta-hardening, finding F1) means
 * `comment.author` inherits the bound too — the comment kernel only trims its
 * author — instead of forwarding a client-controlled 300-char value or a
 * literal `\n### injected heading` line.
 *
 * The cap counts UTF-16 code units — the same bound `capSession` in
 * handoff.ts enforces — but never splits a surrogate pair
 * (task-opencode2-mcp-nits): a pair straddling the cut is dropped whole, so
 * the normalized value carries no lone surrogate and still fits the cap,
 * which means the downstream `capSession` sees an already-bounded value and
 * never re-cuts it.
 */
function normalizeSessionID(value: string): string | undefined {
  const token = value.trim().split(META_TOKEN_DELIMITER, 1)[0] ?? "";
  if (!token) return undefined;
  if (token.length > HANDOFF_SESSION_CAP) {
    const marker = "…";
    // The marker counts against the cap: the normalized value is never longer
    // than HANDOFF_SESSION_CAP code units.
    let end = HANDOFF_SESSION_CAP - marker.length;
    const last = token.charCodeAt(end - 1);
    // High surrogate at the cut: drop it and its low half whole. The token
    // cannot contain lone surrogates (the delimiter cut above removes them),
    // so a high surrogate here is always one half of a valid pair.
    if (last >= 0xd800 && last <= 0xdbff) end -= 1;
    return token.slice(0, end) + marker;
  }
  return token;
}

/**
 * Narrow `CallToolRequest.params._meta.sessionID` (OpenCode V2 session
 * context, https://opencode.ai/v2/docs/mcp-servers/) from `unknown`:
 * absent-safe — non-object `_meta`, non-string values and values that
 * normalize to empty all yield undefined. The returned value is already
 * normalized (single-line token, HANDOFF_SESSION_CAP bound), so every
 * downstream consumer — handoff `session` and `author`/`comment` `author`
 * alike — inherits the invariant. This is correlation metadata only, never an
 * authentication/authorization signal.
 */
function sessionIDFromMeta(params: Record<string, unknown>): string | undefined {
  const meta: unknown = params._meta;
  if (typeof meta !== "object" || meta === null) return undefined;
  const value: unknown = (meta as Record<string, unknown>).sessionID;
  if (typeof value !== "string") return undefined;
  return normalizeSessionID(value);
}

/**
 * Precedence for the attributed defaults: an explicit non-empty tool argument
 * always wins; empty/whitespace-only arguments count as absent — matching how
 * the comment/handoff kernels treat them — and fall back to `_meta.sessionID`
 * (already normalized/capped by sessionIDFromMeta).
 */
function explicitOrMeta(
  explicit: string | undefined,
  metaDefault: string | undefined,
): string | undefined {
  return explicit !== undefined && explicit.trim() !== "" ? explicit : metaDefault;
}
