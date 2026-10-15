/**
 * Unit tests + deterministic legs for the per-runtime permissions probe
 * harness (`smoke/opencode-permissions-probe.ts`,
 * bug-task-permissions-enforcement-not-observed).
 *
 * Two halves, mirroring `smoke/opencode-hermetic.test.ts` and
 * `smoke/native-start-cold-smoke.test.ts`:
 *
 *   1. the harness's CLASSIFIERS — what counts as a denial, an allow, a
 *      provider skip — pinned against recorded transcript and envelope shapes,
 *      because a lenient classifier turns an unenforced gate into a green
 *      probe (the exact failure mode this item is about);
 *   2. the DETERMINISTIC legs — the ZCode and Claude hook gates, the vendored
 *      plugin's (empty) permission surface — driven for real, model-free and
 *      offline, so CI exercises the per-runtime table's model-free half.
 *
 * The model-driven V2 legs (a real `opencode run` session, the config-edit
 * continuation, the service-attached continuation) stay in the script: they
 * need the `opencode` binary and provider credentials, and are maintainer-run
 * like `npm run smoke:opencode`.
 *
 * The kernel leg is pinned here through its classifier only: the kernel's
 * refusals are the suite's own subject (`cli/src/done-gate.test.ts`,
 * `cli/src/claim-lease.test.ts`, `cli/src/steal-gate` behavior in
 * `cli/src/update-*.test.ts`), and a second end-to-end copy of them would be
 * a third place to forget. The script drives the leg for the probe table.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ALLOWED_COMMAND,
  classifyGateRun,
  classifyKernelRun,
  classifySessionTranscript,
  DENIED_COMMAND,
  gateLegs,
  gatePrePayload,
  pluginLeg,
  pluginPermissionSurfaceFaults,
  preBlockConfigText,
  providerSkipReason,
  sessionIdOf,
} from "./opencode-permissions-probe.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** One `--format json` transcript line per part, the runtime's own shape. */
function transcript(...parts: Array<Record<string, unknown>>): string {
  return parts.map((part) => JSON.stringify({ type: "tool_use", part })).join("\n");
}

function shellPart(command: string, state: Record<string, unknown>): Record<string, unknown> {
  return { tool: "shell", state: { input: { command }, ...state } };
}

describe("permissions-probe: classifySessionTranscript", () => {
  it("a refused shell call is the only denial evidence", () => {
    const stdout = transcript(
      shellPart(DENIED_COMMAND, { status: "error", error: "Permission denied: shell" }),
    );
    expect(classifySessionTranscript(stdout, DENIED_COMMAND)).toBe("denied");
  });

  it("accepts the legacy shape carrying the message in state.output", () => {
    const stdout = transcript(
      shellPart(DENIED_COMMAND, { status: "error", output: "Permission denied: shell" }),
    );
    expect(classifySessionTranscript(stdout, DENIED_COMMAND)).toBe("denied");
  });

  it("a completed shell call is the allow", () => {
    const stdout = transcript(
      shellPart(ALLOWED_COMMAND, { status: "completed", output: "[main 4c309c6] probe" }),
    );
    expect(classifySessionTranscript(stdout, ALLOWED_COMMAND)).toBe("allowed");
  });

  it("a model that declines on its own is inconclusive, never a pass", () => {
    // The delivery-lead agent prompt refuses `--no-verify` by role contract:
    // no shell call ever happens, so the permission layer was not exercised.
    const stdout = JSON.stringify({
      type: "text",
      part: { type: "text", text: "I'm not going to run that command as written." },
    });
    expect(classifySessionTranscript(stdout, DENIED_COMMAND)).toBe("inconclusive");
  });

  it("never matches on the model's narrative alone", () => {
    const stdout = JSON.stringify({
      type: "text",
      part: { type: "text", text: "the shell tool refused: Permission denied: shell" },
    });
    expect(classifySessionTranscript(stdout, DENIED_COMMAND)).toBe("inconclusive");
  });

  it("ignores a denial for a different command", () => {
    const stdout = transcript(
      shellPart("git status", { status: "error", error: "Permission denied: shell" }),
    );
    expect(classifySessionTranscript(stdout, DENIED_COMMAND)).toBe("inconclusive");
  });

  it("a real (non-permission) shell failure is inconclusive", () => {
    const stdout = transcript(
      shellPart(DENIED_COMMAND, { status: "error", error: "fatal: not a git repository" }),
    );
    expect(classifySessionTranscript(stdout, DENIED_COMMAND)).toBe("inconclusive");
  });
});

