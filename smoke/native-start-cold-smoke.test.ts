import { mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  claimCommitFaults,
  codemodeCommentScript,
  executeCallFaults,
  installDrift,
  installFingerprint,
  isInside,
  moveLegFaults,
  type MoveLegObservation,
  NATIVE_RECEIPT_LIMITS,
  receiptOverBudget,
  servePassword,
  servePort,
  serveRegisteredTools,
  startScriptedProvider,
  type ScriptedRound,
} from "./native-start-cold-smoke.js";

// Unit tests for the harness's pure predicates — the same split as
// smoke/tui-board-smoke.test.ts: the cold-start run itself needs git, a
// disposable fixture and a real pre-commit gate (it is driven by
// `npm run smoke:native-start-cold`), while what decides each check is the
// logic pinned here. An empty array means "the observation held".

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A temp checkout whose `node_modules` carries the named entries. */
function installFixture(entries: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-cold-smoke-unit-"));
  tmpDirs.push(dir);
  mkdirSync(join(dir, "node_modules"));
  for (const entry of entries) {
    const path = join(dir, "node_modules", entry);
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, "package.json"), `{ "name": "${entry}" }\n`, "utf8");
  }
  return dir;
}

describe("native-start-cold-smoke: isInside", () => {
  it("accepts the root itself and anything under it", () => {
    expect(isInside("/a/repo", "/a/repo")).toBe(true);
    expect(isInside("/a/repo", "/a/repo/lib/dist/index.js")).toBe(true);
    expect(isInside("/a/repo/", "/a/repo/node_modules")).toBe(true);
  });

  it("rejects a sibling, a parent and a same-prefixed sibling directory", () => {
    // The trap the runtime check exists for: `/a/repo-primary` must not read as
    // inside `/a/repo`, which is how a stale primary build would sneak in.
    expect(isInside("/a/repo", "/a/repo-primary/lib/dist/index.js")).toBe(false);
    expect(isInside("/a/repo", "/a/repo-other")).toBe(false);
    expect(isInside("/a/repo/lib", "/a/repo")).toBe(false);
  });

  it("resolves relative paths before comparing", () => {
    expect(isInside("smoke", "smoke/native-start-cold-smoke.ts")).toBe(true);
  });
});

describe("native-start-cold-smoke: installFingerprint / installDrift", () => {
  it("reports no drift for an untouched install", () => {
    const dir = installFixture(["native-gate-dep", "commander"]);
    expect(installDrift(installFingerprint(dir), installFingerprint(dir))).toEqual([]);
  });

  it("reports the emptied-install signature (count, entry set and clock)", () => {
    const before = installFingerprint(installFixture(["native-gate-dep", "commander"]));
    rmSync(join(before.path, "commander"), { recursive: true, force: true });
    // Pin the directory clock before comparing. Whether the kernel re-stamps a
    // directory mtime on an unlink depends on the tick the removal landed in, so
    // leaving it to chance made this assertion machine-speed dependent (it
    // passed locally and failed on the CI runner). The count and the entry-set
    // digest are the load-bearing "was it emptied?" signals; the mtime adds the
    // reification case where the same names come back re-linked.
    const pinned = new Date(1_000_000_000_000);
    utimesSync(before.path, pinned, pinned);
    const after = installFingerprint(before.path.replace(/\/node_modules$/, ""));
    expect(installDrift(before, after)).toEqual([
      "entry count 2 -> 1",
      expect.stringContaining("entry set changed"),
      `mtime ${before.mtimeMs} -> ${pinned.getTime()}`,
    ]);
  });

  it("reports a reified install (same entries, new mtime) as drift", () => {
    const dir = installFixture(["native-gate-dep"]);
    const before = installFingerprint(dir);
    const later = new Date(before.mtimeMs + 60_000);
    utimesSync(join(dir, "node_modules"), later, later);
    const after = installFingerprint(dir);
    // The expected string reads the clock back instead of reusing the value
    // handed to utimesSync: a filesystem that stores sub-second precision can
    // hand back a fractionally different mtime than the one set (observed on the
    // CI runner, which stored 431.999 where the test asked for 432).
    expect(installDrift(before, after)).toEqual([`mtime ${before.mtimeMs} -> ${after.mtimeMs}`]);
    expect(after.mtimeMs).toBeGreaterThanOrEqual(before.mtimeMs + 59_000);
  });

  it("compares by content, and never by clock, across two different installs", () => {
    const one = installFixture(["native-gate-dep"]);
    const other = installFixture(["native-gate-dep"]);
    const [a, b] = [installFingerprint(one), installFingerprint(other)];
    expect(a.names).toBe(b.names);
    // An mtime belongs to one directory: two identical installs created moments
    // apart are not drift, however far apart their clocks read.
    expect(installDrift(a, b)).toEqual([]);
    mkdirSync(join(other, "node_modules", "commander"), { recursive: true });
    expect(installDrift(a, installFingerprint(other))).toEqual([
      "entry count 1 -> 2",
      expect.stringContaining("entry set changed"),
    ]);
  });

  it("fingerprints the directory, not the whole tree", () => {
    const dir = installFixture(["native-gate-dep"]);
    writeFileSync(join(dir, "node_modules", "native-gate-dep", "index.js"), "x\n", "utf8");
    const before = installFingerprint(dir);
    writeFileSync(join(dir, "node_modules", "native-gate-dep", "index.js"), "y\n", "utf8");
    // A file's content change inside a package is npm's business, not a start
    // decision; the smoke asserts install SHAPE, and says so.
    expect(installDrift(before, installFingerprint(dir))).toEqual([]);
    expect(readdirSync(before.path).sort()).toEqual(["native-gate-dep"]);
  });
});

