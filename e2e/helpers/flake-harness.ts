/**
 * Env-gated CPU-throttle + background-load harness for flaky Playwright specs
 * (task-flake-repro-throttle-tool, recipe proven on bug-live-reload-sse-race /
 * PR #521).
 *
 * A flaky e2e spec usually passes in a quiet lane and fails only on a
 * contended machine. This harness arms the two dials that made the #521
 * live-reload race reproduce on demand — CDP `Emulation.setCPUThrottlingRate`
 * on the page under test plus real host-level busy-spinners competing for the
 * CPU — and it is a strict no-op unless the environment asks for it, so the
 * default CI lane is unaffected (the `@smoke` lane stays 33/33 unthrottled).
 *
 * Usage — arm the dials from the environment, change nothing in the spec body:
 *
 *     // 1. import the harness `test` instead of the plain one:
 *     import { test } from "./helpers/flake-harness.js";
 *     //    (keep `expect` and types on `@playwright/test`)
 *
 *     // 2. run the flaky spec under load — the #521 recipe:
 *     E2E_THROTTLE=20 E2E_SPINNERS=16 npx playwright test \
 *       --grep "a live reload preserves"
 *
 * Environment:
 *   E2E_THROTTLE=<n>    CDP CPU throttling rate for every page the spec
 *                       opens (`Emulation.setCPUThrottlingRate`, n>=1; 20 is
 *                       the proven setting). Absent/empty → no throttling.
 *   E2E_SPINNERS=<n>    host busy-spinner child processes held for the whole
 *                       worker (n>=0; 16 on a 12-core box saturates it).
 *                       Absent/empty → no spinners.
 *
 * A malformed value fails loud (clear error naming the variable) instead of
 * silently running unthrottled — a typo must not masquerade as "cannot
 * reproduce". Both variables are independent; setting either is enough.
 *
 * Scope discipline: this is a REPRODUCTION tool for investigating flaky
 * specs, not a lane configuration — never wire the env into CI, and grep to
 * the suspect spec (throttling every page makes the whole lane crawl).
 */
import { spawn, type ChildProcess } from "node:child_process";
import { test as base, type Page } from "@playwright/test";

/** Log a harness event on stderr so the armed dials show up in test output. */
function note(message: string): void {
  process.stderr.write(`[flake-harness] ${message}\n`);
}

/** Strict integer env parse; `null` when absent or empty (the off state). */
function intFromEnv(name: string, min: number): number | null {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(
      `[flake-harness] ${name} must be an integer >= ${min}, got ${JSON.stringify(raw)}`,
    );
  }
  return value;
}

/** The configured CDP CPU throttling rate, or `null` when not armed. */
export function flakeThrottleRate(): number | null {
  return intFromEnv("E2E_THROTTLE", 1);
}

/** The configured background-spinner count, or `null` when not armed. */
export function flakeSpinnerCount(): number | null {
  return intFromEnv("E2E_SPINNERS", 0);
}

/**
 * Throttle one page's CPU via CDP — the deterministic half of the recipe.
 * No-op (returns false) unless `E2E_THROTTLE` is set. The session stays
 * attached to the page; Chromium tears it down with the page.
 */
export async function throttlePage(page: Page): Promise<boolean> {
  const rate = flakeThrottleRate();
  if (rate === null) return false;
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate });
  note(`CPU throttled ${rate}x (E2E_THROTTLE)`);
  return true;
}

/** Handle for the armed host load: what is running and how to stop it. */
export interface BackgroundSpinners {
  count: number;
  pids: number[];
  /** SIGKILLs every spinner; idempotent. */
  stop(): void;
}

/**
 * The contention half of the recipe: `count` node busy-spinners competing
 * for real CPU (16 on a 12-core box saturates it — the #521 recipe pushed
 * load avg from 11 to 23 alongside a concurrent vitest run). Callers MUST
 * `stop()` in fixture teardown (OS-level SIGKILL, reliable). Two backstops
 * cover shutdown paths that skip fixture teardown — a worker Playwright
 * force-kills on Ctrl-C or a global timeout runs no teardown and no `exit`
 * hook: every spinner watches its parent (`kill(ppid, 0)`) and exits when
 * the parent disappears, and self-expires after 15 minutes regardless, so a
 * spinner can never outlive the session that armed it.
 */
export function startBackgroundSpinners(count: number): BackgroundSpinners {
  // Tight floating-point spin — pure CPU burn, no allocation pressure, and
  // `Date.now()` keeps the loop from being constant-folded away. The liveness
  // check sits INSIDE the loop because a busy loop never pumps the event
  // loop, so timers and I/O events (a stdin close, a signal handler) would
  // never fire; `kill(ppid, 0)` throwing ESRCH is the parent-gone signal.
  const SPIN =
    "const ppid=Number(process.env.FLAKE_PARENT_PID),t0=Date.now();" +
    "for(;;){Math.sin(Date.now());" +
    "if(Date.now()-t0>900000)process.exit(0);" +
    "try{process.kill(ppid,0)}catch{process.exit(0)}}";
  const children: ChildProcess[] = [];
  const stop = (): void => {
    process.removeListener("exit", stop);
    for (const child of children.splice(0)) child.kill("SIGKILL");
  };
  process.once("exit", stop);
  for (let i = 0; i < count; i++) {
    children.push(
      spawn(process.execPath, ["-e", SPIN], {
        stdio: "ignore",
        env: { ...process.env, FLAKE_PARENT_PID: String(process.pid) },
      }),
    );
  }
  note(`${count} background spinner(s) started (E2E_SPINNERS)`);
  return { count, pids: children.map((child) => child.pid ?? -1), stop };
}

/**
 * The harness `test`: drop-in replacement for the `@playwright/test` export.
 * Wraps the built-in `page` fixture with the CDP throttle and adds a
 * worker-scoped auto fixture holding the spinners — both strict no-ops
 * without the environment, so a spec can switch its import permanently and
 * the default lane never notices.
 */
export const test = base.extend<{ page: Page }, { flakeBackgroundLoad: void }>({
  page: async ({ page }, use) => {
    await throttlePage(page);
    await use(page);
  },

  flakeBackgroundLoad: [
    async ({}, use) => {
      const count = flakeSpinnerCount();
      const spinners = count === null ? null : startBackgroundSpinners(count);
      await use();
      spinners?.stop();
    },
    { scope: "worker", auto: true },
  ],
});
