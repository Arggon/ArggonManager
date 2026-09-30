/**
 * Property: status transitions preserve the legal table, and a terminal item
 * cannot be reopened.
 *
 * The kernel under test is `rules.ts` (`assertUpdateRules`) — the single rules
 * seam the CLI and the MCP adapter both funnel updates through, layered on the
 * `status.ts` table. Properties complement the example-based
 * `reopen-gate.test.ts` / `steal-gate.test.ts` / `update.test.ts` suites, which
 * stay authoritative for concrete transitions.
 *
 * INVARIANTS (asserted for every generated action sequence, run twice — once as
 * an `agent`, once as a `human`):
 *
 *   1. SOUNDNESS OF THE SEAM: an accepted status change is always an edge of
 *      the exported table (`canTransition`), and a request for the current
 *      status never moves the item.
 *   2. TERMINAL IS ABSORBING FOR AGENTS: a sequence that starts at
 *      `done`/`cancelled` can never leave that status through the agent path,
 *      whatever the actions are (the only table edge out is the human reopen,
 *      and the agent guard refuses it).
 *   3. A HUMAN REOPEN GOES THROUGH `todo`: the only status a caller can reach
 *      from `done`/`cancelled` is `todo` — never straight back into work.
 *   4. A CALLER THAT FOLLOWS THE CLI CONVENTION CANNOT LAND IN AN INVALID
 *      ITEM: a model that supplies a `blocked_reason` exactly when moving to
 *      `blocked` (and an assignee exactly when claiming, as the CLI does) keeps
 *      every accepted state valid under the production `assertClaimAndBlocked`.
 *   5. THE CLAIM GUARD: while an item is claimed, changing the assignee is
 *      refused for every caller without `force`/`steal`, and an agent is refused
 *      even with them (`--force`/`--steal` are human-only escape hatches).
 *   6. `unclaim` is only valid from `in_progress` and only ever yields
 *      `todo` + no assignee.
 *
 * Plus table-shape invariants that hold over the exported `TRANSITIONS` data
 * itself (no self-loops, no claim-skipping edge, every non-terminal status can
 * still reach a terminal one — an item can always be closed).
 */
import { describe, expect, it } from "vitest";
import { assertUpdateRules, type CallerKind } from "./rules.js";
import {
  assertClaimAndBlocked,
  canTransition,
  CLAIMABLE_TYPES,
  isClaimed,
  STATUSES,
  TRANSITIONS,
  unclaim,
  type Status,
} from "./status.js";
import { ITEM_TYPES, type ItemType } from "./ids.js";
import { fc, checkProperty } from "../../test/property-runner.js";

const TERMINAL: ReadonlySet<Status> = new Set(["done", "cancelled"]);

/** One generated request: any field the update seam accepts. */
const action = fc.record({
  status: fc.option(fc.constantFrom(...STATUSES), { nil: undefined }),
  assignee: fc.option(fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9-]{0,5}$/), { nil: undefined }),
  force: fc.boolean(),
  steal: fc.boolean(),
});

type State = {
  type: ItemType;
  status: Status;
  assignee: string | null;
  blockedReason: string | null;
};

/**
 * A VALID starting item: `blocked_reason` exists exactly with status `blocked`
 * and a claimable item is only `in_progress` when it carries an assignee (the
 * production `assertClaimAndBlocked` rules).
 */
const startState = fc
  .record({
    type: fc.constantFrom(...ITEM_TYPES),
    status: fc.constantFrom(...STATUSES),
    assignee: fc.option(fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9-]{0,5}$/), {
      nil: null,
    }),
    reason: fc.constantFrom("waiting on review", "upstream is down"),
  })
  .map(({ type, status, assignee, reason }): State => ({
    type,
    status,
    assignee:
      status === "in_progress" && CLAIMABLE_TYPES.has(type) && assignee === null
        ? "claimer"
        : assignee,
    blockedReason: status === "blocked" ? reason : null,
  }));

/** The state the CLI's own convention produces for an accepted request. */
function nextState(
  state: State,
  requested: Status | undefined,
  assignee: string | undefined,
): State {
  const status = requested ?? state.status;
  let nextAssignee = assignee === undefined ? state.assignee : assignee;
  let blockedReason = status === "blocked" ? state.blockedReason : null;
  if (status === "blocked" && blockedReason === null) {
    // The CLI requires a reason with --status blocked; a caller that forgets it
    // is rejected by `assertClaimAndBlocked` (a different seam), so the model
    // supplies the minimum the convention allows.
    blockedReason = "blocked by convention";
  }
  if (status === "in_progress" && CLAIMABLE_TYPES.has(state.type) && nextAssignee === null) {
    nextAssignee = "claimer";
  }
  return { type: state.type, status, assignee: nextAssignee, blockedReason };
}