describe("native-start-cold-smoke: claimCommitFaults", () => {
  const item = "ArggonManager/native-start/worktree/cold-start/task-cold-start-smoke.md";

  it("accepts a claim commit with exactly the item file", () => {
    expect(claimCommitFaults([item], item)).toEqual([]);
  });

  it("names every non-item path the claim commit swept in", () => {
    expect(claimCommitFaults([item, "node_modules", ".native-gate-ran"], item)).toEqual([
      "stages 2 non-item path(s): node_modules, .native-gate-ran",
    ]);
  });

  it("reports a claim commit that never staged the item file", () => {
    expect(claimCommitFaults([], item)).toEqual([`does not stage the item file ${item}`]);
    expect(claimCommitFaults(["a.txt"], item)).toEqual([
      "stages 1 non-item path(s): a.txt",
      `does not stage the item file ${item}`,
    ]);
  });
});

describe("native-start-cold-smoke: receiptOverBudget", () => {
  it("accepts the readiness receipt the native start path returns", () => {
    expect(
      receiptOverBudget({
        ready: true,
        install: "linked",
        linkedNodeModules: true,
        builtWorkspaces: ["@arggondev/lib"],
        linkedWorkspaces: [],
      }),
    ).toEqual([]);
  });

  it("accepts a claim-commit receipt and reports an over-long value", () => {
    expect(receiptOverBudget({ hash: "abc1234", message: "chore(tasks): claimed task-x" })).toEqual(
      [],
    );
    const over = receiptOverBudget({
      skipped: "x".repeat(NATIVE_RECEIPT_LIMITS.maxValueChars + 1),
    });
    expect(over).toEqual([
      `skipped is ${NATIVE_RECEIPT_LIMITS.maxValueChars + 1} chars (max ${NATIVE_RECEIPT_LIMITS.maxValueChars})`,
    ]);
  });

  it("caps the number of reported names and the length of each", () => {
    const names = Array.from({ length: NATIVE_RECEIPT_LIMITS.maxNames + 1 }, (_, i) => `pkg-${i}`);
    expect(receiptOverBudget({ linkedWorkspaces: names })).toEqual([
      `linkedWorkspaces carries ${NATIVE_RECEIPT_LIMITS.maxNames + 1} names (max ${NATIVE_RECEIPT_LIMITS.maxNames})`,
    ]);
    expect(
      receiptOverBudget({ linkedWorkspaces: ["n".repeat(NATIVE_RECEIPT_LIMITS.maxNameChars + 1)] }),
    ).toEqual([
      `linkedWorkspaces[0] is ${NATIVE_RECEIPT_LIMITS.maxNameChars + 1} chars (max ${NATIVE_RECEIPT_LIMITS.maxNameChars})`,
    ]);
  });

  it("caps the whole receipt, so many bounded fields still cannot grow without limit", () => {
    const receipt = {
      linkedWorkspaces: Array.from(
        { length: NATIVE_RECEIPT_LIMITS.maxNames },
        (_, i) => `a-rather-long-workspace-name-${i}`,
      ),
    };
    const over = receiptOverBudget(receipt);
    expect(over).toHaveLength(1);
    expect(over[0]).toContain(`bytes (max ${NATIVE_RECEIPT_LIMITS.maxBytes})`);
  });
});