describe("permissions-probe: classifyGateRun", () => {
  it("exit 2 with the gate's deny line is a denial", () => {
    expect(
      classifyGateRun(2, "arggon gate: denied — force push (git push --force) is denied\n"),
    ).toBe("denied");
  });

  it("exit 0 with no deny line is an allow", () => {
    expect(classifyGateRun(0, "")).toBe("allowed");
  });

  it("a non-zero exit without the deny line is inconclusive", () => {
    // `gate.mjs` exits 1 for a bad mode and fails OPEN on an unparseable
    // payload; neither is a probe verdict.
    expect(classifyGateRun(1, "arggon gate: mode required (pre | post | stop)")).toBe(
      "inconclusive",
    );
    expect(classifyGateRun(2, "")).toBe("inconclusive");
    expect(classifyGateRun(null, "")).toBe("inconclusive");
  });
});

describe("permissions-probe: classifyKernelRun", () => {
  it("a refusal envelope is the denial", () => {
    const stdout = JSON.stringify({
      ok: false,
      command: "update",
      error: {
        message:
          "--status todo on a done/cancelled item requires an interactive terminal (agents must not reopen — ArggonManager/docs/agents.md)",
        code: "UPDATE_FAILED",
      },
    });
    expect(classifyKernelRun(stdout)).toBe("denied");
  });

  it("the claim-conflict refusal is the denial too", () => {
    const stdout = JSON.stringify({
      ok: false,
      command: "start",
      error: {
        message: "claim conflict: 'task-x' is claimed by 'probe-owner'",
        code: "START_FAILED",
      },
    });
    expect(classifyKernelRun(stdout)).toBe("denied");
  });

  it("an ok envelope is the allow", () => {
    const stdout = JSON.stringify({ ok: true, command: "comment", id: "task-x" });
    expect(classifyKernelRun(stdout)).toBe("allowed");
  });

  it("a non-refusal failure is inconclusive, not a denial", () => {
    const stdout = JSON.stringify({
      ok: false,
      command: "create",
      error: { message: "story requires --parent <epic id>", code: "CREATE_FAILED" },
    });
    expect(classifyKernelRun(stdout)).toBe("inconclusive");
  });

  it("an unparseable envelope is inconclusive", () => {
    expect(classifyKernelRun("not json")).toBe("inconclusive");
    expect(classifyKernelRun("")).toBe("inconclusive");
  });
});

describe("permissions-probe: providerSkipReason", () => {
  it("a provider death is the skip reason (the run never reached the gate)", () => {
    const stdout = JSON.stringify({
      type: "error",
      error: { type: "provider.quota", message: "Go usage limit exceeded" },
    });
    const reason = providerSkipReason(stdout, "");
    expect(reason).toContain("usage limit");
  });

  it("a Model unavailable death is a skip reason too", () => {
    const stdout = JSON.stringify({
      type: "error",
      error: { type: "provider.no-route", message: "Model unavailable" },
    });
    expect(providerSkipReason(stdout, "")).toContain("Model unavailable");
  });

  it("a clean run has no skip reason", () => {
    expect(
      providerSkipReason(
        transcript(
          shellPart(DENIED_COMMAND, { status: "error", error: "Permission denied: shell" }),
        ),
        "",
      ),
    ).toBeUndefined();
    expect(providerSkipReason("", "")).toBeUndefined();
  });

  it("a prose line that only quotes the marker parses as no reason", () => {
    expect(providerSkipReason('{"type":"error"', "")).toBeUndefined();
  });
});