/** Drive one request through the seam; the state moves only when accepted. */
function step(
  state: State,
  request: { status?: Status; assignee?: string; force?: boolean; steal?: boolean },
  caller: CallerKind,
): { state: State; accepted: boolean } {
  try {
    assertUpdateRules(
      {
        id: "task-seq",
        type: state.type,
        currentStatus: state.status,
        currentAssignee: state.assignee,
        requestedStatus: request.status,
        requestedAssignee: request.assignee,
        force: request.force,
        steal: request.steal,
      },
      caller,
    );
  } catch {
    return { state, accepted: false };
  }
  return { state: nextState(state, request.status, request.assignee), accepted: true };
}

describe("status transitions (property)", () => {
  it("keeps every generated transition sequence inside the legal table", () => {
    checkProperty(
      "status transitions",
      fc.property(
        startState,
        fc.array(action, { minLength: 1, maxLength: 6 }),
        fc.constantFrom<CallerKind>("agent", "human"),
        (start, actions, caller) => {
          let state = start;
          for (const request of actions) {
            const before = state;
            const outcome = step(state, request, caller);
            state = outcome.state;

            // (1) An accepted change is always a table edge; a no-op never moves.
            if (
              outcome.accepted &&
              request.status !== undefined &&
              request.status !== before.status
            ) {
              expect(canTransition(before.status, state.status)).toBe(true);
            }
            if (request.status === undefined || request.status === before.status) {
              expect(state.status).toBe(before.status);
            }
            // (2) Terminal is absorbing for the agent path: a sequence that
            // starts terminal can never leave it.
            if (TERMINAL.has(start.status) && caller === "agent") {
              expect(state.status).toBe(start.status);
            }
            // (3) The only way out of a terminal status is through `todo`.
            if (TERMINAL.has(before.status) && state.status !== before.status) {
              expect(state.status).toBe("todo");
            }
            // (4) A caller that follows the CLI convention stays in a valid state.
            expect(() =>
              assertClaimAndBlocked({
                type: state.type,
                status: state.status,
                assignee: state.assignee,
                blockedReason: state.blockedReason,
              }),
            ).not.toThrow();
            // (5) The claim guard holds at every step of the sequence.
            if (
              isClaimed(before.type, before.status, before.assignee) &&
              request.assignee !== undefined &&
              request.assignee !== before.assignee
            ) {
              // Accepted only with a human-only escape hatch: an agent may
              // neither steal with --force nor take over with --steal.
              const escape = request.force === true || request.steal === true;
              expect(outcome.accepted).toBe(caller === "human" && escape);
            }
          }
          // The state is always a member of the status enum.
          expect(STATUSES).toContain(state.status);
        },
      ),
    );
  });

  it("keeps canTransition and the exported table in agreement", () => {
    checkProperty(
      "status table shape",
      fc.property(fc.constantFrom(...STATUSES), fc.constantFrom(...STATUSES), (from, to) => {
        // canTransition IS the table lookup; the edge is the table.
        expect(canTransition(from, to)).toBe(TRANSITIONS[from].includes(to));
        if (canTransition(from, to)) expect(TRANSITIONS[from]).toContain(to);
      }),
    );
  });

  it("has no self-loops, no claim-skipping edge, and never traps an open item", () => {
    for (const status of STATUSES) {
      // No self-loops: a status request equal to the current one is a no-op
      // handled before the table, never an edge.
      expect(TRANSITIONS[status]).not.toContain(status);
    }
    // An unclaimed todo may not jump straight to done (claim first) nor to
    // blocked (nothing is in flight yet).
    expect(TRANSITIONS.todo).not.toContain("done");
    expect(TRANSITIONS.todo).not.toContain("blocked");
    // Terminal items are only reachable from in_progress, and the only way
    // back out is `todo` (the human reopen).
    for (const status of STATUSES) {
      if (status === "in_progress") continue;
      if (TERMINAL.has(status)) {
        expect(TRANSITIONS[status]).toEqual(["todo"]);
        continue;
      }
      expect(TRANSITIONS.in_progress).toContain(status);
    }
    // Liveness: every non-terminal status can still reach a terminal one, so
    // an item can always be closed.
    for (const status of STATUSES) {
      if (TERMINAL.has(status)) continue;
      const seen = new Set<Status>([status]);
      const queue: Status[] = [status];
      let reachesTerminal = false;
      while (queue.length > 0 && !reachesTerminal) {
        const current = queue.shift()!;
        for (const next of TRANSITIONS[current]) {
          if (TERMINAL.has(next)) {
            reachesTerminal = true;
            break;
          }
          if (!seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
      expect(reachesTerminal).toBe(true);
    }
  });

  it("unclaims only from in_progress and only back to todo", () => {
    checkProperty(
      "unclaim",
      fc.property(fc.constantFrom(...STATUSES), fc.boolean(), (status, hasAssignee) => {
        if (status !== "in_progress") {
          expect(() => unclaim(status)).toThrow(/only valid from in_progress/);
          return;
        }
        expect(unclaim(status)).toEqual({ status: "todo", assignee: null });
        // The released state is unclaimed and open again.
        expect(isClaimed("task", "todo", hasAssignee ? "someone" : null)).toBe(false);
      }),
    );
  });
});