// ---------------------------------------------------------------------------
// Move leg helpers (task-native-session-move-smoke-leg)
// ---------------------------------------------------------------------------

describe("native-start-cold-smoke: codemodeCommentScript", () => {
  it("inlines the arguments as JSON, so quoting survives any content", () => {
    const script = codemodeCommentScript("task-x", `quote " backslash \\ newline-free`);
    expect(script).toBe(
      `return await tools.arggon.comment({"id":"task-x","text":"quote \\" backslash \\\\ newline-free"});`,
    );
    expect(script).not.toContain("\n");
  });
});

describe("native-start-cold-smoke: serve log parsers", () => {
  it("extracts the password and the printed port from the serve stdout", () => {
    const log = [
      "server listening on http://127.0.0.1:41234",
      "server password in2rsXd9g-TZgNSGfQwWUdh8TEksUbVHdncz3XW3oQY",
    ].join("\n");
    expect(servePassword(log)).toBe("in2rsXd9g-TZgNSGfQwWUdh8TEksUbVHdncz3XW3oQY");
    expect(servePort(log)).toBe(41234);
  });

  it("returns undefined for a log that never became ready", () => {
    expect(servePassword("starting up\n")).toBeUndefined();
    expect(servePort("starting up\n")).toBeUndefined();
    expect(servePort("server listening on http://127.0.0.1:notaport\n")).toBeUndefined();
  });

  it("reads the plugin registration count from the log", () => {
    expect(serveRegisteredTools("[arggon] tools: registered 15 native arggon tools (namespace)")).toBe(15);
    expect(serveRegisteredTools("no registration yet")).toBeUndefined();
  });
});

describe("native-start-cold-smoke: executeCallFaults", () => {
  const code = codemodeCommentScript("task-x", "evidence");

  it("accepts exactly one execute round carrying the script, closed by a text round", () => {
    const rounds: ScriptedRound[] = [
      { call: 1, offers: [], action: { kind: "text" } },
      { call: 2, offers: ["execute"], action: { kind: "tool", name: "execute", arguments: { code } } },
      { call: 3, offers: ["execute"], action: { kind: "text" } },
    ];
    expect(executeCallFaults(rounds, code)).toEqual([]);
  });

  it("reports a missing script, a wrong tool name and a loop that never closed", () => {
    const wrongCode: ScriptedRound[] = [
      { call: 1, offers: ["execute"], action: { kind: "tool", name: "execute", arguments: { code: "other" } } },
      { call: 2, offers: ["execute"], action: { kind: "text" } },
    ];
    expect(executeCallFaults(wrongCode, code)).toEqual([
      "the execute round did not carry the expected Code Mode script",
    ]);
    const wrongName: ScriptedRound[] = [
      { call: 1, offers: ["shell"], action: { kind: "tool", name: "shell", arguments: {} } },
      { call: 2, offers: ["shell"], action: { kind: "text" } },
    ];
    expect(executeCallFaults(wrongName, code)).toContain("tool round called shell, expected execute");
    // A tool round with no closing text round: the agent loop never closed.
    expect(executeCallFaults([
      { call: 1, offers: ["execute"], action: { kind: "tool", name: "execute", arguments: { code } } },
    ], code)).toContain("no final text round: the agent loop never closed");
    expect(executeCallFaults([{ call: 1, offers: ["execute"], action: { kind: "text" } }], code)).toContain(
      "expected exactly 1 tool round, observed 0",
    );
  });
});

