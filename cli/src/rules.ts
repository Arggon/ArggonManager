import type { ItemType } from "./ids.js";
import { canTransition, isClaimed, TRANSITIONS, type Status } from "./status.js";

/**
 * Playbook rules (docs/agents.md) that must hold no matter how a caller
 * reaches the kernel. Both the CLI and the MCP server funnel updates through
 * assertUpdateRules, so agent restrictions are encoded exactly once.
 */
export type CallerKind = "human" | "agent";

export type UpdateIntent = {
  id: string;
  type: ItemType;
  currentStatus: Status;
  /** Current assignee (claim-steal guard); null when unassigned. */
  currentAssignee?: string | null;
  requestedStatus?: Status;
  requestedAssignee?: string;
  /** Request to steal an existing claim (CLI --force). */
  force?: boolean;
};

/**
 * Validate one update against the transition table and the playbook rules.
 * Human callers keep the full CLI semantics (--force steal, manual reopen);
 * agent callers (the MCP layer) can do neither.
 */
export function assertUpdateRules(intent: UpdateIntent, caller: CallerKind): void {
  if (caller === "agent" && intent.force) {
    throw new Error(
      "agents must not steal a claim; --force is a human-only escape hatch (docs/agents.md)",
    );
  }

  if (
    intent.requestedStatus !== undefined &&
    intent.requestedStatus !== intent.currentStatus &&
    !canTransition(intent.currentStatus, intent.requestedStatus)
  ) {
    const allowed = TRANSITIONS[intent.currentStatus];
    throw new Error(
      `cannot transition status ${intent.currentStatus} -> ${intent.requestedStatus} (allowed: ${allowed.join(", ")})`,
    );
  }

  if (
    caller === "agent" &&
    intent.requestedStatus === "todo" &&
    (intent.currentStatus === "done" || intent.currentStatus === "cancelled")
  ) {
    throw new Error(
      `agents must not reopen ${intent.currentStatus} items (docs/agents.md); ask a human to reopen '${intent.id}'`,
    );
  }

  // Claim steal guard: refuse reassignment unless --force (docs/claim.md).
  if (
    isClaimed(intent.type, intent.currentStatus, intent.currentAssignee) &&
    intent.requestedAssignee !== undefined &&
    intent.requestedAssignee !== intent.currentAssignee &&
    !intent.force
  ) {
    throw new Error(
      `claim conflict: '${intent.id}' is claimed by '${intent.currentAssignee}' (status in_progress). ` +
        `Unclaim first (\`arggon update ${intent.id} --status todo\`), coordinate, or pass --force.`,
    );
  }
}
