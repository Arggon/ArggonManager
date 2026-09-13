/**
 * CLI claim-steal gate (bug-cli-steal-not-gated).
 *
 * The human-only steal guarantee is enforced at the CLI entry point, BEFORE
 * runUpdate: a steal can only happen in an interactive terminal of a repo
 * that explicitly allows it. Two gates, both required:
 *
 * 1. Repo opt-in — `x-tracker.allow-steal: true` in tasks/.convention.yml.
 *    Absent/false refuses with an actionable message telling the human how
 *    to arm it.
 * 2. Interactive confirmation — stdin must be a TTY (the human's terminal).
 *    Agents, scripts, and CI have non-TTY stdin and are refused even when
 *    the repo is armed; there is no --yes override. With a TTY, a y/N
 *    confirmation prompt guards the takeover.
 *
 * The kernel (runUpdate) keeps its existing steal semantics — including the
 * caller-agent refusal shared with MCP (rules.ts) — so kernel-level tests and
 * the MCP layer are unchanged by this gate.
 */
import { readConventionConfig } from "./convention.js";
import { findTasksDir, repoRootFromTasks } from "./paths.js";
import { tryLoadItem, walkTasksTree } from "./items.js";

/** Refusal when the repo has not armed claim-steal (the default). */
export const STEAL_DISABLED_MESSAGE =
  "steal is disabled in this repo (x-tracker.allow-steal: true in tasks/.convention.yml arms it)";

/** Refusal when stdin is not the human's interactive terminal. */
export const STEAL_NON_TTY_MESSAGE =
  "--steal requires an interactive terminal (agents must not steal claims — docs/agents.md)";

/** Refusal when the interactive confirmation is declined or unrecognized. */
export const STEAL_DECLINED_MESSAGE = "--steal aborted (confirmation declined)";

export type StealGateOptions = {
  /** Working directory of the CLI invocation (repo root or below). */
  cwd: string;
  /** Item id being stolen. */
  id: string;
  /** Stdin to classify/prompt on; defaults to process.stdin. */
  input?: NodeJS.ReadableStream;
  /** TTY override for tests; defaults to the input stream's isTTY flag. */
  isTTY?: boolean;
  /** Prompt output; defaults to process.stderr. */
  output?: NodeJS.WriteStream;
};

/**
 * Enforce the CLI steal gates. Throws the actionable refusal message when a
 * gate fails; resolves when the human confirmed with y/yes at an interactive
 * terminal of an armed repo. Called from the `update` action before runUpdate.
 */
export async function gateSteal(opts: StealGateOptions): Promise<void> {
  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);
  const armed = readConventionConfig(root).tracker.allowSteal === true;
  if (!armed) throw new Error(STEAL_DISABLED_MESSAGE);

  const input = opts.input ?? process.stdin;
  const isTTY = opts.isTTY ?? (input as unknown as { isTTY?: boolean }).isTTY === true;
  if (!isTTY) throw new Error(STEAL_NON_TTY_MESSAGE);

  // Current assignee for the confirmation prompt. An unknown or unclaimed
  // item skips the prompt — runUpdate produces its own specific error.
  const current = findClaimedAssignee(tasksDir, opts.id);
  if (current === null) return;

  const output = opts.output ?? process.stderr;
  output.write(`Steal '${opts.id}' from '${current}'? [y/N] `);
  const answer = await readLine(input);
  if (!/^y(es)?$/i.test(answer)) throw new Error(STEAL_DECLINED_MESSAGE);
}

/** Resolve the current assignee of a claimed item, or null when unclaimed/unknown. */
function findClaimedAssignee(tasksDir: string, id: string): string | null {
  for (const file of walkTasksTree(tasksDir).files) {
    const item = tryLoadItem(file);
    if (item && item.id === id) return item.assignee ?? null;
  }
  return null;
}

/** Read one line from the input stream (resolved on the first newline or EOF). */
function readLine(input: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve) => {
    let buf = "";
    const ondata = (chunk: Buffer | string): void => {
      buf += chunk.toString();
      if (buf.includes("\n")) {
        input.off("data", ondata);
        resolve(buf.slice(0, buf.indexOf("\n")).trim());
      }
    };
    input.on("data", ondata);
    input.on("end", () => resolve(buf.trim()));
  });
}