describe("native-start-cold-smoke: moveLegFaults", () => {
  const good: MoveLegObservation = {
    branch: "feat/task-x",
    worktreeSubjects: ["chore(tasks): commented task-x", "chore: fixture"],
    commitPaths: ["ArggonManager/a/b/task-x.md"],
    commitText: "## Notes\n\nmove-leg scripted evidence\n",
    gateMarker: "move gate ran in /tmp/wt",
    primaryHeadBefore: "aaa",
    primaryHeadAfter: "aaa",
    primaryPorcelainBefore: "",
    primaryPorcelainAfter: "",
    primarySubjects: ["chore: fixture"],
    worktreePath: "/tmp/wt",
    expectedBranch: "feat/task-x",
    expectedSubject: "chore(tasks): commented task-x",
    expectedItemPath: "ArggonManager/a/b/task-x.md",
    expectedText: "move-leg scripted evidence",
  };

  it("accepts the invariant holding: worktree commit, gate in the worktree, primary untouched", () => {
    expect(moveLegFaults(good)).toEqual([]);
  });

  it("reports the P1 signature: the comment commit landing on the primary's branch", () => {
    expect(
      moveLegFaults({ ...good, primarySubjects: ["chore(tasks): commented task-x", "chore: fixture"] }),
    ).toEqual(["the P1 signature: the comment commit landed on the primary's branch"]);
  });

  it("reports a moved primary, a dirty primary and a wrong branch/paths/missing gate", () => {
    expect(moveLegFaults({ ...good, primaryHeadAfter: "bbb" })).toEqual([
      "primary HEAD moved: aaa -> bbb",
    ]);
    expect(moveLegFaults({ ...good, primaryPorcelainAfter: "?? x\n" })).toHaveLength(1);
    expect(moveLegFaults({ ...good, branch: "main" })[0]).toContain("worktree is on main");
    expect(moveLegFaults({ ...good, commitPaths: ["a.txt", "b.txt"] })[0]).toContain(
      "expected only ArggonManager/a/b/task-x.md",
    );
    expect(moveLegFaults({ ...good, gateMarker: "move gate ran in /tmp/other" })[0]).toContain(
      "expected the hook to run in the worktree",
    );
    expect(moveLegFaults({ ...good, commitText: "unrelated" })[0]).toContain(
      "does not carry the scripted comment",
    );
    expect(moveLegFaults({ ...good, worktreeSubjects: ["chore: fixture"] })[0]).toContain(
      'no "chore(tasks): commented task-x" commit',
    );
  });
});

describe("native-start-cold-smoke: startScriptedProvider", () => {
  it("answers a tools-offered round with one execute tool call and closes on the tool result", async () => {
    const provider = await startScriptedProvider({ id: "task-x", text: "evidence" });
    try {
      const post = (body: unknown): Promise<string> =>
        fetch(`http://127.0.0.1:${provider.port}/v1/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }).then((response) => response.text());

      const toolRound = await post({
        model: "cold-move-model",
        stream: true,
        tools: [{ type: "function", function: { name: "execute" } }],
        messages: [{ role: "user", content: "go" }],
      });
      expect(toolRound).toContain("chat.completion.chunk");
      expect(toolRound).toContain('"finish_reason":"tool_calls"');
      expect(toolRound).toContain("data: [DONE]");
      // Parse the SSE stream and assert on the actual tool call the host would
      // execute — the script rides double-JSON-encoded in the raw bytes.
      const toolCalls = toolRound
        .split("\n")
        .filter((line) => line.startsWith("data: ") && !line.includes("[DONE]"))
        .map((line) => JSON.parse(line.slice("data: ".length)) as {
          choices?: Array<{ delta?: { tool_calls?: Array<{ function?: { name?: string; arguments?: string } }> } }>;
        })
        .flatMap((chunk) => chunk.choices?.[0]?.delta?.tool_calls ?? []);
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0]?.function?.name).toBe("execute");
      expect(JSON.parse(toolCalls[0]?.function?.arguments ?? "{}")).toEqual({
        code: codemodeCommentScript("task-x", "evidence"),
      });

      const finalRound = await post({
        model: "cold-move-model",
        stream: true,
        tools: [{ type: "function", function: { name: "execute" } }],
        messages: [
          { role: "user", content: "go" },
          { role: "tool", content: "ok" },
        ],
      });
      expect(finalRound).toContain('"finish_reason":"stop"');
      expect(finalRound).toContain("scripted done");

      const rounds = provider.rounds();
      expect(rounds).toHaveLength(2);
      expect(rounds[0]?.action.kind).toBe("tool");
      expect(rounds[1]?.action.kind).toBe("text");
      expect(executeCallFaults(rounds, codemodeCommentScript("task-x", "evidence"))).toEqual([]);
    } finally {
      await provider.close();
    }
  });
});