describe("permissions-probe: sessionIdOf", () => {
  it("reads the session id from the first event that carries one", () => {
    const stdout = [
      JSON.stringify({ type: "step_start", sessionID: "ses_probe_1" }),
      JSON.stringify({ type: "text", sessionID: "ses_probe_1", part: { text: "x" } }),
    ].join("\n");
    expect(sessionIdOf(stdout)).toBe("ses_probe_1");
  });

  it("is undefined for prose-only output", () => {
    expect(sessionIdOf("no json here\n")).toBeUndefined();
  });
});

describe("permissions-probe: gatePrePayload", () => {
  it("carries the PreToolUse shape the clients send", () => {
    const payload = gatePrePayload(DENIED_COMMAND, "probe-session", "/tmp/fixture");
    expect(payload).toEqual({
      session_id: "probe-session",
      tool_name: "Bash",
      tool_input: { command: DENIED_COMMAND },
      cwd: "/tmp/fixture",
    });
  });
});

describe("permissions-probe: pluginPermissionSurfaceFaults", () => {
  it("the shipped plugin source declares no permission surface of its own", () => {
    const source = readFileSync(join(root, "opencode", "plugins", "arggon", "index.ts"), "utf8");
    expect(pluginPermissionSurfaceFaults(source)).toEqual([]);
  });

  it("a config hook — the surface that could rewrite the effective rules — is a fault", () => {
    const withConfigHook = `const definition = { id: "arggon", async setup(ctx) { await ctx.session.hook("config", () => ({})) } }`;
    expect(pluginPermissionSurfaceFaults(withConfigHook)).toEqual([
      expect.stringContaining("config hook"),
    ]);
  });

  it("a runtime permission rule — a second logic path — is a fault", () => {
    const withRule = `const rules = [{ action: "shell", resource: "git push --force*", effect: "deny" }]`;
    expect(pluginPermissionSurfaceFaults(withRule)).toEqual([
      expect.stringContaining("permission rule"),
    ]);
  });

  it("a hook the plugin legitimately registers is not a fault", () => {
    const source = `const registration = await hook("context", (event) => onContext(ctx, event));`;
    expect(pluginPermissionSurfaceFaults(source)).toEqual([]);
  });
});

describe("permissions-probe: the fixture's config states", () => {
  it("the pre-block state carries no permissions array", () => {
    const parsed = JSON.parse(preBlockConfigText()) as { permissions?: unknown };
    expect(parsed.permissions).toBeUndefined();
  });

  it("the project config under test carries the four denies", () => {
    // The probe fixture copies THIS checkout's opencode.jsonc verbatim — the
    // file this item's deliverable edits — so the denies must be in it.
    const raw = readFileSync(join(root, "opencode.jsonc"), "utf8");
    for (const required of [
      "git commit --no-verify*",
      "git push --force*",
      "git push -f*",
      "git push *+*",
    ]) {
      expect(raw).toContain(required);
    }
  });
});

describe("permissions-probe: deterministic legs (real spawns, model-free)", () => {
  it("both hook gates refuse the denied command and allow the allowed one", () => {
    const records = gateLegs();
    expect(records).toHaveLength(4);
    expect(records.map((record) => record.runtime)).toEqual([
      "zcode-gate",
      "zcode-gate",
      "claude-gate",
      "claude-gate",
    ]);
    for (const record of records) {
      expect(record.outcome, `${record.runtime}: ${record.observed}`).toBe(record.expected);
      expect(record.doesNotProve.length).toBeGreaterThan(0);
    }
    // The denial must be the gate's own refusal, not a generic non-zero exit.
    const denied = records.filter((record) => record.expected === "denied");
    for (const record of denied) {
      expect(record.observed).toContain("arggon gate: denied");
      expect(record.exit).toBe("hook exit 2");
    }
  });

  it("the vendored plugin declares no permission surface of its own", () => {
    const [record] = pluginLeg();
    expect(record?.runtime).toBe("arggon-plugin");
    expect(record?.outcome).toBe("allowed");
    expect(record?.observed).toContain("no config hook");
  });
});
