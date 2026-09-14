/**
 * CLI claim-steal gate tests (bug-cli-steal-not-gated).
 *
 * A steal can only happen in an interactive terminal of a repo that
 * explicitly allows it: `x-tracker.allow-steal: true` in
 * tasks/.convention.yml, then a y/N confirmation over a TTY stdin. Piped
 * stdin (agents, scripts, CI) is refused even when the repo is armed and the
 * piped input is "y" — there is no non-interactive override. The kernel
 * (runUpdate) keeps its own steal semantics; the MCP layer stays
 * schema-hidden + rules-refused (mcp-server.test.ts).
 */
import { spawnSync } from "node:child_process";
import { PassThrough } from "node:stream";
import { mkdtempSync as _mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { parseConventionConfig } from "./convention.js";
import { runCreate } from "./create.js";
import { runInit } from "./init.js";
import {
  gateSteal,
  STEAL_DECLINED_MESSAGE,
  STEAL_DISABLED_MESSAGE,
  STEAL_NON_TTY_MESSAGE,
} from "./steal-gate.js";
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
  const dir = mkdtempSync(join(tmpdir(), "arggon-steal-gate-"));
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
  return { dir, id: task.id };
}

function arm(dir: string): void {
  const path = join(dir, "tasks/.convention.yml");
  writeFileSync(path, `${readFileSync(path, "utf8")}\nx-tracker:\n  allow-steal: true\n`, "utf8");
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

describe("x-tracker.allow-steal parsing", () => {
  it("defaults to null (not armed) when absent", () => {
    expect(parseConventionConfig("version: 3\n").tracker.allowSteal).toBeNull();
    expect(parseConventionConfig("version: 3\nx-tracker:\n  auto-commit: false\n").tracker.allowSteal)
      .toBeNull();
  });

  it("parses an explicit true/false", () => {
    expect(parseConventionConfig("x-tracker:\n  allow-steal: true\n").tracker.allowSteal).toBe(true);
    expect(parseConventionConfig("x-tracker:\n  allow-steal: false\n").tracker.allowSteal).toBe(false);
  });

  it("throws a parse error on invalid values (like auto-commit)", () => {
    expect(() => parseConventionConfig("x-tracker:\n  allow-steal: maybe\n")).toThrow(
      /'allow-steal' must be a boolean/,
    );
  });
});

describe("gateSteal (CLI update action, before runUpdate)", () => {
  it("refuses when the repo has not armed steal (default)", async () => {
    const { dir, id } = primedTree();
    await expect(gateSteal({ cwd: dir, id })).rejects.toThrow(STEAL_DISABLED_MESSAGE);
  });

  it("refuses non-TTY stdin even when armed — piped 'y' does not count", async () => {
    const { dir, id } = primedTree();
    arm(dir);
    const input = ttyInput("y\n");
    (input as unknown as { isTTY: boolean }).isTTY = false;
    await expect(gateSteal({ cwd: dir, id, input })).rejects.toThrow(STEAL_NON_TTY_MESSAGE);
  });

  it("prompts and accepts y/yes (case-insensitive) on a TTY", async () => {
    for (const answer of ["y\n", "Y\n", "yes\n", "YES\n"]) {
      const { dir, id } = primedTree();
      arm(dir);
      const { lines, stream } = capture();
      await gateSteal({ cwd: dir, id, input: ttyInput(answer), output: stream });
      expect(lines).toEqual([`Steal '${id}' from 'alice'? [y/N] `]);
    }
  });

  it("refuses a declined or unrecognized confirmation", async () => {
    const { dir, id } = primedTree();
    arm(dir);
    for (const answer of ["n\n", "\n", "ok\n"]) {
      const { stream } = capture();
      await expect(gateSteal({ cwd: dir, id, input: ttyInput(answer), output: stream })).rejects.toThrow(
        STEAL_DECLINED_MESSAGE,
      );
    }
  });

  it("skips the prompt for unknown/unclaimed ids (runUpdate reports the specific error)", async () => {
    const { dir } = primedTree();
    arm(dir);
    const { lines, stream } = capture();
    await gateSteal({ cwd: dir, id: "task-nope", input: ttyInput("y\n"), output: stream });
    expect(lines).toEqual([]);
  });
});

describe("steal gate through the CLI subprocess (piped stdin is never interactive)", () => {
  function runCli(args: string[], cwd: string, input?: string) {
    return spawnSync(process.execPath, [tsx, cli, ...args], {
      encoding: "utf8",
      cwd,
      input: input ?? "",
    });
  }

  it("refuses --steal with the arm message when not armed", () => {
    const { dir, id } = primedTree();
    const r = runCli(["update", id, "--steal", "--reason", "x", "--assignee", "bob", "--json"], dir);
    expect(r.status).toBe(1);
    expect(JSON.parse(r.stdout)).toMatchObject({
      ok: false,
      command: "update",
      error: { message: STEAL_DISABLED_MESSAGE, code: "UPDATE_FAILED" },
    });
  });

  it("refuses --steal on piped stdin even when armed and 'y' is piped in", () => {
    const { dir, id } = primedTree();
    arm(dir);
    const r = runCli(
      ["update", id, "--steal", "--reason", "x", "--assignee", "bob", "--json"],
      dir,
      "y\n",
    );
    expect(r.status).toBe(1);
    expect(JSON.parse(r.stdout)).toMatchObject({
      ok: false,
      command: "update",
      error: { message: STEAL_NON_TTY_MESSAGE, code: "UPDATE_FAILED" },
    });
  });

  it("refuses --steal in the human (non-json) output mode too", () => {
    const { dir, id } = primedTree();
    const r = runCli(["update", id, "--steal", "--reason", "x", "--assignee", "bob"], dir);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(STEAL_DISABLED_MESSAGE);
  });
});

describe("kernel steal contract is unchanged by the CLI gate", () => {
  it("runUpdate with steal still works when called directly", () => {
    const { dir, id } = primedTree();
    const result = runUpdate({
      cwd: dir,
      id,
      steal: true,
      reason: "alice left the team; taking over",
      assignee: "bob",
      now: LATER,
    });
    expect(result.item.assignee).toBe("bob");
  });

  it("runUpdate with steal + agent: true is still refused (shared with MCP)", () => {
    const { dir, id } = primedTree();
    expect(() =>
      runUpdate({
        cwd: dir,
        id,
        steal: true,
        reason: "x",
        assignee: "bob",
        agent: true,
        now: LATER,
      }),
    ).toThrow(/agents must not steal a claim; --steal is a human-only supervised/);
  });
});
