import { createInterface } from "node:readline";
import { relative, sep } from "node:path";
import type { Readable, Writable } from "node:stream";
import { readConventionVersion } from "./convention.js";
import { failEnvelope, successEnvelope } from "./json.js";
import { ITEM_TYPES } from "./ids.js";
import { runCreate } from "./create.js";
import { runComment } from "./comment.js";
import { HANDOFF_SESSION_CAP, runHandoff } from "./handoff.js";
import { runList } from "./list.js";
import { runNext } from "./next.js";
import { runReport } from "./report.js";
import { runShow } from "./show.js";
import { runTrend, type TrendResult } from "./trend.js";
import { maybeCommitUpdate, parseCsvList, runUpdate } from "./update.js";
import { runValidate } from "./validate.js";
import { STATUSES } from "./status.js";
import { toContractWorkItem } from "./contract.js";
import { commitPayload } from "./tracker-commit.js";
import { arggonVersion } from "./docs.js";

/**
 * Stdio MCP server exposing the shared kernel (list/create/update/comment) as
 * MCP tools. No new schema logic: tool handlers call the same run* functions
 * as the CLI and return the documented `--json` envelope objects as tool text.
 * Agent playbook rules are enforced by passing `agent: true` to runUpdate —
 * the MCP layer cannot reopen done/cancelled items or steal claims.
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

const LIST_FAILED = "LIST_FAILED";
const CREATE_FAILED = "CREATE_FAILED";
const UPDATE_FAILED = "UPDATE_FAILED";
const COMMENT_FAILED = "COMMENT_FAILED";
const SHOW_FAILED = "SHOW_FAILED";
const NEXT_FAILED = "NEXT_FAILED";
const REPORT_FAILED = "REPORT_FAILED";
const VALIDATE_FAILED = "VALIDATE_FAILED";

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
];

/** One MCP server session bound to fixed streams and a fixed repo root. */
export type McpServerOptions = {
  /** Repo root (parent of the tracker dir); all tool calls run against this tree. */
  cwd: string;
  input: Readable;
  output: Writable;
  /** Called when the client closes its end (tests use this to finish). */
  onClose?: () => void;
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

  const toolEnvelope = (
    tool: string,
    body: () => Record<string, unknown>,
  ): Record<string, unknown> => {
    const command = tool.replace(/^arggon_/, "");
    let envelope: Record<string, unknown>;
    try {
      envelope = body();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Bodies may pin a specific failure code (e.g. report trend mining
      // throws TREND_FAILED while the command stays "report"); otherwise the
      // code falls back to the per-command default.
      const thrown = err as { code?: unknown };
      const fallback =
        command === "list"
          ? LIST_FAILED
          : command === "create"
            ? CREATE_FAILED
            : command === "comment" || command === "handoff"
              ? COMMENT_FAILED
              : command === "show"
                ? SHOW_FAILED
                : command === "next"
                  ? NEXT_FAILED
                  : command === "report"
                    ? REPORT_FAILED
                    : command === "validate"
                      ? VALIDATE_FAILED
                      : UPDATE_FAILED;
      const code = typeof thrown.code === "string" ? thrown.code : fallback;
      envelope = failEnvelope({ command, message, code, conventionVersion: conventionVersion() });
      return { content: [{ type: "text", text: JSON.stringify(envelope) }], isError: true };
    }
    // Pure reads like validate succeed with ok:false in the envelope when
    // errors were found (the CLI exits 1) — surface that as a tool error.
    return {
      content: [{ type: "text", text: JSON.stringify(envelope) }],
      ...(envelope.ok === false ? { isError: true } : {}),
    };
  };

  const conventionVersion = (): number => readConventionVersion(opts.cwd);

  const callTool = (params: Record<string, unknown>): Record<string, unknown> => {
    const name = params.name;
    const args = (params.arguments ?? {}) as Record<string, unknown>;
    // OpenCode V2 session context (opaque correlation, may be absent); used
    // only as the default attribution below, never for any decision.
    const metaSession = sessionIDFromMeta(params);
    if (name === "arggon_list") {
      return toolEnvelope("arggon_list", () => {
        const result = runList({
          cwd: opts.cwd,
          status: str(args.status),
          type: str(args.type),
          parent: str(args.parent),
          assignee: str(args.assignee),
          filter: str(args.filter),
          view: str(args.view),
          stale: args.stale === true,
          olderThan: str(args.older_than),
        });
        return successEnvelope(
          "list",
          {
            items: result.items.map((item) =>
              toContractWorkItem(item, result.root, { full: args.full === true }),
            ),
          },
          conventionVersion(),
        );
      });
    }
    if (name === "arggon_create") {
      return toolEnvelope("arggon_create", () => {
        const result = runCreate({
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
          // Tracker auto-commit resolves like the CLI (`x-tracker.auto-commit`,
          // default ON) so both entry points stay envelope-identical.
        });
        return successEnvelope(
          "create",
          {
            path: relative(result.root, result.path).split(sep).join("/"),
            item: toContractWorkItem(result.item, result.root, { full: args.full === true }),
            commit: commitPayload(result.commit),
          },
          conventionVersion(),
        );
      });
    }
    if (name === "arggon_update") {
      return toolEnvelope("arggon_update", () => {
        const result = runUpdate({
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
          agent: true,
        });
        // Tracker auto-commit resolves like the CLI (`--no-commit` has no MCP
        // equivalent; `x-tracker.auto-commit` governs) so both entry points
        // stay envelope-identical (task-autocommit-update-import).
        const commit = maybeCommitUpdate(result, undefined);
        return successEnvelope(
          "update",
          {
            item: toContractWorkItem(result.item, result.root, { full: args.full === true }),
            autoCompleted: result.autoCompleted,
            cascadeLevels: result.cascadeLevels,
            cascadeSkipped: result.cascadeSkipped,
            ...(result.movedFrom ? { movedFrom: result.movedFrom } : {}),
            ...(result.renamedFrom ? { renamedFrom: result.renamedFrom } : {}),
            ...(commit ? { commit: commitPayload(commit) } : {}),
          },
          conventionVersion(),
        );
      });
    }
    if (name === "arggon_comment") {
      return toolEnvelope("arggon_comment", () => {
        const result = runComment({
          cwd: opts.cwd,
          id: str(args.id) ?? "",
          text: str(args.text) ?? "",
          // Explicit author wins; otherwise the V2 session ID is the default.
          author: explicitOrMeta(str(args.author), metaSession),
          // Tracker auto-commit resolves like the CLI.
        });
        return successEnvelope(
          "comment",
          {
            id: result.id,
            path: result.path,
            comment: result.comment,
            commit: commitPayload(result.commit),
          },
          conventionVersion(),
        );
      });
    }
    if (name === "arggon_handoff") {
      return toolEnvelope("arggon_handoff", () => {
        const result = runHandoff({
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
        });
        return successEnvelope(
          "handoff",
          {
            id: result.id,
            path: result.path,
            comment: result.comment,
            handoff: result.handoff,
            commit: commitPayload(result.commit),
          },
          conventionVersion(),
        );
      });
    }
    if (name === "arggon_show") {
      return toolEnvelope("arggon_show", () => {
        const result = runShow({
          cwd: opts.cwd,
          id: str(args.id) ?? "",
          meta: args.meta === true,
          body: args.body === true,
          tailComments: typeof args.tail_comments === "number" ? args.tail_comments : undefined,
        });
        return successEnvelope(
          "show",
          {
            item: toContractWorkItem(result.item, result.root),
            path: result.path,
            ...(args.body === true
              ? { body: result.item.body, comments: result.allComments }
              : { comments: result.comments }),
          },
          conventionVersion(),
        );
      });
    }
    if (name === "arggon_next") {
      return toolEnvelope("arggon_next", () => {
        const result = runNext({ cwd: opts.cwd, ready: args.ready === true });
        const suggestion = result.suggestion
          ? {
              item: toContractWorkItem(result.suggestion.item, result.root),
              parentChain: result.suggestion.parentChain,
              reason: result.suggestion.reason,
              blockedBy: result.suggestion.blockedBy,
              unblocks: result.suggestion.unblocks,
            }
          : null;
        return successEnvelope("next", { suggestion }, conventionVersion());
      });
    }
    if (name === "arggon_report") {
      return toolEnvelope("arggon_report", () => {
        if (args.since !== undefined && args.trend !== true) {
          // Same guard and message text as the CLI.
          throw new Error("--since requires --trend");
        }
        let trend: TrendResult | null = null;
        if (args.trend === true) {
          try {
            trend = runTrend({ cwd: opts.cwd, since: str(args.since) });
          } catch (err) {
            throw Object.assign(err instanceof Error ? err : new Error(String(err)), {
              code: "TREND_FAILED",
            });
          }
        }
        const result = runReport({ cwd: opts.cwd });
        const payload: Record<string, unknown> = { groups: result.groups };
        if (trend) payload.trend = trend;
        return successEnvelope("report", payload, conventionVersion());
      });
    }
    if (name === "arggon_validate") {
      return toolEnvelope("arggon_validate", () => {
        const result = runValidate({ cwd: opts.cwd });
        // Same envelope shape as the CLI: the payload carries ok, errors and
        // warnings; with errors present the envelope flips to ok:false and
        // carries the VALIDATE_FAILED error (tool-level isError above).
        return successEnvelope(
          "validate",
          {
            ok: result.errors.length === 0,
            layout: result.layout,
            errors: result.errors,
            warnings: result.warnings,
            ...(result.errors.length > 0
              ? {
                  error: {
                    message: `validate failed with ${result.errors.length} error(s)`,
                    code: VALIDATE_FAILED,
                  },
                }
              : {}),
          },
          result.conventionVersion,
        );
      });
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
