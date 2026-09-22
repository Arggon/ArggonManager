/**
 * `@smoke` browser spec: `arggon board --serve` on an isolated fixture.
 *
 * ADR 0008 tier 2: the review-time browser gate is the Playwright CLI; this
 * spec is the durable, deterministic regression net CI runs with
 * `npx playwright test --grep @smoke` (Chromium only; `@playwright/test` is a
 * devDependency and never ships). It covers what exists today — board renders,
 * one card per `arggon list` item, one legal status move round-trips and
 * persists. Later board features (e.g. filter lenses) add cases here.
 *
 * Fixture discipline mirrors `smoke/tui-smoke.ts`: a fresh temp repo with a
 * git identity, `arggon init`, then an initiative → epic → story → task chain
 * created through the CLI. The server runs from the built bin
 * (`dist/cli.js board --serve --port 0`, an ephemeral free port) so the spec
 * exercises the shipped entry, not the TypeScript source.
 */
import { expect, test } from "@playwright/test";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(repoRoot, "dist", "cli.js");
const TIMEOUT_MS = 30_000;

/** The task the status move drives; id derives from the title `Board task`. */
const MOVED_ITEM_ID = "task-board-task";

type ListedItem = { id: string; status: string };

/** Run the built CLI inside the fixture; throws on a non-zero exit. */
function runCli(fixture: string, args: string[]): string {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: fixture,
    encoding: "utf8",
    timeout: 60_000,
  });
  if (result.status !== 0) {
    throw new Error(
      `arggon ${args.join(" ")} failed (${result.status}): ${result.stdout ?? ""}${result.stderr ?? ""}`,
    );
  }
  return result.stdout ?? "";
}

/** Run the CLI with `--json` and parse the envelope. */
function cliJson<T>(fixture: string, args: string[]): T {
  return JSON.parse(runCli(fixture, [...args, "--json"])) as T;
}

/** Fresh git repo + `arggon init` + a 4-item tree, all through the CLI. */
function createFixture(): string {
  const fixture = mkdtempSync(join(tmpdir(), "arggon-e2e-board-"));
  const git = (args: string[]): void => {
    const result = spawnSync("git", args, { cwd: fixture, encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${result.stdout ?? ""}${result.stderr ?? ""}`);
    }
  };
  git(["init", "-q"]);
  git(["config", "user.email", "smoke@example.test"]);
  git(["config", "user.name", "Board Smoke"]);
  writeFileSync(join(fixture, "README.md"), "# board smoke fixture\n", "utf8");
  git(["add", "README.md"]);
  git(["commit", "-qm", "chore: fixture"]);

  cliJson(fixture, ["init", fixture]);
  const chain: Array<[string, string, string | undefined]> = [
    ["initiative", "Board smoke", undefined],
    ["epic", "Core", "board-smoke"],
    ["story", "Entries", "core"],
    ["task", "Board task", "entries"],
  ];
  for (const [type, title, parent] of chain) {
    runCli(fixture, [
      "create",
      type,
      title,
      ...(parent !== undefined ? ["--parent", parent] : []),
      "--json",
    ]);
  }
  return fixture;
}

/** Start `board --serve` on a free port and resolve with the printed URL. */
function startBoardServer(fixture: string): Promise<{ child: ChildProcess; url: string }> {
  const child = spawn(process.execPath, [cli, "board", "--serve", "--port", "0"], {
    cwd: fixture,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return new Promise((resolvePromise, reject) => {
    let output = "";
    const timer = setTimeout(() => {
      reject(new Error(`board --serve printed no URL within ${TIMEOUT_MS}ms:\n${output}`));
    }, TIMEOUT_MS);
    const onData = (chunk: Buffer): void => {
      output += chunk.toString("utf8");
      const match = /http:\/\/127\.0\.0\.1:\d+/.exec(output);
      if (match) {
        clearTimeout(timer);
        child.stdout?.off("data", onData);
        resolvePromise({ child, url: match[0] });
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/** Poll until the board answers 200 (URL is printed after `listening`). */
async function waitForBoard(url: string): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;
  for (;;) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // not accepting connections yet
    }
    if (Date.now() > deadline) throw new Error(`board server at ${url} not reachable`);
    await new Promise((done) => setTimeout(done, 100));
  }
}

/** SIGTERM, then SIGKILL after a bounded grace period. */
function stopServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolvePromise) => {
    const kill = setTimeout(() => child.kill("SIGKILL"), 5_000);
    child.once("close", () => {
      clearTimeout(kill);
      resolvePromise();
    });
    child.kill("SIGTERM");
  });
}

test.describe("@smoke board --serve", () => {
  let fixture: string;
  let server: { child: ChildProcess; url: string } | undefined;
  let listItems: ListedItem[];

  test.beforeAll(async () => {
    fixture = createFixture();
    server = await startBoardServer(fixture);
    await waitForBoard(server.url);
    listItems = cliJson<{ items: ListedItem[] }>(fixture, ["list"]).items;
  });

  test.afterAll(async () => {
    if (server) await stopServer(server.child);
    if (fixture) rmSync(fixture, { recursive: true, force: true });
  });

  test("renders one card per tracker item", async ({ page }) => {
    await page.goto(server?.url ?? "");
    await expect(page.locator("h1")).toContainText("arggon board");

    const cards = page.locator(".board .card");
    await expect(cards).toHaveCount(listItems.length);
    // Card ids come from `data-id`; parity is exact, not just a count match.
    const ids = await cards.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-id")).sort(),
    );
    expect(ids).toEqual(listItems.map((item) => item.id).sort());
  });

  test("a status move round-trips through the UI and persists", async ({ page }) => {
    await page.goto(server?.url ?? "");
    const card = page.locator(`.card[data-id="${MOVED_ITEM_ID}"]`);
    await expect(card).toHaveCount(1);
    await expect(card).toHaveAttribute("data-status", "todo");

    // todo → cancelled is legal, needs no claim and no blocked reason, so the
    // drop runs with zero dialogs.
    await card.dragTo(page.locator('.column[data-status="cancelled"]'));

    await expect(
      page.locator(`.column[data-status="cancelled"] .card[data-id="${MOVED_ITEM_ID}"]`),
    ).toHaveCount(1);
    // The ok toast only appears after the update endpoint answered — the
    // persistence check below cannot race the POST.
    await expect(page.locator("#board-toast")).toContainText(`${MOVED_ITEM_ID} -> cancelled`);

    await expect
      .poll(() => cliJson<{ item: ListedItem }>(fixture, ["show", MOVED_ITEM_ID]).item.status)
      .toBe("cancelled");
  });
});
