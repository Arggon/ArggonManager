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
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(repoRoot, "dist", "cli.js");
const TIMEOUT_MS = 30_000;

/** The task the status move drives; id derives from the title `Board task`. */
const MOVED_ITEM_ID = "task-board-task";

/** The labelled task the lens cases narrow to; id derives from `Board filter task`. */
const FILTER_ITEM_ID = "task-board-filter-task";

/**
 * Detail-drawer fixture (task-board-item-detail): a task with a body,
 * acceptance rows, a hostile line, a branch and two dependencies (one open,
 * one terminal), plus a task deleted mid-test to prove a live reload closes
 * the drawer. Ids derive from the fixture titles below.
 */
const DETAIL_ITEM_ID = "task-board-detail-task";
const DETAIL_DEP_ID = "task-board-detail-dep";
const DETAIL_DONE_DEP_ID = "task-board-detail-done-dep";
const RELOAD_ITEM_ID = "task-board-reload-task";

/** Body of the detail fixture: checklist rows plus a hostile "HTML" line. */
const DETAIL_BODY = `# Board detail task

## Context

Detail drawer fixture body.

## Acceptance

- [x] done row
- [ ] open row

hostile <img src=x onerror="window.__xss=1"> text`;

/** The `filter` value in a URL hash (null when the board is unfiltered). */
function filterFromUrl(url: string): string | null {
  return new URLSearchParams(new URL(url).hash.replace(/^#/, "")).get("filter");
}

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

/** Absolute path of a tracker item file (from `arggon show --json`). */
function itemFilePath(fixture: string, id: string): string {
  return join(fixture, cliJson<{ item: { path: string } }>(fixture, ["show", id]).item.path);
}

/** Replace an item's body, keeping its frontmatter (fixture setup). */
function setBody(fixture: string, id: string, body: string): void {
  const path = itemFilePath(fixture, id);
  const lines = readFileSync(path, "utf8").split("\n");
  const end = lines.indexOf("---", 1);
  writeFileSync(path, `${lines.slice(0, end + 1).join("\n")}\n\n${body}\n`, "utf8");
}

/** Add one frontmatter line to an item (fixture setup for kernel-only fields). */
function addFrontmatterLine(fixture: string, id: string, line: string): void {
  const path = itemFilePath(fixture, id);
  const lines = readFileSync(path, "utf8").split("\n");
  const end = lines.indexOf("---", 1);
  lines.splice(end, 0, line);
  writeFileSync(path, lines.join("\n"), "utf8");
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
  // A labelled task the filter cases narrow to; never moved by any test.
  runCli(fixture, [
    "create",
    "task",
    "Board filter task",
    "--parent",
    "entries",
    "--labels",
    "smoke",
    "--json",
  ]);
  // Detail-drawer fixture (task-board-item-detail). The detail and reload
  // tasks sit in `cancelled` (not `todo`) so the todo column stays short
  // enough that the status-move test's drag needs no mid-drag scroll:
  // Playwright's dragTo re-scrolls for the drop target, and a scroll between
  // mousedown and the first move makes Chromium resolve the drag source under
  // the stale pointer position (it grabbed a neighbouring card).
  runCli(fixture, [
    "create",
    "task",
    "Board detail task",
    "--parent",
    "entries",
    "--labels",
    "detail",
    "--json",
  ]);
  runCli(fixture, ["create", "task", "Board detail dep", "--parent", "entries", "--json"]);
  runCli(fixture, ["create", "task", "Board detail done dep", "--parent", "entries", "--json"]);
  runCli(fixture, ["create", "task", "Board reload task", "--parent", "entries", "--json"]);
  runCli(fixture, [
    "update",
    DETAIL_ITEM_ID,
    "--depends-on",
    `${DETAIL_DEP_ID},${DETAIL_DONE_DEP_ID}`,
    "--json",
  ]);
  runCli(fixture, [
    "update",
    DETAIL_ITEM_ID,
    "--branch",
    "feat/task-board-detail",
    "--priority",
    "p1",
    "--json",
  ]);
  runCli(fixture, ["update", DETAIL_DONE_DEP_ID, "--status", "cancelled", "--json"]);
  runCli(fixture, ["update", DETAIL_ITEM_ID, "--status", "cancelled", "--json"]);
  runCli(fixture, ["update", RELOAD_ITEM_ID, "--status", "cancelled", "--json"]);
  addFrontmatterLine(fixture, DETAIL_ITEM_ID, "worktree_path: /tmp/arggon-wt");
  setBody(fixture, DETAIL_ITEM_ID, DETAIL_BODY);
  // Saved views (`x-views`, task-board-filter-lenses) for the lens cases,
  // appended to the tracker convention after init.
  const convention = join(fixture, "ArggonManager", ".convention.yml");
  writeFileSync(
    convention,
    `${readFileSync(convention, "utf8").trimEnd()}\nx-views:\n  smoke: "label:smoke"\n  open: "status:todo"\n`,
    "utf8",
  );
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

  test("a saved lens filters the board, shrinks the column and round-trips through the URL", async ({
    page,
  }) => {
    await page.goto(server?.url ?? "");
    await expect(page.locator("#board-lenses .lens")).toHaveCount(2);
    const chip = page.locator('#board-lenses .lens[data-name="smoke"]');
    await expect(chip).toHaveAttribute("title", "smoke: label:smoke");

    await chip.click();
    await expect(page.locator(".card:not(.filtered-out)")).toHaveCount(1);
    await expect(page.locator(`.card:not(.filtered-out)[data-id="${FILTER_ITEM_ID}"]`)).toHaveCount(
      1,
    );
    // Column counts and the meta line reflect the filtered set.
    await expect(page.locator('.column[data-status="todo"] .count')).toHaveText("1");
    await expect(page.locator('.column[data-status="done"] .count')).toHaveText("0");
    await expect(page.locator("#board-filter-count")).toHaveText(
      `1 of ${listItems.length} item(s)`,
    );
    await expect(page.locator("#board-filter-input")).toHaveValue("label:smoke");
    expect(filterFromUrl(page.url())).toBe("label:smoke");

    // Reload/share/copy: the URL hash restores the lens.
    await page.reload();
    await expect(page.locator("#board-filter-input")).toHaveValue("label:smoke");
    await expect(page.locator(".card:not(.filtered-out)")).toHaveCount(1);
    await expect(page.locator('.column[data-status="todo"] .count')).toHaveText("1");

    // Clearing restores the full board and drops the hash filter.
    await page.locator("#board-filter-clear").click();
    await expect(page.locator(".card:not(.filtered-out)")).toHaveCount(listItems.length);
    await expect(page.locator("#board-filter-input")).toHaveValue("");
    expect(filterFromUrl(page.url())).toBeNull();
  });

  test("free text narrows id/title and survives a reload", async ({ page }) => {
    await page.goto(server?.url ?? "");
    await page.locator("#board-filter-input").fill("filter task");
    await expect(page.locator(".card:not(.filtered-out)")).toHaveCount(1);
    await expect(page.locator(`.card:not(.filtered-out)[data-id="${FILTER_ITEM_ID}"]`)).toHaveCount(
      1,
    );
    expect(filterFromUrl(page.url())).toBe("filter task");

    await page.reload();
    await expect(page.locator("#board-filter-input")).toHaveValue("filter task");
    await expect(page.locator(".card:not(.filtered-out)")).toHaveCount(1);
  });

  test("the static export filters offline through the same URL hash", async ({ page }) => {
    const boardFile = join(fixture, "static-board.html");
    runCli(fixture, ["board", "--out", boardFile]);
    await page.goto(`file://${boardFile}`);
    await expect(page.locator("#board-lenses .lens")).toHaveCount(2);

    await page.locator('#board-lenses .lens[data-name="smoke"]').click();
    await expect(page.locator(".card:not(.filtered-out)")).toHaveCount(1);
    await expect(page.locator(`.card:not(.filtered-out)[data-id="${FILTER_ITEM_ID}"]`)).toHaveCount(
      1,
    );
    expect(filterFromUrl(page.url())).toBe("label:smoke");

    await page.reload();
    await expect(page.locator(".card:not(.filtered-out)")).toHaveCount(1);
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

  test("opens the item detail drawer (Enter), renders the checklist and deps, Esc returns focus", async ({
    page,
  }) => {
    await page.goto(server?.url ?? "");
    const card = page.locator(`.card[data-id="${DETAIL_ITEM_ID}"]`);
    await expect(card).toHaveCount(1);

    // Cards are focusable in serve mode: Enter opens the drawer.
    await card.focus();
    await page.keyboard.press("Enter");
    const drawer = page.locator("#board-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.locator(".drawer-title")).toHaveText("Board detail task");
    const meta = drawer.locator(".drawer-meta");
    await expect(meta).toContainText("task");
    await expect(meta).toContainText("p1");
    await expect(meta).toContainText("cancelled");
    await expect(drawer.locator(".drawer-row").filter({ hasText: "labels" })).toContainText(
      "detail",
    );
    await expect(drawer.locator(".drawer-row").filter({ hasText: "branch" })).toContainText(
      "feat/task-board-detail",
    );
    await expect(drawer.locator(".drawer-row").filter({ hasText: "worktree" })).toContainText(
      "/tmp/arggon-wt",
    );
    await expect(drawer.locator(".drawer-row").filter({ hasText: "path" })).toContainText(
      `${DETAIL_ITEM_ID}.md`,
    );
    // Acceptance rows render read-only with their checked state.
    await expect(drawer.locator(".drawer-acceptance .drawer-check")).toHaveCount(2);
    await expect(drawer.locator(".drawer-acceptance .drawer-check input:checked")).toHaveCount(1);
    await expect(drawer.locator(".drawer-acceptance .drawer-check input:disabled")).toHaveCount(2);
    await expect(drawer.locator(".drawer-acceptance .drawer-check").nth(1)).toContainText(
      "open row",
    );
    // Dependencies carry their kernel status (open vs terminal).
    await expect(drawer.locator(".drawer-deps .drawer-dep.open")).toHaveText(
      `${DETAIL_DEP_ID} · todo`,
    );
    await expect(drawer.locator(".drawer-deps .drawer-dep.terminal")).toHaveText(
      `${DETAIL_DONE_DEP_ID} · cancelled`,
    );
    // Degraded live overlay (no gh in the fixture): the PR section says so.
    await expect(drawer.locator(".drawer-pr")).toContainText("no PR");
    // The hostile body line is text, never an element.
    await expect(drawer.locator(".drawer-prose .drawer-body-text")).toContainText(
      '<img src=x onerror="window.__xss=1">',
    );
    await expect(drawer.locator("img")).toHaveCount(0);
    expect(
      await page.evaluate(() => (window as unknown as { __xss?: number }).__xss),
    ).toBeUndefined();

    // Esc closes the drawer and returns focus to the card that opened it.
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(card).toBeFocused();

    // A plain click opens it too; the close button restores focus as well.
    await card.click();
    await expect(drawer).toBeVisible();
    await drawer.locator("#board-drawer-close").click();
    await expect(drawer).toBeHidden();
    await expect(card).toBeFocused();
  });

  test("opens the drawer from a filtered view; Esc closes it before the filter's clear", async ({
    page,
  }) => {
    await page.goto(server?.url ?? "");
    await page.locator("#board-filter-input").fill("label:detail");
    await expect(page.locator(".card:not(.filtered-out)")).toHaveCount(1);
    const card = page.locator(`.card:not(.filtered-out)[data-id="${DETAIL_ITEM_ID}"]`);
    await card.click();
    await expect(page.locator("#board-drawer")).toBeVisible();
    await expect(page.locator("#board-drawer .drawer-title")).toHaveText("Board detail task");

    // With the drawer open, Esc is captured by the drawer: the focused filter
    // input's own Escape-to-clear must not run first.
    await page.locator("#board-filter-input").focus();
    await page.keyboard.press("Escape");
    await expect(page.locator("#board-drawer")).toBeHidden();
    await expect(page.locator("#board-filter-input")).toHaveValue("label:detail");
    // A second Escape (drawer closed, input focused) clears the filter as before.
    await page.locator("#board-filter-input").focus();
    await page.keyboard.press("Escape");
    await expect(page.locator("#board-filter-input")).toHaveValue("");
    await expect(page.locator(".card:not(.filtered-out)")).toHaveCount(listItems.length);
  });

  test("renders the live-overlay PR badge as a link (and refuses non-http URLs)", async ({
    page,
  }) => {
    let prPayload: Record<string, unknown> | null = {
      branch: "feat/task-board-detail",
      number: 42,
      url: "https://github.com/o/r/pull/42",
      state: "OPEN",
      isDraft: false,
      checks: "passing",
    };
    await page.route("**/api/item*", async (route) => {
      const response = await route.fetch();
      const payload = (await response.json()) as { detail: { pr: unknown } };
      payload.detail.pr = prPayload;
      await route.fulfill({ json: payload });
    });
    await page.goto(server?.url ?? "");
    await page.locator(`.card[data-id="${DETAIL_ITEM_ID}"]`).click();
    const pr = page.locator("#board-drawer .drawer-pr");
    await expect(pr.locator("a")).toHaveAttribute("href", "https://github.com/o/r/pull/42");
    await expect(pr.locator("a")).toHaveText("#42 · open · passing");
    await page.keyboard.press("Escape");

    // A hostile PR URL never becomes a link (the client only wires http(s)).
    prPayload = {
      branch: "feat/task-board-detail",
      number: 43,
      url: "javascript:window.__xss=1",
      state: "OPEN",
      isDraft: false,
      checks: "unknown",
    };
    await page.locator(`.card[data-id="${DETAIL_ITEM_ID}"]`).click();
    await expect(page.locator("#board-drawer .drawer-pr a")).toHaveCount(0);
    await expect(page.locator("#board-drawer .drawer-pr")).toContainText("no PR");
  });

  test("a live reload that removes the item closes the drawer gracefully", async ({ page }) => {
    await page.goto(server?.url ?? "");
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    const card = page.locator(`.card[data-id="${RELOAD_ITEM_ID}"]`);
    await expect(card).toHaveCount(1);
    await card.click();
    await expect(page.locator("#board-drawer")).toBeVisible();
    await expect(page.locator("#board-drawer .drawer-title")).toHaveText("Board reload task");

    rmSync(itemFilePath(fixture, RELOAD_ITEM_ID));
    // The watcher pushes an SSE reload; the board comes back without the item
    // and the drawer is closed (never left open over a missing item).
    await expect(page.locator(`.card[data-id="${RELOAD_ITEM_ID}"]`)).toHaveCount(0);
    await expect(page.locator("#board-drawer")).toBeHidden();
    expect(errors).toEqual([]);
  });
});
