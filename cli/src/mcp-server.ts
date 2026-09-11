import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { readConventionVersion } from "./convention.js";
import { failEnvelope, successEnvelope } from "./json.js";
import { ITEM_TYPES } from "./ids.js";
import { runCreate } from "./create.js";
import { runList } from "./list.js";
import { runUpdate } from "./update.js";
import { STATUSES } from "./status.js";
import { toContractWorkItem } from "./contract.js";

/**
 * Stdio MCP server exposing the shared kernel (list/create/update) as MCP
 * tools. No new schema logic: tool handlers call the same run* functions as
 * the CLI and return the documented `--json` envelope objects as tool text.
 * Agent playbook rules are enforced by passing `agent: true` to runUpdate —
 * the MCP layer cannot reopen done/cancelled items or steal claims.
 */

const SUPPORTED_PROTOCOL_VERSIONS = ["2024-11-05", "2025-03-26", "2025-06-18"] as const;
const DEFAULT_PROTOCOL_VERSION = "2025-06-18";

const SERVER_INFO = { name: "arggon", version: "0.0.0" } as const;

const LIST_FAILED = "LIST_FAILED";
const CREATE_FAILED = "CREATE_FAILED";
const UPDATE_FAILED = "UPDATE_FAILED";

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
      "List work items under tasks/ with optional filters. Returns the arggon `list --json` envelope: {ok, schemaVersion, conventionVersion, command, items}.",
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
        filter: {
          type: "string",
          description: 'compact filter expression, e.g. "status:todo !label:security"',
        },
        view: {
          type: "string",
          description: "saved view name from tasks/.convention.yml x-views",
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
        parent: { type: "string", description: "parent container id (required for non-initiatives)" },
        id: { type: "string", description: "optional explicit id stem (leaves get task-/bug- prefix)" },
        assignee: { type: "string", description: "optional assignee login" },
        status: {
          type: "string",
          enum: ["todo", "in_progress", "blocked", "cancelled"],
          description: "initial status (todo ↛ done: claim first)",
        },
        blocked_reason: {
          type: "string",
          description: "required when status is blocked",
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
        unassign: { type: "boolean", description: "clear assignee", default: false },
        labels: { type: "string", description: "replace the full labels list (comma-separated)" },
        blocked_reason: {
          type: "string",
          description: "required when status is blocked; forbidden otherwise",
        },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
];

/** One MCP server session bound to fixed streams and a fixed repo root. */
export type McpServerOptions = {
  /** Repo root (parent of tasks/); all tool calls run against this tree. */
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

  const respondError = (
    id: string | number | null,
    code: number,
    message: string,
  ): void => {
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
      const code =
        command === "list" ? LIST_FAILED : command === "create" ? CREATE_FAILED : UPDATE_FAILED;
      envelope = failEnvelope({ command, message, code, conventionVersion: conventionVersion() });
      return { content: [{ type: "text", text: JSON.stringify(envelope) }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(envelope) }] };
  };

  const conventionVersion = (): number => readConventionVersion(opts.cwd);

  const callTool = (params: Record<string, unknown>): Record<string, unknown> => {
    const name = params.name;
    const args = (params.arguments ?? {}) as Record<string, unknown>;
    if (name === "arggon_list") {
      return toolEnvelope("arggon_list", () => {
        const result = runList({
          cwd: opts.cwd,
          status: str(args.status),
          type: str(args.type),
          assignee: str(args.assignee),
          filter: str(args.filter),
          view: str(args.view),
        });
        return successEnvelope(
          "list",
          { items: result.items.map((item) => toContractWorkItem(item, result.root)) },
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
          status: str(args.status),
          blockedReason: str(args.blocked_reason),
        });
        return successEnvelope(
          "create",
          { item: toContractWorkItem(result.item, result.root) },
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
          unassign: args.unassign === true,
          labels: str(args.labels),
          blockedReason: str(args.blocked_reason),
          agent: true,
        });
        return successEnvelope(
          "update",
          { item: toContractWorkItem(result.item, result.root), autoCompleted: result.autoCompleted },
          conventionVersion(),
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
