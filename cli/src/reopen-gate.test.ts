/**
 * CLI reopen gate tests (bug-reopen-ungated-cli).
 *
 * Reopening a done/cancelled item to todo is a legal transition (humans
 * reopen legitimately), but the CLI has no caller identity — so, like the
 * steal gate, reopen requires an interactive terminal with a y/N
 * confirmation. Piped stdin (agents, scripts, CI) is refused even when the
 * piped input is "y"; there is no --yes override and no config opt-in. The
 * kernel (runUpdate) keeps its own semantics, and the MCP layer stays
 * rules-refused via rules.ts (mcp-server.test.ts).
 */
import { spawnSync } from "node:child_process";
import { PassThrough } from "node:stream";
import { mkdtempSync as _mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { runCreate } from "./create.js";
import { runInit } from "./init.js";
import { findItemStatus, gateReopen, REOPEN_DECLINED_MESSAGE, REOPEN_NON_TTY_MESSAGE } from "./steal-gate.js";
import { runUpdate } from "./update.js";

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string, options?: { encoding?: "utf8" }): string {
  const dir = _mkdtempSync(prefix, options);
  tmpDirs.push(dir);
  return dir;
}

const NOW = new Date("2026-09-13T12:00:00Z");
const LATER = new Date("2026-09-13T13:00:00Z");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = resolve(root, "cli/src/cli.ts");
const tsx = resolve(root, "node_modules/tsx/dist/cli.mjs");

function primedTree(): { dir: string; id: string } {
  const dir = mkdtempSync(join(tmpdir(), "arggon-reopen-gate-"));
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch", id: "launch", now: NOW });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch", id: "auth", now: NOW });
  runCreate({
    cwd: dir,
    type: "story",
    title: "Login",
    parent: "auth",
    id: "story-login",
    now: NOW,
  });
  const task = runCreate({
    cwd: dir,
    type: "task",
    title: "Rate limit",
    parent: "story-login",
    id: "rate-limit",
    now: NOW,
  });
  runUpdate({ cwd: dir, id: task.id, status: "in_progress", assignee: "alice", now: NOW });
  runUpdate({ cwd: dir, id: task.id, status: "done", now: NOW });
  return { dir, id: task.id };
}

/** Fake interactive stdin: isTTY = true carrying the given answer. */
function ttyInput(answer: string): PassThrough {
  const input = new PassThrough();
  (input as unknown as { isTTY: boolean }).isTTY = true;
  input.end(answer);
  return input;
}

function capture(): { lines: string[]; stream: NodeJS.WriteStream } {
  const lines: string[] = [];
  const stream = {
    write: (chunk: string | Uint8Array) => {
      lines.push(chunk.toString());
      return true;
    },
  } as unknown as NodeJS.WriteStream;
  return { lines, stream };
}

describe("gateReopen (CLI update action, before runUpdate)", () => {
  it("refuses non-TTY stdin — piped 'y' does not count", async () => {
    const input = ttyInput("y\n");
    (input as unknown as { isTTY: boolean }).isTTY = false;
    await expect(
      gateReopen({ id: "rate-limit", from: "done", to: "todo", input }),
    ).rejects.toThrow(REOPEN_NON_TTY_MESSAGE);
  });

  it("prompts and accepts y/yes (case-insensitive) on a TTY", async () => {
    for (const answer of ["y\n", "Y\n", "yes\n", "YES\n"]) {
      const { lines, stream } = capture();
      await gateReopen({ id: "rate-limit", from: "done", to: "todo", input: ttyInput(answer), output: stream });
      expect(lines).toEqual(["Reopen 'rate-limit' (from done)? [y/N] "]);
    }
  });

  it("refuses a declined or unrecognized confirmation", async () => {
    for (const answer of ["n\n", "\n", "ok\n"]) {
      const { stream } = capture();
      await expect(
        gateReopen({ id: "rate-limit", from: "cancelled", to: "todo", input: ttyInput(answer), output: stream }),
      ).rejects.toThrow(REOPEN_DECLINED_MESSAGE);
    }
  });
});

describe("findItemStatus", () => {
  it("resolves the current status and returns null for unknown ids", () => {
    const { dir, id } = primedTree();
    expect(findItemStatus(dir, id)).toBe("done");
    expect(findItemStatus(dir, "task-nope")).toBeNull();
  });
});

describe("reopen gate through the CLI subprocess (piped stdin is never interactive)", () => {
  function runCli(args: string[], cwd: string, input?: string) {
    return spawnSync(process.execPath, [tsx, cli, ...args], {
      encoding: "utf8",
      cwd,
      input: input ?? "",
    });
  }

  it("refuses --status todo on a done item with the exact message", () => {
    const { dir, id } = primedTree();
    const r = runCli(["update", id, "--status", "todo", "--json"], dir);
    expect(r.status).toBe(1);
    expect(JSON.parse(r.stdout)).toMatchObject({
      ok: false,
      command: "update",
      error: { message: REOPEN_NON_TTY_MESSAGE, code: "UPDATE_FAILED" },
    });
    expect(findItemStatus(dir, id)).toBe("done");
  });

  it("refuses even when 'y' is piped in (no non-interactive override)", () => {
    const { dir, id } = primedTree();
    const r = runCli(["update", id, "--status", "todo", "--json"], dir, "y\n");
    expect(r.status).toBe(1);
    expect(JSON.parse(r.stdout)).toMatchObject({
      ok: false,
      error: { message: REOPEN_NON_TTY_MESSAGE },
    });
  });

  it("refuses a cancelled item too", () => {
    const { dir, id } = primedTree();
    runUpdate({ cwd: dir, id, status: "todo", now: LATER });
    runUpdate({ cwd: dir, id, status: "cancelled", now: LATER });
    const r = runCli(["update", id, "--status", "todo", "--json"], dir);
    expect(r.status).toBe(1);
    expect(JSON.parse(r.stdout)).toMatchObject({
      ok: false,
      error: { message: REOPEN_NON_TTY_MESSAGE },
    });
  });

  it("does not gate other transitions or todo->todo no-ops", () => {
    const { dir, id } = primedTree();
    const r = runCli(["update", id, "--status", "todo", "--json"], dir, "");
    expect(r.status).toBe(1); // gated (done -> todo)
    const other = runCli(["update", id, "--title", "Renamed", "--json"], dir);
    expect(other.status).toBe(0);
    expect(JSON.parse(other.stdout)).toMatchObject({ ok: true });
  });

  it("refuses in the human (non-json) output mode too", () => {
    const { dir, id } = primedTree();
    const r = runCli(["update", id, "--status", "todo"], dir);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(REOPEN_NON_TTY_MESSAGE);
  });
});

describe("kernel reopen contract is unchanged by the CLI gate", () => {
  it("runUpdate still reopens done -> todo when called directly (humans keep the ability)", () => {
    const { dir, id } = primedTree();
    const result = runUpdate({ cwd: dir, id, status: "todo", now: LATER });
    expect(result.item.status).toBe("todo");
  });

  it("runUpdate with agent: true is still refused (shared with MCP, rules.ts unchanged)", () => {
    const { dir, id } = primedTree();
    expect(() =>
      runUpdate({ cwd: dir, id, status: "todo", agent: true, now: LATER }),
    ).toThrow(/agents must not reopen done items/);
  });
});
