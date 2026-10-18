/**
 * `@smoke` browser spec: `arggon board --serve` on an isolated fixture.
 *
 * ADR 0008 tier 2: the review-time browser gate is the Playwright CLI; this
 * spec is the durable, deterministic regression net CI runs with
 * `npx playwright test --grep @smoke` (Chromium only; `@playwright/test` and
 * `@axe-core/playwright` are devDependencies and never ship). It covers what
 * exists today — board renders, one card per `arggon list` item, one legal
 * status move round-trips and persists, and the ready page carries no
 * WCAG-tagged automated accessibility violation. Later board features (e.g.
 * filter lenses) add cases here.
 *
 * Fixture discipline mirrors `smoke/tui-smoke.ts`: a fresh temp repo with a
 * git identity, `arggon init`, then an initiative → epic → story → task chain
 * created through the CLI. The server runs from the built bin
 * (`dist/cli.js board --serve --port 0`, an ephemeral free port) so the spec
 * exercises the shipped entry, not the TypeScript source.
 */
import { expect, type Page } from "@playwright/test";
// `test` comes from the env-gated flake harness (task-flake-repro-throttle-
// tool): with E2E_THROTTLE / E2E_SPINNERS set, any run of this spec arms CDP
// CPU throttling plus host busy-spinners; without the env both fixtures are
// strict no-ops, so the default @smoke lane is untouched. Usage and the
// proven #521 recipe live in e2e/helpers/flake-harness.ts.
import { test } from "./helpers/flake-harness.js";
// Named import, not default: under `module: NodeNext` the package's `types`
// condition resolves the CJS-paired index.d.ts, where `AxeBuilder as default`
// is not honored and esModuleInterop synthesizes the module namespace as the
// default — so `new AxeBuilder(...)` is TS2351 under tsc (invisible until
// task-typecheck-e2e-specs added this type-check; Playwright's transpiler
// never checked it). The named export is the constructable class.
import { AxeBuilder } from "@axe-core/playwright";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// One source of truth for the source-path spawn argv (task-e2e-board-serve-
// wrapper): `node --import <tsx loader> cli/src/cli.ts`, per bug-row-table-
// flake. Playwright's transpiler handles the plain TS import (verified by the
// @smoke lane); the `.js` extension is what NodeNext type-checking requires.
import { cliNodeArgs } from "../cli/src/test-spawn.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(repoRoot, "dist", "cli.js");
const TIMEOUT_MS = 30_000;

/** The task the status move drives; id derives from the title `Board task`. */
const MOVED_ITEM_ID = "task-board-task";

/** The labelled task the lens cases narrow to; id derives from `Board filter task`. */
const FILTER_ITEM_ID = "task-board-filter-task";

/** The unclaimed task the move-dialog cases drive; id derives from `Board dialog task`. */
const DIALOG_ITEM_ID = "task-board-dialog-task";

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

/**
 * Absolute path for a screenshot under Playwright's `test-results/` output
 * (gitignored build artifact): visual evidence for theme/density review
 * (task-board-theme-density) — never a committed fixture.
 */
function screenshotPath(name: string): string {
  return join("test-results", name);
}

/**
 * Accessibility policy for the `@smoke` lane (task-axe-core-browser-ci).
 *
 * The asserted tag set is **every WCAG A/AA level axe can check automatically**
 * across WCAG 2.0, 2.1 and 2.2. It is written out rather than approximated by
 * `withTags(["wcag2a", "wcag2aa"])`, because a tag list that silently omits
 * 2.1/2.2 would let a new 2.1/2.2 AA rule pass unreported. AAA is deliberately
 * out of scope (axe automates almost nothing there and the bar would be
 * unmeetable). `best-practice` is deliberately out of scope by a recorded
 * decision (task-axe-board-drawer-and-lens-coverage): it is not a conformance
 * level, and its rule surface has never been audited on this board, so
 * asserting it wholesale would trade a green gate for an unaudited one. The
 * one `best-practice` finding the ready page used to report — `region` on the
 * filter bar — is FIXED: `#board-filterbar` is a `role="search"` landmark.
 * Widening the tag set is a deliberate follow-up (audit the current
 * best-practice rule list against every scanned state, fix or file each
 * finding, then widen); the reason is recorded in CONTRIBUTING.md § UI smoke
 * tests, not silently dropped.
 *
 * The rules of this policy, all enforced by the `expect` in `axeScan`:
 *
 * 1. **No blanket exclusions.** No `exclude`, no `include`, no `disableRules`
 *    and no `.withRules()` narrowing anywhere in this file. If a scan cannot be
 *    made green on the whole ready page, the defect gets fixed or filed.
 * 2. **An accepted exception is a comment, not a silent drop.** Zero exceptions
 *    exist today. Adding one means a comment at the call site naming the exact
 *    rule id, why the violation is not a defect a contributor can fix, and an
 *    owner (a person or a tracked item id) — plus a matching line in
 *    `CONTRIBUTING.md` § UI smoke tests and
 *    `ArggonManager/docs/engineering.md` § Smoke test.
 * 3. **Every scanned state gets its own deterministic readiness signal before
 *    its scan** (task-axe-board-drawer-and-lens-coverage): the ready page
 *    (first test), the open detail drawer (after an `expect` on its async
 *    `/api/item` content), the static `file://` export (after its h1), the
 *    filtered/lens states (after the narrowed-card count), the static
 *    grouped-ancestry export (`--group-by tree`, after its h1) and the
 *    filtered ancestry tree on the served board (after the `N of M` count) are
 *    each scanned at a settled point — never a sleep, never a `networkidle`
 *    guess, never a scan smuggled in after unrelated assertions have moved
 *    the page on. task-tree-rows-open-detail adds the same discipline for the
 *    tree's interactive states: the row-opened drawer (after its title), the
 *    tree keyboard/roving state (after the Home focus assertion), the folded
 *    tree (after its subtree is asserted hidden), the folded branch holding a
 *    lens match (after its `N matches inside` marker), the offline tree-row
 *    drawer on the static `--details` tree export (after its acceptance-row
 *    count) and the terminal + fold composed tree (after its counts).
 *    bug-tree-done-container-hides-open-work adds the open-descendant
 *    disclosure's scanned state: the served tree under a lens with the
 *    terminal rule and a fold applied (after the badge and the `N of M`
 *    counts). task-board-no-done-over-open-work widens the same state: the
 *    masked container reads `open` (chip, node attribute, aria) and stays
 *    visible under the terminal rule in BOTH layouts — the done column keeps
 *    it while only the genuinely terminal cards hide.
 */
const AXE_WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] as const;

/**
 * Assert the ready board carries no WCAG-tagged automated violation.
 *
 * The failure message is the remediation surface, so it names each rule, its
 * impact, its WCAG tags, the offending node targets and axe's own remediation
 * URL — a contributor should be able to fix the board from the CI log without
 * opening this file. Throwing on a non-empty violation list is what makes the
 * scan a gate rather than a report.
 */
async function axeScan(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags([...AXE_WCAG_TAGS]).analyze();
  expect(
    results.violations.map(
      (violation) =>
        `${violation.id} (${violation.impact ?? "unknown"}; ${violation.tags
          .filter((tag) => tag.startsWith("wcag"))
          .join(", ")}): ${violation.help}\n` +
        violation.nodes
          .map((node) => `  ${node.target.join(" ")}\n    ${node.html.slice(0, 200)}`)
          .join("\n") +
        `\n  ${violation.helpUrl}`,
    ),
    "axe found WCAG-tagged automated accessibility violations on the ready board.\n" +
      "Fix the board (contrast, names, roles) or file a follow-up item — do not " +
      "exclude the rule. Policy: the comment above `AXE_WCAG_TAGS`.",
  ).toEqual([]);
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
  // Move-dialog fixture (task-board-move-dialogs): an unclaimed task the
  // dialog cases claim, block and undo. Never touched by the other tests.
  runCli(fixture, ["create", "task", "Board dialog task", "--parent", "entries", "--json"]);
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

/**
 * Tree terminal-layout fixture (bug-tree-ignores-hide-terminal-toggle): the
 * bug is about a LAYOUT preference applying to the ancestry tree, so the
 * fixture needs the two shapes that rule distinguishes — a terminal row with a
 * live descendant (hiding it would orphan the live row, so it must stay, muted)
 * and terminal rows that must hide. Its own fixture, not the shared one: those
 * extra terminal rows must not shift the card positions the column, drag and
 * arrow tests measure.
 */
const TREE_STORY_ID = "tree-closed-story";
const TREE_OPEN_CHILD_ID = "task-tree-open-child";
const TREE_CLOSED_LEAF_ID = "task-tree-closed-leaf";
const TREE_TERMINAL_ROOT_ID = "tree-terminal-root";

function createTreeTerminalFixture(): string {
  const fixture = mkdtempSync(join(tmpdir(), "arggon-e2e-tree-terminal-"));
  const git = (args: string[]): void => {
    const result = spawnSync("git", args, { cwd: fixture, encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${result.stdout ?? ""}${result.stderr ?? ""}`);
    }
  };
  git(["init", "-q"]);
  git(["config", "user.email", "smoke@example.test"]);
  git(["config", "user.name", "Board Smoke"]);
  writeFileSync(join(fixture, "README.md"), "# tree terminal fixture\n", "utf8");
  git(["add", "README.md"]);
  git(["commit", "-qm", "chore: fixture"]);

  cliJson(fixture, ["init", fixture]);
  const chain: Array<[string, string, string | undefined]> = [
    ["initiative", "Tree smoke", undefined],
    ["epic", "Tree core", "tree-smoke"],
    ["story", "Tree closed story", "tree-core"],
    ["task", "Tree open child", "tree-closed-story"],
    ["task", "Tree closed leaf", "tree-closed-story"],
    // A parentless terminal root (tasks need a parent, an initiative does not):
    // alone in the lens verdict, everything the lens keeps is terminal, so the
    // composed tree has nothing visible at all.
    ["initiative", "Tree terminal root", undefined],
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
  // A terminal CONTAINER: cancelled directly, with the open child inside, so
  // hiding it would orphan a visible task (the context case).
  runCli(fixture, ["update", TREE_STORY_ID, "--status", "cancelled", "--json"]);
  // A terminal LEAF: done has to pass the acceptance gate and the transition
  // contract (todo -> in_progress -> done), so it carries a real criterion.
  setBody(fixture, TREE_CLOSED_LEAF_ID, "# Tree closed leaf\n\n## Acceptance\n\n- [x] shipped\n");
  runCli(fixture, [
    "update",
    TREE_CLOSED_LEAF_ID,
    "--status",
    "in_progress",
    "--assignee",
    "tree-bot",
    "--json",
  ]);
  runCli(fixture, ["update", TREE_CLOSED_LEAF_ID, "--status", "done", "--json"]);
  runCli(fixture, ["update", TREE_TERMINAL_ROOT_ID, "--status", "cancelled", "--json"]);
  return fixture;
}

/**
 * Open-descendant disclosure fixture (bug-tree-done-container-hides-open-work):
 * the measured shape the report describes — a DONE container whose subtree
 * still holds open work three levels down (two open descendants, plus a done
 * task and a cancelled bug that must NOT count), and a second done container
 * whose whole subtree is terminal (no badge). Its own fixture, not the shared
 * one: the extra terminal containers must not shift the counts and card
 * positions the other cases measure.
 */
const OPEN_ROOT_ID = "tree-done-root";
const OPEN_EPIC_ID = "tree-done-epic";
const OPEN_STORY_ID = "tree-done-story";
const OPEN_TASK_ID = "task-tree-open-descendant";
const OPEN_WIP_TASK_ID = "task-tree-wip-descendant";
const OPEN_DONE_TASK_ID = "task-tree-done-descendant";
const OPEN_CANCELLED_BUG_ID = "bug-tree-cancelled-descendant";
const CLEAN_EPIC_ID = "tree-done-clean-epic";
const CLEAN_STORY_ID = "tree-done-clean-story";
const CLEAN_TASK_ID = "task-tree-clean-descendant";

function createOpenDescendantFixture(): string {
  const fixture = mkdtempSync(join(tmpdir(), "arggon-e2e-tree-open-"));
  const git = (args: string[]): void => {
    const result = spawnSync("git", args, { cwd: fixture, encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${result.stdout ?? ""}${result.stderr ?? ""}`);
    }
  };
  git(["init", "-q"]);
  git(["config", "user.email", "smoke@example.test"]);
  git(["config", "user.name", "Board Smoke"]);
  writeFileSync(join(fixture, "README.md"), "# tree open-descendant fixture\n", "utf8");
  git(["add", "README.md"]);
  git(["commit", "-qm", "chore: fixture"]);

  cliJson(fixture, ["init", fixture]);
  const chain: Array<[string, string, string | undefined]> = [
    ["initiative", "Tree done root", undefined],
    ["epic", "Tree done epic", OPEN_ROOT_ID],
    ["story", "Tree done story", OPEN_EPIC_ID],
    ["task", "Tree open descendant", OPEN_STORY_ID],
    ["task", "Tree wip descendant", OPEN_STORY_ID],
    ["task", "Tree done descendant", OPEN_STORY_ID],
    ["bug", "Tree cancelled descendant", OPEN_STORY_ID],
    // The all-terminal container: a done story whose only child is done.
    ["epic", "Tree done clean epic", OPEN_ROOT_ID],
    ["story", "Tree done clean story", CLEAN_EPIC_ID],
    ["task", "Tree clean descendant", CLEAN_STORY_ID],
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
  // Terminal leaf flips carry `--no-cascade`: the cascade would auto-complete
  // an ancestor whose whole subtree just went terminal, and this fixture needs
  // every container's status to stay AUTHORED.
  for (const id of [OPEN_DONE_TASK_ID, CLEAN_TASK_ID]) {
    setBody(fixture, id, `# ${id}\n\n## Acceptance\n\n- [x] shipped\n`);
    runCli(fixture, ["update", id, "--status", "in_progress", "--assignee", "tree-bot", "--json"]);
    runCli(fixture, ["update", id, "--status", "done", "--no-cascade", "--json"]);
  }
  runCli(fixture, [
    "update",
    OPEN_CANCELLED_BUG_ID,
    "--status",
    "cancelled",
    "--no-cascade",
    "--json",
  ]);
  // One open descendant is claimed, so both non-terminal statuses count.
  runCli(fixture, [
    "update",
    OPEN_WIP_TASK_ID,
    "--status",
    "in_progress",
    "--assignee",
    "tree-bot",
    "--json",
  ]);
  // The containers: authored terminal status with open work below (containers
  // are not acceptance-gated, and the claim step is the legal todo → done path).
  for (const id of [OPEN_STORY_ID, CLEAN_STORY_ID, OPEN_EPIC_ID, CLEAN_EPIC_ID, OPEN_ROOT_ID]) {
    const claimable = id === OPEN_STORY_ID || id === CLEAN_STORY_ID;
    runCli(fixture, [
      "update",
      id,
      "--status",
      "in_progress",
      ...(claimable ? ["--assignee", "tree-bot"] : []),
      "--json",
    ]);
    runCli(fixture, ["update", id, "--status", "done", "--no-cascade", "--json"]);
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

  test("columns render only task/bug leaf cards (task-columns-view-shows-only-task-and-bug-leaves)", async ({
    page,
  }) => {
    await page.goto(server?.url ?? "");
    // The h1 is the existing readiness signal for "the board is up and rendered"
    // (no blind sleep): everything below — including the axe scan — is asserted
    // against a settled page. The scan runs here, before the card-parity and
    // round-trip tests move the page on, so a failure points at the static
    // surface rather than at post-interaction state.
    await expect(page.locator("h1")).toContainText("arggon board");
    // The fixture renders an EMPTY done column at generation time, so the scan
    // below actually asserts the .empty placeholder's contrast (the parent
    // item darkened it for exactly this state; without this expect a fixture
    // change could silently stop covering it).
    await expect(page.locator('.column[data-status="done"] .empty')).toHaveCount(1);
    await axeScan(page);

    // Columns (grouped ancestry off) render only task/bug leaves; initiatives,
    // epics and stories render only in the grouped-ancestry tree view.
    const leafItems = cliJson<{ items: ListedItem[] }>(fixture, [
      "list",
      "--type",
      "task",
    ]).items.concat(cliJson<{ items: ListedItem[] }>(fixture, ["list", "--type", "bug"]).items);
    const cards = page.locator(".board .card");
    await expect(cards).toHaveCount(leafItems.length);
    // Card ids come from `data-id`; parity with the leaf set is exact.
    const ids = await cards.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-id")).sort(),
    );
    expect(ids).toEqual(leafItems.map((item) => item.id).sort());
    // No container type leaks into the flat columns.
    const types = await cards.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-type")),
    );
    expect(types.every((type) => type === "task" || type === "bug")).toBe(true);
  });

  test("the served board stamps the build in the footer and the detail drawer (task-board-build-stamp)", async ({
    page,
  }) => {
    await page.goto(server?.url ?? "");
    // The h1 is the existing readiness signal for "the board is up and
    // rendered" (no blind sleep): the stamp below rides the served page.
    await expect(page.locator("h1")).toContainText("arggon board");
    // Footer stamp: viewer-visible build identity, never a hard-coded sha.
    const footer = page.locator("#board-build");
    await expect(footer).toBeVisible();
    await expect(footer).toHaveText(/^build \S+/);
    const stamped = (await footer.textContent()) ?? "";

    // The same stamp rides inside the detail drawer panel as static chrome
    // (no per-item fetch involved): open a card and compare viewer-visible.
    await page.locator(`.card[data-id="${DETAIL_ITEM_ID}"]`).click();
    const drawer = page.locator("#board-drawer");
    await expect(drawer).toBeVisible();
    const drawerStamp = page.locator("#board-drawer-build");
    await expect(drawerStamp).toBeVisible();
    await expect(drawerStamp).toHaveText(/^build \S+/);
    // The footer carries `build <stamp> · friction <count>` (the friction badge
    // merged on task-board-footer-links-the-friction-report); the drawer stamp
    // rides only the build portion, so compare the build prefix, not the whole
    // footer text — keep both build and friction in the footer itself.
    expect(await drawerStamp.textContent()).toBe(stamped.split(" · ")[0]);

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
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
    // Column counts reflect the rendered leaf cards; the filter-count total is
    // the whole item universe (BOARD_ITEMS), consistent with the tree view.
    await expect(page.locator('.column[data-status="todo"] .count')).toHaveText("1");
    await expect(page.locator('.column[data-status="done"] .count')).toHaveText("0");
    await expect(page.locator("#board-filter-count")).toHaveText(
      `1 of ${listItems.length} item(s)`,
    );
    await expect(page.locator("#board-filter-input")).toHaveValue("label:smoke");
    expect(filterFromUrl(page.url())).toBe("label:smoke");
    // The filtered/lens state is a scanned surface of its own
    // (task-axe-board-drawer-and-lens-coverage): one visible card, every other
    // column showing its .empty placeholder. The count assertion above is the
    // readiness signal.
    await axeScan(page);

    // Reload/share/copy: the URL hash restores the lens.
    await page.reload();
    await expect(page.locator("#board-filter-input")).toHaveValue("label:smoke");
    await expect(page.locator(".card:not(.filtered-out)")).toHaveCount(1);
    await expect(page.locator('.column[data-status="todo"] .count')).toHaveText("1");

    // Clearing restores the full board and drops the hash filter.
    const leafCount =
      cliJson<{ items: ListedItem[] }>(fixture, ["list", "--type", "task"]).items.length +
      cliJson<{ items: ListedItem[] }>(fixture, ["list", "--type", "bug"]).items.length;
    await page.locator("#board-filter-clear").click();
    await expect(page.locator(".card:not(.filtered-out)")).toHaveCount(leafCount);
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

  test("a claim drop collects the assignee through the in-page dialog (task-board-move-dialogs)", async ({
    page,
  }) => {
    // Each dialog case resets its own state through the CLI, so the tests are
    // order-independent (the update endpoint runs the same kernel rules). The
    // SSE stream is muted like the keyboard test's: the reset writes each
    // broadcast a reload, and a reload between mousedown and the first move
    // makes Chromium drop the drag under a stale pointer (see the fixture
    // note above) — and would close an open value dialog mid-flow.
    await page.route("**/events", (route) => route.abort());
    runCli(fixture, ["update", DIALOG_ITEM_ID, "--status", "todo", "--json"]);
    await page.goto(server?.url ?? "");
    const card = page.locator(`.card[data-id="${DIALOG_ITEM_ID}"]`);
    await expect(card).toHaveAttribute("data-status", "todo");

    // todo -> in_progress on an unclaimed task needs --assignee: the dialog.
    await card.dragTo(page.locator('.column[data-status="in_progress"]'));
    await expect(page.locator(".move-prompt-panel")).toBeVisible();
    await expect(page.locator("#board-move-prompt-title")).toHaveText(
      `--assignee required to claim ${DIALOG_ITEM_ID} (GitHub login or agent id):`,
    );

    // Esc cancels: no dialog value, no server write, card stays in todo.
    await page.keyboard.press("Escape");
    await expect(page.locator(".move-prompt-panel")).toBeHidden();
    await expect(card).toHaveAttribute("data-status", "todo");
    expect(
      cliJson<{ item: { status: string } }>(fixture, ["show", DIALOG_ITEM_ID, "--json"]).item
        .status,
    ).toBe("todo");
  });

  test("the claim dialog validates inline and a confirmed claim persists", async ({ page }) => {
    // Muted SSE + CLI reset: see the claim-drop test above.
    await page.route("**/events", (route) => route.abort());
    runCli(fixture, ["update", DIALOG_ITEM_ID, "--status", "todo", "--json"]);
    await page.goto(server?.url ?? "");
    const card = page.locator(`.card[data-id="${DIALOG_ITEM_ID}"]`);
    await expect(card).toHaveAttribute("data-status", "todo");

    await card.dragTo(page.locator('.column[data-status="in_progress"]'));
    await expect(page.locator(".move-prompt-panel")).toBeVisible();
    // Confirming whitespace-only input keeps the dialog open with the error.
    await page.locator("#board-move-prompt-input").fill("   ");
    await page.locator("#board-move-prompt-confirm").click();
    await expect(page.locator("#board-move-prompt-error")).toBeVisible();
    await expect(page.locator(".move-prompt-panel")).toBeVisible();

    // A real login confirms: the card moves and the claim persists.
    await page.locator("#board-move-prompt-input").fill("board-smoke");
    await page.locator("#board-move-prompt-confirm").click();
    await expect(page.locator(".move-prompt-panel")).toBeHidden();
    await expect(card).toHaveAttribute("data-status", "in_progress");
    expect(
      cliJson<{ item: { status: string; assignee: string } }>(fixture, [
        "show",
        DIALOG_ITEM_ID,
        "--json",
      ]).item,
    ).toMatchObject({ status: "in_progress", assignee: "board-smoke" });
  });

  test("a blocked move asks for the reason and the toast offers a working undo", async ({
    page,
  }) => {
    // Start from a claimed in_progress card: undo returns to where the card
    // came from, and the claim survives the round-trip (never force/steal).
    // Muted SSE + CLI resets: see the claim-drop test above.
    await page.route("**/events", (route) => route.abort());
    runCli(fixture, ["update", DIALOG_ITEM_ID, "--status", "todo", "--json"]);
    runCli(fixture, ["update", DIALOG_ITEM_ID, "--assignee", "board-smoke", "--json"]);
    runCli(fixture, ["update", DIALOG_ITEM_ID, "--status", "in_progress", "--json"]);
    await page.goto(server?.url ?? "");
    const card = page.locator(`.card[data-id="${DIALOG_ITEM_ID}"]`);
    await expect(card).toHaveAttribute("data-status", "in_progress");

    // in_progress -> blocked collects --blocked-reason through the same dialog.
    await card.dragTo(page.locator('.column[data-status="blocked"]'));
    await expect(page.locator(".move-prompt-panel")).toBeVisible();
    await page.locator("#board-move-prompt-input").fill("smoke reason");
    await page.locator("#board-move-prompt-confirm").click();
    await expect(page.locator(".move-prompt-panel")).toBeHidden();
    await expect(card).toHaveAttribute("data-status", "blocked");

    // The success toast carries Undo (blocked -> in_progress is legal for a
    // claimed card); clicking it re-enters the move flow and persists.
    const undo = page.locator("#board-toast .toast-action", { hasText: "Undo" });
    await expect(undo).toBeVisible();
    await undo.click();
    await expect(card).toHaveAttribute("data-status", "in_progress");
    const shown = cliJson<{ item: { status: string; blocked_reason: string | null } }>(fixture, [
      "show",
      DIALOG_ITEM_ID,
      "--json",
    ]).item;
    expect(shown.status).toBe("in_progress");
    expect(shown.blocked_reason).toBeNull();
    // Park the dialog item in a terminal column: the roving-focus test below
    // crosses columns by nearest non-empty neighbour, which the in_progress
    // occupancy would change (todo -> in_progress instead of todo -> cancelled).
    runCli(fixture, ["update", DIALOG_ITEM_ID, "--status", "cancelled", "--json"]);
  });

  test("dependency predicates narrow by deps and readiness (task-board-filter-dep-predicates)", async ({
    page,
  }) => {
    await page.goto(server?.url ?? "");
    const visible = page.locator(".card:not(.filtered-out)");

    // blocked-by:<id> is the computed inverse: exactly one fixture item waits
    // on the open detail dep.
    await page.locator("#board-filter-input").fill(`blocked-by:${DETAIL_DEP_ID}`);
    await expect(visible).toHaveCount(1);
    await expect(page.locator(`.card:not(.filtered-out)[data-id="${DETAIL_ITEM_ID}"]`)).toHaveCount(
      1,
    );
    expect(filterFromUrl(page.url())).toBe(`blocked-by:${DETAIL_DEP_ID}`);

    // ready:false — the detail task is the only item with an open dependency
    // (its other dep is cancelled, i.e. terminal, so ready:true excludes just it).
    await page.locator("#board-filter-input").fill("ready:false");
    await expect(visible).toHaveCount(1);
    await expect(page.locator(`.card:not(.filtered-out)[data-id="${DETAIL_ITEM_ID}"]`)).toHaveCount(
      1,
    );

    // The hash restores the dep predicate after a reload, like every filter.
    await page.locator("#board-filter-input").fill(`blocked-by:${DETAIL_DEP_ID}`);
    await page.reload();
    await expect(page.locator("#board-filter-input")).toHaveValue(`blocked-by:${DETAIL_DEP_ID}`);
    await expect(visible).toHaveCount(1);
  });

  test("the static export filters offline through the same URL hash", async ({ page }) => {
    const boardFile = join(fixture, "static-board.html");
    runCli(fixture, ["board", "--out", boardFile]);
    await page.goto(`file://${boardFile}`);
    // The static export is its own document and its own scanned surface
    // (task-axe-board-drawer-and-lens-coverage): same markup, separate scan,
    // h1 as the deterministic readiness signal.
    await expect(page.locator("h1")).toContainText("arggon board");
    await axeScan(page);
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

  test("the summary header rolls up epics, WIP, priority mix and blocked (task-board-progress-header)", async ({
    page,
  }) => {
    await page.goto(server?.url ?? "");
    const panel = page.locator("#board-summary");
    await expect(panel).toBeVisible();
    // Summary rolls up the rendered leaf set only (columns show task/bug
    // leaves; containers live in the tree view), so no epic rollup appears.
    await expect(panel.locator("#board-summary-epics")).toHaveText("none");
    await expect(panel.locator("#board-summary-wip")).toHaveText(/^\d+$/);
    // Priority mix: all five buckets, zero-filled (the fixture sets no priorities).
    await expect(panel.locator("#board-summary-priorities")).toHaveText(
      /^p0 \d+ · p1 \d+ · p2 \d+ · p3 \d+ · none \d+$/,
    );
    await expect(panel.locator("#board-summary-blocked")).toHaveText(/^\d+$/);
  });

  test("story group heads show the completion fraction with --group-by story", async ({ page }) => {
    const boardFile = join(fixture, "grouped-board.html");
    runCli(fixture, ["board", "--group-by", "story", "--out", boardFile]);
    await page.goto(`file://${boardFile}`);
    // The `entries` story head carries the report's done+cancelled/total over
    // its cards; the "no story" head (if rendered) carries none.
    const head = page.locator(".mgroup-head", { hasText: "entries" }).first();
    await expect(head).toContainText(/⚑ entries \d+\/\d+/);
  });

  test("the static export renders the grouped-ancestry view (--group-by tree)", async ({
    page,
  }) => {
    // task-web-board-hierarchy-view: `--group-by tree` opens the board in the
    // nested ancestry layout (initiative → epic → story → leaf) instead of the
    // status columns, and each level carries its own id + status chip.
    const boardFile = join(fixture, "tree-board.html");
    runCli(fixture, ["board", "--group-by", "tree", "--out", boardFile]);
    await page.goto(`file://${boardFile}`);
    await expect(page.locator("h1")).toContainText("arggon board");

    // The board opens in the tree; the columns layout is present but hidden.
    await expect(page.locator("main.board")).toBeHidden();
    const tree = page.locator("#board-tree");
    await expect(tree).toBeVisible();
    await expect(page.locator("#board-view-toggle")).toHaveAttribute("aria-pressed", "true");
    // Every tracked item renders exactly one ancestry row.
    await expect(tree.locator(".tree-node")).toHaveCount(listItems.length);

    // Nesting is structural: story under epic under initiative, task under story.
    await expect(
      page.locator(
        '#board-tree .tree-node[data-id="board-smoke"] .tree-node[data-id="core"] .tree-node[data-id="entries"]',
      ),
    ).toHaveCount(1);
    await expect(
      tree.locator('.tree-node[data-id="entries"] .tree-node[data-id="task-board-task"]'),
    ).toHaveCount(1);
    // Each level names its id and status; the leaf keeps its priority chip slot.
    await expect(tree.locator('.tree-node[data-id="core"] > .tree-row > .status-chip')).toHaveText(
      "todo",
    );
    await expect(
      tree.locator('.tree-node[data-id="task-board-task"] > .tree-row > code'),
    ).toHaveText("task-board-task");
    // The h1 above is the readiness signal; this state is scanned on its own.
    await axeScan(page);
  });

  test("a tree row click opens the detail drawer and Esc returns focus (task-tree-rows-open-detail)", async ({
    page,
  }) => {
    // The tree was read-only before this item: the SAME drawer the columns
    // open on a card click must open for the row's own item.
    await page.goto(server?.url ?? "");
    await page.locator("#board-view-toggle").click();
    const tree = page.locator("#board-tree");
    await expect(tree).toBeVisible();

    const row = tree.locator(`.tree-node[data-id="${DETAIL_ITEM_ID}"] > .tree-row`);
    await expect(row).toHaveCount(1);
    await row.click();
    const drawer = page.locator("#board-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.locator(".drawer-title")).toHaveText("Board detail task");
    // Same bounded content as the card path (serve fetch): deps and branch.
    await expect(drawer.locator(".drawer-deps .drawer-dep.open")).toHaveText(
      `${DETAIL_DEP_ID} · todo`,
    );
    await expect(drawer.locator(".drawer-row").filter({ hasText: "branch" })).toContainText(
      "feat/task-board-detail",
    );
    // This state is scanned on its own (the title assertion above is its
    // deterministic readiness signal): the row-as-trigger drawer.
    await axeScan(page);

    // Esc closes and focus returns to the ROW that opened it.
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(row).toBeFocused();

    // The columns' own path is untouched by the row wiring.
    await page.locator("#board-view-toggle").click();
    const card = page.locator(`.card[data-id="${DETAIL_ITEM_ID}"]`);
    await card.click();
    await expect(drawer.locator(".drawer-title")).toHaveText("Board detail task");
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(card).toBeFocused();
  });

  test("tree rows are keyboard-reachable: Enter/Space open, arrows rove (task-tree-rows-open-detail)", async ({
    page,
  }) => {
    await page.goto(server?.url ?? "");
    await page.locator("#board-view-toggle").click();
    const tree = page.locator("#board-tree");
    await expect(tree).toBeVisible();

    // Roving focus: exactly one row is the tab stop, and the arrow keys move
    // it in reading order (the row's own tab order keeps the fold control).
    const anchor = tree.locator('.tree-row[tabindex="0"]');
    await expect(anchor).toHaveCount(1);
    await expect(anchor.locator("xpath=..")).toHaveAttribute("data-id", "board-smoke");

    const row = tree.locator(`.tree-node[data-id="${DETAIL_ITEM_ID}"] > .tree-row`);
    await row.focus();
    const drawer = page.locator("#board-drawer");
    await page.keyboard.press("Enter");
    await expect(drawer).toBeVisible();
    await expect(drawer.locator(".drawer-title")).toHaveText("Board detail task");
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(row).toBeFocused();

    await page.keyboard.press(" ");
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();

    // ArrowDown moves the roving anchor to the next visible row; Home brings
    // it back to the tree's first row.
    await page.keyboard.press("ArrowDown");
    await expect(tree.locator('.tree-row[tabindex="0"]')).toHaveCount(1);
    const afterArrow = await page.evaluate(() =>
      document.activeElement?.closest(".tree-node")?.getAttribute("data-id"),
    );
    expect(afterArrow).not.toBeNull();
    expect(afterArrow).not.toBe(DETAIL_ITEM_ID);
    await page.keyboard.press("Home");
    await expect(anchor).toBeFocused();
    await expect(anchor.locator("xpath=..")).toHaveAttribute("data-id", "board-smoke");
    // The tree keyboard state is a scanned surface of its own (the Home
    // assertion above is its deterministic readiness signal).
    await axeScan(page);
  });

  test("a container row folds and extends its subtree, persists, and reset restores it (task-tree-rows-open-detail)", async ({
    page,
  }) => {
    await page.goto(server?.url ?? "");
    await page.locator("#board-view-toggle").click();
    const tree = page.locator("#board-tree");
    await expect(tree).toBeVisible();

    const toggle = tree.locator('.tree-node[data-id="entries"] > .tree-row > .tree-toggle');
    const child = tree.locator(`.tree-node[data-id="task-board-task"]`);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toHaveAttribute("aria-label", "collapse entries subtree");
    await expect(child).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toHaveText("+");
    await expect(child).toBeHidden();
    // The fold rides the EXISTING layout record (one key, one reset).
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("arggon-board-columns-v1") || "null"),
    );
    expect(stored?.treeCollapsed).toEqual(["entries"]);
    // Folding never moves a counter: the lens verdict is untouched.
    await expect(page.locator("#board-filter-count")).toHaveText(`${listItems.length} item(s)`);
    await expect(page.locator("#board-tree-count")).toHaveText(String(listItems.length));
    // The folded state is a scanned surface of its own (the hidden-child
    // assertion above is its deterministic readiness signal).
    await axeScan(page);

    // The preference survives a reload, and expanding restores the subtree.
    await page.reload();
    await expect(tree).toBeVisible();
    await expect(child).toBeHidden();
    // The layout toggle composes: the fold survives a trip to the columns and
    // back (it is not a property of the rendered rows).
    await page.locator("#board-view-toggle").click();
    await expect(page.locator("main.board")).toBeVisible();
    await page.locator("#board-view-toggle").click();
    await expect(tree).toBeVisible();
    await expect(child).toBeHidden();
    await toggle.click();
    await expect(child).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    // Reset restores the default (expanded) and persists the reset.
    await toggle.click();
    await expect(child).toBeHidden();
    await page.locator("#board-layout-reset").click();
    await expect(child).toBeVisible();
    const reset = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("arggon-board-columns-v1") || "null"),
    );
    expect(reset?.treeCollapsed).toEqual([]);
    await page.reload();
    await expect(child).toBeVisible();
  });

  test("a lens match inside a folded branch stays discoverable and the counts stay honest (task-tree-rows-open-detail)", async ({
    page,
  }) => {
    // Decision (recorded on the item): a folded branch is MARKED with the
    // matches inside instead of auto-expanding — the user's fold is never
    // silently undone, and the lens answer stays visible.
    await page.goto(server?.url ?? "");
    await page.locator("#board-view-toggle").click();
    const tree = page.locator("#board-tree");
    await expect(tree).toBeVisible();

    // Fold the whole epic that holds `entries` and the matching task.
    const epicToggle = tree.locator('.tree-node[data-id="core"] > .tree-row > .tree-toggle');
    await epicToggle.click();
    await expect(tree.locator(`.tree-node[data-id="${DETAIL_ITEM_ID}"]`)).toBeHidden();

    await page.locator("#board-filter-input").fill("label:detail");
    // The match is inside the fold: its row stays hidden...
    await expect(tree.locator(`.tree-node[data-id="${DETAIL_ITEM_ID}"]`)).toBeHidden();
    // ...but the folded branch says so, in the row and in the disclosure's
    // accessible name (the count is the lens verdict, not rendered rows).
    const marker = tree.locator('.tree-node[data-id="core"] > .tree-row > .tree-matches');
    await expect(marker).toHaveText("1 match inside");
    await expect(epicToggle).toHaveAttribute("aria-label", "expand core subtree — 1 match inside");
    await expect(page.locator("#board-filter-count")).toHaveText(
      `1 of ${listItems.length} item(s)`,
    );
    await expect(page.locator("#board-tree-count")).toHaveText("1");
    // The folded branch WITH its match is a scanned surface of its own.
    await axeScan(page);

    // Expanding the branch reveals the match's path — the marker clears.
    await epicToggle.click();
    await expect(tree.locator(`.tree-node[data-id="${DETAIL_ITEM_ID}"]`)).toBeVisible();
    await expect(marker).toBeHidden();

    // A folded branch whose subtree holds NO match invents no marker: under
    // `type:epic` the folded `core` is the only match, everything inside is
    // hidden by the lens, and the disclosure stays unadorned.
    await page.locator("#board-filter-input").fill("type:epic");
    await expect(marker).toBeHidden();
    await epicToggle.click();
    await expect(marker).toBeHidden();
    await expect(epicToggle).toHaveAttribute("aria-label", "expand core subtree");

    // Without a lens there is no verdict to report — "everything inside" is not
    // information — so a fold stays unmarked even though its rows are visible
    // in the lens's absence.
    await page.locator("#board-filter-clear").click();
    await expect(page.locator("#board-filter-count")).toHaveText(`${listItems.length} item(s)`);
    await expect(tree.locator(`.tree-node[data-id="task-board-task"]`)).toBeHidden();
    await expect(marker).toBeHidden();
    await epicToggle.click();
    await expect(tree.locator(`.tree-node[data-id="task-board-task"]`)).toBeVisible();
  });

  test("the filterbar toggle switches layouts and round-trips through the URL", async ({
    page,
  }) => {
    await page.goto(server?.url ?? "");
    const columns = page.locator("main.board");
    const tree = page.locator("#board-tree");
    const toggle = page.locator("#board-view-toggle");
    await expect(columns).toBeVisible();
    await expect(tree).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    await toggle.click();
    await expect(columns).toBeHidden();
    await expect(tree).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(new URL(page.url()).hash).toBe("#view=tree");

    // Reload/copy/share: the hash restores the layout.
    await page.reload();
    await expect(tree).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    // ... and the columns stay one toggle away, with their leaf cards intact.
    const leafCount =
      cliJson<{ items: ListedItem[] }>(fixture, ["list", "--type", "task"]).items.length +
      cliJson<{ items: ListedItem[] }>(fixture, ["list", "--type", "bug"]).items.length;
    await toggle.click();
    await expect(columns).toBeVisible();
    await expect(tree).toBeHidden();
    await expect(page.locator(".board .card")).toHaveCount(leafCount);
    expect(new URL(page.url()).hash).toBe("");
  });

  test("the lens filters inside the ancestry view and keeps the path as context", async ({
    page,
  }) => {
    await page.goto(server?.url ?? "");
    await page.locator("#board-view-toggle").click();
    await expect(page.locator("#board-tree")).toBeVisible();

    // `label:detail` matches exactly one fixture task: it stays, its recorded
    // ancestor chain stays as context, and nothing else does.
    await page.locator("#board-filter-input").fill("label:detail");
    const visibleNodes = page.locator("#board-tree .tree-node:not(.filtered-out)");
    await expect(visibleNodes).toHaveCount(4);
    await expect(
      page.locator(`#board-tree .tree-node:not(.filtered-out)[data-id="${DETAIL_ITEM_ID}"]`),
    ).toHaveCount(1);
    // The ancestors render as context, the match never does.
    for (const ancestor of ["board-smoke", "core", "entries"]) {
      await expect(
        page.locator(`#board-tree .tree-node.context[data-id="${ancestor}"]`),
      ).toHaveCount(1);
    }
    await expect(
      page.locator(`#board-tree .tree-node.context[data-id="${DETAIL_ITEM_ID}"]`),
    ).toHaveCount(0);
    // Unrelated rows (including sibling tasks of the matched story) are gone.
    await expect(
      page.locator('#board-tree .tree-node:not(.filtered-out)[data-id="task-board-task"]'),
    ).toHaveCount(0);
    // The counts stay honest: N of M counts the match, and the tree heading
    // reports the same verdict rather than the rendered (context) rows.
    await expect(page.locator("#board-filter-count")).toHaveText(
      `1 of ${listItems.length} item(s)`,
    );
    await expect(page.locator("#board-tree-count")).toHaveText("1");
    expect(filterFromUrl(page.url())).toBe("label:detail");
    // The filtered tree state is a scanned surface of its own (the count
    // assertion above is its deterministic readiness signal).
    await axeScan(page);

    // A filter matching nothing empties the tree honestly.
    await page.locator("#board-filter-input").fill("label:does-not-exist");
    await expect(page.locator("#board-tree .tree-node:not(.filtered-out)")).toHaveCount(0);
    await expect(page.locator("#board-filter-count")).toHaveText(
      `0 of ${listItems.length} item(s)`,
    );
  });

  test("the static export with --details opens the drawer offline from the embedded snapshot", async ({
    page,
  }) => {
    // `--details` (task-board-static-details): the drawer renders the bounded
    // per-item payload embedded at generation time — no /api/item fetch is
    // possible on file://, so the assertions below fail if the client tried
    // the serve path (it would show "detail unavailable").
    const boardFile = join(fixture, "details-board.html");
    runCli(fixture, ["board", "--details", "--out", boardFile]);
    await page.goto(`file://${boardFile}`);

    const card = page.locator(`.card[data-id="${DETAIL_ITEM_ID}"]`);
    await expect(card).toHaveCount(1);
    await card.click();
    const drawer = page.locator("#board-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.locator(".drawer-title")).toHaveText("Board detail task");
    // The same bounded content the serve drawer renders: acceptance rows,
    // dependency states and the hostile body line as literal text.
    await expect(drawer.locator(".drawer-acceptance .drawer-check")).toHaveCount(2);
    await expect(drawer.locator(".drawer-acceptance .drawer-check input:checked")).toHaveCount(1);
    // The drawer-over-embedded-snapshot state is scanned too (the acceptance
    // row count above is the readiness signal) — same gate, file:// document.
    await axeScan(page);
    await expect(drawer.locator(".drawer-deps .drawer-dep.open")).toHaveText(
      `${DETAIL_DEP_ID} · todo`,
    );
    await expect(drawer.locator(".drawer-deps .drawer-dep.terminal")).toHaveText(
      `${DETAIL_DONE_DEP_ID} · cancelled`,
    );
    await expect(drawer.locator(".drawer-prose .drawer-body-text")).toContainText(
      '<img src=x onerror="window.__xss=1">',
    );
    await expect(drawer.locator("img")).toHaveCount(0);

    // Esc closes and returns focus; an item with no snapshot entry (created
    // after the export? none here — instead prove the map drives rendering by
    // reopening on a second card) closes gracefully instead of fetching.
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(card).toBeFocused();

    // The interactive surface ships with --details too: keyboard nav focuses
    // cards and the move button is present (moves refuse offline with the
    // static-snapshot toast — the drag flow's own degradation).
    const moveButton = card.locator(".card-move");
    await expect(moveButton).toHaveCount(1);
    await moveButton.click();
    const menu = page.locator("#board-move-menu");
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });

  test("the static tree export with --details opens the drawer from a row, offline (task-tree-rows-open-detail)", async ({
    page,
  }) => {
    // Serve and static-with-`--details` behave the same: the row opens the
    // embedded payload with no server (a fetch would show "detail unavailable").
    const boardFile = join(fixture, "tree-details-board.html");
    runCli(fixture, ["board", "--group-by", "tree", "--details", "--out", boardFile]);
    await page.goto(`file://${boardFile}`);
    await expect(page.locator("h1")).toContainText("arggon board");
    const tree = page.locator("#board-tree");
    await expect(tree).toBeVisible();

    const row = tree.locator(`.tree-node[data-id="${DETAIL_ITEM_ID}"] > .tree-row`);
    await row.click();
    const drawer = page.locator("#board-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.locator(".drawer-title")).toHaveText("Board detail task");
    await expect(drawer.locator(".drawer-acceptance .drawer-check")).toHaveCount(2);
    // The drawer-over-row state is scanned on its own (the acceptance count is
    // its deterministic readiness signal) — same gate, file:// document.
    await axeScan(page);
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(row).toBeFocused();

    // Keyboard parity offline: Enter on the focused row opens the same drawer.
    await page.keyboard.press("Enter");
    await expect(drawer.locator(".drawer-title")).toHaveText("Board detail task");
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });

  test("a drawer-free static tree export keeps the fold and offers no fake affordance (task-tree-rows-open-detail)", async ({
    page,
  }) => {
    const boardFile = join(fixture, "tree-plain-board.html");
    runCli(fixture, ["board", "--group-by", "tree", "--out", boardFile]);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(`file://${boardFile}`);
    await expect(page.locator("h1")).toContainText("arggon board");
    const tree = page.locator("#board-tree");
    await expect(tree).toBeVisible();

    // No drawer payload: no drawer markup, no focusable/named rows, no
    // pointer-cursor rule — and no anchors, so nothing navigates on a click.
    await expect(page.locator("#board-drawer")).toHaveCount(0);
    await expect(tree.locator(".tree-row[tabindex]")).toHaveCount(0);
    await expect(tree.locator('.tree-row[role="group"]')).toHaveCount(0);
    await expect(tree.locator("a")).toHaveCount(0);

    // Clicking a row does nothing (no drawer to open, no navigation)...
    const row = tree.locator(`.tree-node[data-id="${DETAIL_ITEM_ID}"] > .tree-row`);
    const urlBefore = page.url();
    await row.click();
    await expect(page.locator("#board-drawer")).toHaveCount(0);
    expect(page.url()).toBe(urlBefore);

    // ...while the fold is a real, working affordance in the same export.
    const toggle = tree.locator('.tree-node[data-id="entries"] > .tree-row > .tree-toggle');
    await toggle.click();
    await expect(tree.locator(`.tree-node[data-id="task-board-task"]`)).toBeHidden();
    await page.reload();
    await expect(tree.locator(`.tree-node[data-id="task-board-task"]`)).toBeHidden();
    await toggle.click();
    await expect(tree.locator(`.tree-node[data-id="task-board-task"]`)).toBeVisible();
    expect(errors).toEqual([]);
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
    // The drawer is a scanned surface of its own
    // (task-axe-board-drawer-and-lens-coverage). The acceptance-row count
    // above is the deterministic readiness signal for the async `/api/item`
    // content: the fetch has settled and the checklist is rendered, so the
    // scan cannot race it (no sleep, no networkidle).
    await axeScan(page);
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
    const leafCount =
      cliJson<{ items: ListedItem[] }>(fixture, ["list", "--type", "task"]).items.length +
      cliJson<{ items: ListedItem[] }>(fixture, ["list", "--type", "bug"]).items.length;
    await expect(page.locator(".card:not(.filtered-out)")).toHaveCount(leafCount);
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

  test("arrow keys move the roving focus across columns; Home/End bound a column", async ({
    page,
  }) => {
    await page.goto(server?.url ?? "");
    await expect(page.locator("h1")).toContainText("arggon board");
    // Exactly one roving anchor exists; focusing a card moves it there.
    const todoCards = page.locator('.column[data-status="todo"] .card:not(.filtered-out)');
    const first = todoCards.nth(0);
    const second = todoCards.nth(1);
    await first.focus();
    await expect(first).toHaveAttribute("tabindex", "0");
    await expect(second).toHaveAttribute("tabindex", "-1");

    // Down: next visible card of the same column (it now carries the anchor).
    await page.keyboard.press("ArrowDown");
    await expect(second).toBeFocused();
    await expect(second).toHaveAttribute("tabindex", "0");
    await expect(first).toHaveAttribute("tabindex", "-1");

    // Up: back; Right: crosses the empty columns into the next non-empty one.
    await page.keyboard.press("ArrowUp");
    await expect(first).toBeFocused();
    await page.keyboard.press("ArrowRight");
    const rightColumn = page.evaluate(() =>
      (document.activeElement as HTMLElement).closest(".column")?.getAttribute("data-status"),
    );
    await expect(rightColumn).resolves.toBe("cancelled");
    await expect(page.locator('.column[data-status="cancelled"] .card[tabindex="0"]')).toHaveCount(
      1,
    );
    // Left returns to the same position in the todo column (index 0 here).
    await page.keyboard.press("ArrowLeft");
    await expect(first).toBeFocused();

    // Home/End bound the column.
    await second.focus();
    await page.keyboard.press("Home");
    await expect(first).toBeFocused();
    await page.keyboard.press("End");
    const lastTodo = todoCards.nth((await todoCards.count()) - 1);
    await expect(lastTodo).toBeFocused();
  });

  test("a keyboard-only status move round-trips through the card action menu and persists", async ({
    page,
  }) => {
    // Every successful move makes the server broadcast an SSE reload that
    // location.reload()s the page; these menu flows assert focus and DOM state
    // across several steps, so the event stream is muted (registered BEFORE
    // goto — otherwise the page's initial EventSource connects unblocked).
    // The reload behavior itself is covered by the live-reload test above.
    await page.route("**/events", (route) => route.abort());
    await page.goto(server?.url ?? "");
    // This card sits in `cancelled` from the fixture setup (no other test
    // moves it); from there exactly one transition is legal, so the menu must
    // offer only `todo`.
    const card = page.locator(`.card[data-id="${DETAIL_DONE_DEP_ID}"]`);
    await expect(card).toHaveAttribute("data-status", "cancelled");

    await card.focus();
    await page.keyboard.press("m");
    const menu = page.locator("#board-move-menu");
    await expect(menu).toBeVisible();
    await expect(menu.locator(".move-menu-title")).toHaveText(`move ${DETAIL_DONE_DEP_ID}`);
    const targets = menu.locator(".move-menu-target");
    await expect(targets).toHaveCount(1);
    await expect(targets).toHaveText("move to todo");

    // Enter activates the focused target; the dialog closes and focus returns
    // to the card that opened the menu.
    await page.keyboard.press("Enter");
    await expect(menu).toBeHidden();
    await expect(
      page.locator(`.column[data-status="todo"] .card[data-id="${DETAIL_DONE_DEP_ID}"]`),
    ).toHaveCount(1);
    // The accessible name follows the move immediately (no stale status).
    await expect(card).toHaveAttribute(
      "aria-label",
      "task task-board-detail-done-dep: Board detail done dep (todo)",
    );
    await expect(page.locator("#board-toast")).toContainText(`${DETAIL_DONE_DEP_ID} -> todo`);
    await expect(card).toBeFocused();
    await expect
      .poll(() => cliJson<{ item: ListedItem }>(fixture, ["show", DETAIL_DONE_DEP_ID]).item.status)
      .toBe("todo");
  });

  test("the action menu runs the claim and blocked-reason prompts (drag parity)", async ({
    page,
  }) => {
    await page.goto(server?.url ?? "");
    // Mute the SSE reload stream BEFORE goto: two moves land in this test and
    // each would otherwise location.reload() the page mid-menu (see the
    // keyboard test above).
    await page.route("**/events", (route) => route.abort());
    await page.goto(server?.url ?? "");
    const card = page.locator(`.card[data-id="${DETAIL_DEP_ID}"]`);
    await expect(card).toHaveAttribute("data-status", "todo");
    // The flow's two value prompts are the in-page move dialog now
    // (task-board-move-dialogs): answered exactly as a person would — the
    // claim dialog takes the assignee, the blocked dialog the reason.
    const answerDialog = async (value: string): Promise<void> => {
      await expect(page.locator(".move-prompt-panel")).toBeVisible();
      await page.locator("#board-move-prompt-input").fill(value);
      await page.locator("#board-move-prompt-confirm").click();
      await expect(page.locator(".move-prompt-panel")).toBeHidden();
    };

    // Tap affordance this time: the unassigned todo card offers in_progress
    // (after the claim dialog) and cancelled — never done/blocked.
    await card.locator(".card-move").click();
    const menu = page.locator("#board-move-menu");
    await expect(menu).toBeVisible();
    await expect(menu.locator(".move-menu-target")).toHaveCount(2);
    await expect(menu.locator('.move-menu-target[data-target="in_progress"]')).toHaveText(
      "move to in_progress (claim first)",
    );
    await expect(menu.locator('.move-menu-target[data-target="done"]')).toHaveCount(0);
    await menu.locator('.move-menu-target[data-target="in_progress"]').click();
    await answerDialog("smoke-user");
    await expect(
      page.locator(`.column[data-status="in_progress"] .card[data-id="${DETAIL_DEP_ID}"]`),
    ).toHaveCount(1);
    // The optimistic move repaints the accessible name with status and claim.
    await expect(card).toHaveAttribute(
      "aria-label",
      "task task-board-detail-dep: Board detail dep (in_progress, @smoke-user)",
    );
    await expect
      .poll(
        () =>
          cliJson<{ item: { status: string; assignee: string | null } }>(fixture, [
            "show",
            DETAIL_DEP_ID,
          ]).item,
      )
      .toEqual(expect.objectContaining({ status: "in_progress", assignee: "smoke-user" }));

    // Keyboard path this time: in_progress -> blocked prompts --blocked-reason.
    await card.focus();
    await page.keyboard.press("m");
    await expect(menu).toBeVisible();
    await menu.locator('.move-menu-target[data-target="blocked"]').click();
    await answerDialog("waiting on upstream");
    await expect(
      page.locator(`.column[data-status="blocked"] .card[data-id="${DETAIL_DEP_ID}"]`),
    ).toHaveCount(1);
    await expect(page.locator("#board-toast")).toContainText(`${DETAIL_DEP_ID} -> blocked`);
    await expect
      .poll(
        () =>
          cliJson<{ item: { status: string; blocked_reason: string | null } }>(fixture, [
            "show",
            DETAIL_DEP_ID,
          ]).item,
      )
      .toEqual(
        expect.objectContaining({ status: "blocked", blocked_reason: "waiting on upstream" }),
      );
  });

  test("touch: tapping the move menu moves a card without drag (mobile fallback)", async ({
    page,
  }) => {
    // HTML5 drag-and-drop never fires on touch screens; the phone-sized, touch
    // context proves the tap affordance carries the same move flow.
    const browser = page.context().browser();
    const mobile = await browser!.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    });
    const touchPage = await mobile.newPage();
    // Mute the SSE reload stream BEFORE goto (see the keyboard test above):
    // the move here would otherwise reload the page between tap and assertion.
    await touchPage.route("**/events", (route) => route.abort());
    await touchPage.goto(server?.url ?? "");
    await expect(touchPage.locator("h1")).toContainText("arggon board");
    const card = touchPage.locator(`.card[data-id="${FILTER_ITEM_ID}"]`);
    await expect(card).toHaveCount(1);

    await card.locator(".card-move").tap();
    const menu = touchPage.locator("#board-move-menu");
    await expect(menu).toBeVisible();
    await menu.locator('.move-menu-target[data-target="cancelled"]').tap();
    await expect(
      touchPage.locator(`.column[data-status="cancelled"] .card[data-id="${FILTER_ITEM_ID}"]`),
    ).toHaveCount(1);
    await expect(touchPage.locator("#board-toast")).toContainText(`${FILTER_ITEM_ID} -> cancelled`);
    await expect
      .poll(() => cliJson<{ item: ListedItem }>(fixture, ["show", FILTER_ITEM_ID]).item.status)
      .toBe("cancelled");
    await mobile.close();
  });

  test("the connection banner reports a live stream (task-board-live-reload-state)", async ({
    page,
  }) => {
    await page.goto(server?.url ?? "");
    const banner = page.locator("#board-conn");
    // role=status + aria-live=polite: a drop to reconnecting announces itself.
    await expect(banner).toHaveAttribute("role", "status");
    await expect(banner).toHaveAttribute("aria-live", "polite");
    await expect(banner).toHaveClass(/live/);
    await expect(banner).toHaveText("live");
  });

  test("marks the board stale when the SSE stream drops", async ({ page }) => {
    // Abort the event stream BEFORE the navigation, exactly as a dead server
    // would behave: the EventSource errors and the pill flips to the stale
    // marker while the (possibly outdated) board stays readable.
    await page.route("**/events", (route) => route.abort());
    await page.goto(server?.url ?? "");
    await expect(page.locator("h1")).toContainText("arggon board");
    const banner = page.locator("#board-conn");
    await expect(banner).toHaveClass(/reconnecting/);
    await expect(banner).toHaveText("reconnecting — board may be stale");
  });

  test("a live reload preserves the filter, the open drawer and the scroll position", async ({
    page,
  }) => {
    // A short viewport makes the board taller than the screen, so the
    // preserved scroll offset is a real, non-zero value.
    await page.setViewportSize({ width: 900, height: 320 });
    await page.goto(server?.url ?? "");
    await expect(page.locator("#board-conn.live")).toHaveText("live");

    // The reload trigger is a throwaway item created through the CLI. Its
    // create-write fires an SSE reload of its own, so wait for that reload to
    // settle (the new card only exists on the page after it) before setup —
    // otherwise the reload would land mid-setup and wipe the state under test.
    const created = cliJson<{ item: { id: string } }>(fixture, [
      "create",
      "task",
      "Board preserve task",
      "--parent",
      "entries",
      "--json",
    ]);
    const preserveId = created.item.id;
    await expect(page.locator(`.card[data-id="${preserveId}"]`)).toHaveCount(1);

    // State under test: a non-zero scroll offset, a lens filter, and the
    // detail drawer open on the one card the filter keeps visible. Scroll
    // first, while the unfiltered board is tall.
    await page.locator("#board-filter-input").fill("label:detail");
    await expect(page.locator(".card:not(.filtered-out)")).toHaveCount(1);
    await page.locator(`.card[data-id="${DETAIL_ITEM_ID}"]`).click();
    await expect(page.locator("#board-drawer")).toBeVisible();
    await expect(page.locator("#board-drawer .drawer-title")).toHaveText("Board detail task");
    // The offset to preserve is whatever the page actually sits at after the
    // drawer-opening click (Playwright scrolls the card into view, so it is
    // not the scrollTo above) — non-zero, and restored EXACTLY.
    const scrollBefore = await page.evaluate(() => window.scrollY);
    expect(scrollBefore).toBeGreaterThan(0);

    // Marker on the CURRENT page — on the <html> element, not on `window`:
    // after the reload proves the page was really replaced (the preservation
    // assertions cannot pass against the pre-reload DOM), and the check below
    // can assert its ABSENCE with a locator instead of a `page.evaluate` poll.
    await page.evaluate(() => {
      document.documentElement.dataset.preserveMarker = "42";
    });

    // External tracker write (not through this page) fires the SSE reload.
    runCli(fixture, ["update", preserveId, "--status", "cancelled", "--json"]);

    // The reload-landed gate: the probe lives only on the OLD document, so
    // "an <html> without it" resolves exactly when the reloaded document is
    // resolved — never on the old page (it carries the marker), never in the
    // navigation teardown window (no document resolves to zero elements, and
    // the count stays 0 there). A locator wait retries through the navigation
    // by design; the page.evaluate poll this replaces burned its whole window
    // throwing "Execution context was destroyed" while the frame navigated.
    // The ceiling is generous because a contended machine legitimately needs
    // tens of seconds to parse+layout the reloaded board — the point is the
    // readiness signal, not the number.
    await expect(page.locator("html:not([data-preserve-marker])")).toHaveCount(1, {
      timeout: 30_000,
    });

    // The page-functional gate: the SSE stream reconnected, so the reloaded
    // page parsed its reload client and is live again — the same readiness
    // signal the connection-banner test pins (and the stale-drop test pins in
    // reverse). Only after this gate do the preservation assertions read the
    // page, so no later `page.evaluate` can race a pending navigation.
    await expect(page.locator("#board-conn.live")).toHaveText("live", { timeout: 15_000 });

    await expect(page.locator("#board-filter-input")).toHaveValue("label:detail");
    await expect(page.locator(".card:not(.filtered-out)")).toHaveCount(1);
    await expect(page.locator("#board-drawer .drawer-title")).toHaveText("Board detail task");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollBefore);

    // The preserved drawer is a real drawer: Esc closes it and focus returns
    // to the (still filtered-visible) card that opened it.
    await page.keyboard.press("Escape");
    await expect(page.locator("#board-drawer")).toBeHidden();
    await expect(page.locator(`.card[data-id="${DETAIL_ITEM_ID}"]`)).toBeFocused();

    // The same preservation covers the tree's own open path
    // (task-tree-rows-open-detail): a drawer opened from a grouped-ancestry row
    // re-opens through that row after a live reload, and Esc returns focus to it.
    await page.locator("#board-view-toggle").click();
    await expect(page.locator("#board-tree")).toBeVisible();
    const treeRow = page.locator(`#board-tree .tree-node[data-id="${DETAIL_ITEM_ID}"] > .tree-row`);
    await treeRow.click();
    await expect(page.locator("#board-drawer .drawer-title")).toHaveText("Board detail task");
    await page.evaluate(() => {
      document.documentElement.dataset.preserveMarker = "43";
    });
    // Another external write fires the reload (a create, like the first
    // trigger; a status reopen is refused for non-interactive callers).
    cliJson<{ item: { id: string } }>(fixture, [
      "create",
      "task",
      "Board preserve task 2",
      "--parent",
      "entries",
      "--json",
    ]);
    await expect(page.locator("html:not([data-preserve-marker])")).toHaveCount(1, {
      timeout: 30_000,
    });
    await expect(page.locator("#board-conn.live")).toHaveText("live", { timeout: 15_000 });
    await expect(page.locator("#board-tree")).toBeVisible();
    await expect(page.locator("#board-drawer .drawer-title")).toHaveText("Board detail task");
    await page.keyboard.press("Escape");
    await expect(page.locator("#board-drawer")).toBeHidden();
    await expect(treeRow).toBeFocused();
  });

  test("columns collapse, terminal columns hide, and the layout persists (task-board-column-controls)", async ({
    page,
  }) => {
    await page.goto(server?.url ?? "");
    const todo = page.locator('.column[data-status="todo"]');
    const todoCards = todo.locator(".card");
    await expect(todoCards.first()).toBeVisible();

    // Collapse todo: cards hide, the heading (with its count) stays visible,
    // and the toggle flips to the expanded announcement.
    await todo.locator('.col-toggle[data-status="todo"]').click();
    await expect(todo).toHaveClass(/collapsed/);
    await expect(todo.locator(".col-toggle")).toHaveAttribute("aria-expanded", "false");
    await expect(todo.locator(".col-toggle")).toHaveAttribute(
      "aria-label",
      "expand the todo column",
    );
    await expect(todoCards.first()).toBeHidden();
    await expect(todo.locator(".count")).toBeVisible();

    // Hide the terminal columns through the filterbar toggle.
    const terminalToggle = page.locator("#board-terminal-toggle");
    await terminalToggle.click();
    await expect(terminalToggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('.column[data-status="done"]')).toBeHidden();
    await expect(page.locator('.column[data-status="cancelled"]')).toBeHidden();

    // The layout persists in localStorage across a reload.
    await page.reload();
    await expect(page.locator('.column[data-status="todo"]')).toHaveClass(/collapsed/);
    await expect(page.locator('.column[data-status="done"]')).toBeHidden();

    // The controls undo themselves (expand + show), then reset restores the
    // default layout and the reset persists too.
    await page.locator('.col-toggle[data-status="todo"]').click();
    await expect(page.locator('.column[data-status="todo"]')).not.toHaveClass(/collapsed/);
    await page.locator("#board-layout-reset").click();
    await expect(terminalToggle).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator('.column[data-status="done"]')).toBeVisible();
    await page.reload();
    await expect(page.locator('.column[data-status="todo"]')).not.toHaveClass(/collapsed/);
    await expect(page.locator('.column[data-status="done"]')).toBeVisible();
  });

  test("collapsing the column that holds the roving anchor re-seats it", async ({ page }) => {
    await page.goto(server?.url ?? "");
    const todo = page.locator('.column[data-status="todo"]');
    // The server seeds the anchor on the first todo card.
    await expect(todo.locator('.card[tabindex="0"]')).toHaveCount(1);
    await todo.locator('.col-toggle[data-status="todo"]').click();
    await expect(todo).toHaveClass(/collapsed/);
    // The anchor moved out of the collapsed column: keyboard entry survives.
    const anchor = page.locator('.board .card[tabindex="0"]');
    await expect(anchor).toHaveCount(1);
    const anchorColumn = await anchor.evaluate((card) =>
      card.closest(".column")?.getAttribute("data-status"),
    );
    expect(anchorColumn).not.toBe("todo");
  });

  test("column headers stick to the viewport top while the board scrolls", async ({ page }) => {
    // A tall column is what makes stickiness observable: fill todo through the
    // CLI (each create fires a reload, so the page is only loaded afterwards).
    for (let i = 1; i <= 12; i++) {
      runCli(fixture, ["create", "task", `Board filler ${i}`, "--parent", "entries", "--json"]);
    }
    await page.setViewportSize({ width: 900, height: 400 });
    await page.goto(server?.url ?? "");
    const filler = page.locator(".card .title", { hasText: "Board filler 12" });
    await expect(filler).toBeVisible();
    // The 12 creates above each arm the serve watcher's reload debounce
    // (100ms); its trailing broadcast can navigate while this test measures
    // and destroy the execution context. Two timeOrigin samples one debounce
    // window apart prove the reload storm has settled — re-armed debounces
    // (the auto-commit writes) are covered by the poll retry, and the probe
    // itself catches the destroyed-context throw so a navigation in flight
    // reads as "not settled yet" instead of aborting the poll (bug-smoke-
    // sticky-header-settle-retry: expect.poll does not retry a throwing
    // probe). The raised ceiling covers contended machines (#521 saw >15s).
    await expect
      .poll(
        async () => {
          try {
            const before = await page.evaluate(() => performance.timeOrigin);
            await page.waitForTimeout(120);
            return (await page.evaluate(() => performance.timeOrigin)) === before;
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (message.includes("Execution context was destroyed")) return false;
            throw err;
          }
        },
        { intervals: [50], timeout: 30_000 },
      )
      .toBe(true);
    const measure = async (): Promise<void> => {
      await page.goto(server?.url ?? "");
      const filler = page.locator(".card .title", { hasText: "Board filler 12" });
      await expect(filler).toBeVisible();
      const column = page.locator('.column[data-status="todo"]');
      const header = page.locator("#board-column-todo");
      // Unstuck at load: the header sits at its natural in-column position.
      const natural = await header.evaluate((el) => el.getBoundingClientRect().top);
      expect(natural).toBeGreaterThan(0);
      // Scroll into the middle of the tall column: the header pins to the top.
      await page.evaluate(
        (offset) => window.scrollTo(0, offset),
        (await column.evaluate((el) => el.getBoundingClientRect().top + window.scrollY)) + 100,
      );
      await expect.poll(() => header.evaluate((el) => el.getBoundingClientRect().top)).toBe(0);
    };
    // The creates above each arm the server's debounced SSE reload, and one
    // can still land after this page's EventSource connects — destroying the
    // execution context mid-measure ("Execution context was destroyed"). The
    // reload lands on the same board with no further writes queued, so the
    // whole measurement retries through it, bounded.
    for (let attempt = 1; ; attempt++) {
      try {
        await measure();
        break;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (attempt >= 2 || !message.includes("Execution context was destroyed")) throw err;
      }
    }
  });

  test("the theme toggle cycles auto/light/dark and persists across a reload (task-board-theme-density)", async ({
    page,
  }) => {
    await page.goto(server?.url ?? "");
    const root = page.locator("html");
    const themeToggle = page.locator("#board-theme-toggle");
    // The emulated OS here is light, so auto resolves to light at boot — the
    // same resolution the <head> boot script performed before first paint.
    await expect(themeToggle).toHaveText("theme: auto");
    await expect(root).toHaveAttribute("data-theme", "light");
    await expect(root).toHaveAttribute("data-density", "comfortable");

    // auto -> light: the resolved attribute is unchanged, the override is stored.
    await themeToggle.click();
    await expect(themeToggle).toHaveText("theme: light");
    await expect(root).toHaveAttribute("data-theme", "light");

    // light -> dark: the page actually repaints dark (body background flips).
    await themeToggle.click();
    await expect(themeToggle).toHaveText("theme: dark");
    await expect(root).toHaveAttribute("data-theme", "dark");
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
      .toBe("rgb(13, 17, 23)"); // --bg dark: #0d1117
    // color-scheme follows, so native controls match the painted surface.
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme))
      .toBe("dark");
    await page.screenshot({ path: screenshotPath("board-theme-dark.png"), fullPage: true });

    // The override survives a reload (persisted under arggon-board-theme-v1).
    await page.reload();
    await expect(themeToggle).toHaveText("theme: dark");
    await expect(root).toHaveAttribute("data-theme", "dark");
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
      .toBe("rgb(13, 17, 23)");

    // dark -> auto: back to the OS preference (light in this context).
    await themeToggle.click();
    await expect(themeToggle).toHaveText("theme: auto");
    await expect(root).toHaveAttribute("data-theme", "light");
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
      .toBe("rgb(244, 245, 247)"); // --bg light: #f4f5f7
  });

  test("the density toggle flips compact/comfortable, persists, and keeps the board intact (task-board-theme-density)", async ({
    page,
  }) => {
    await page.goto(server?.url ?? "");
    const densityToggle = page.locator("#board-density-toggle");
    const card = page.locator(".board .card").first();
    await expect(card).toBeVisible();
    await expect(densityToggle).toHaveAttribute("aria-pressed", "false");
    const comfortableSize = await card.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

    await densityToggle.click();
    await expect(densityToggle).toHaveAttribute("aria-pressed", "true");
    await expect(densityToggle).toHaveText("comfortable density");
    await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
    // Compact shrinks the card text, never below 12px: readable by policy.
    const compactSize = await card.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(compactSize).toBeLessThan(comfortableSize);
    expect(compactSize).toBeGreaterThanOrEqual(12);
    // The grid survives compact: the five column sections render and no card
    // is lost. Earlier tests in this suite move the fixture's cards around,
    // so a column may legitimately be empty — the card count is the invariant.
    const cardsBefore = await page.locator(".board .card").count();
    expect(cardsBefore).toBeGreaterThan(0);
    for (const status of ["todo", "in_progress", "blocked", "done", "cancelled"]) {
      await expect(page.locator(`.column[data-status="${status}"]`)).toBeVisible();
    }
    await page.screenshot({ path: screenshotPath("board-density-compact.png"), fullPage: true });
    await expect(page.locator(".board .card")).toHaveCount(cardsBefore);

    // The choice persists across a reload, and toggling back restores comfortable.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
    await expect(densityToggle).toHaveAttribute("aria-pressed", "true");
    await densityToggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-density", "comfortable");
    await expect(densityToggle).toHaveAttribute("aria-pressed", "false");
    await expect(densityToggle).toHaveText("compact density");
  });

  test("the dark theme carries no axe violation on the ready page (task-board-theme-density)", async ({
    page,
  }) => {
    // Seed the persisted override before any page script runs, so the board
    // boots dark exactly like a returning dark-mode user — the <head> boot
    // script resolves it before first paint — and the axe scan judges the
    // dark palette itself, not a light page switched afterwards.
    await page.addInitScript(() => {
      try {
        localStorage.setItem("arggon-board-theme-v1", JSON.stringify({ theme: "dark" }));
      } catch {
        /* storage unavailable: the scan below would fail on data-theme */
      }
    });
    await page.goto(server?.url ?? "");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await axeScan(page);
  });
});

/**
 * `@smoke` leg for the tsx SOURCE path (bug-tsx-board-dead-script).
 *
 * The dist bin (`tsc` output) and the tsx run (`npm run arggon -- board`,
 * `board --serve` from source) render the SAME page through different
 * transforms — and esbuild's keepNames transform (tsx) is the one that used
 * to splice unresolvable `__name(...)` calls into the embedded function
 * sources, killing the whole page script on load. Every gate above drove
 * dist, so the defect was invisible to CI. This suite starts the server and
 * renders the static export from `cli/src/cli.ts` through the repo's tsx and
 * asserts the page is alive: zero console/page errors, the served script
 * carries no `__name(` artifact, and filter, status move, theme, density and
 * column collapse all respond — the same interactivity bar as the dist lane.
 *
 * Spawn form (bug-row-table-flake, task-e2e-board-serve-wrapper): the argv
 * comes from the shared `cli/src/test-spawn.ts` helper —
 * `node --import <tsx loader> cli/src/cli.ts` — replacing the tsx wrapper CLI
 * (`tsx/dist/cli.mjs`), which re-executes node and hosts a per-spawn IPC
 * server whose unhandled failures exit the whole chain 1 under load. The
 * loader registers the same tsx transform, so this leg still exercises the
 * keepNames surface it was written for, and the served bytes are unchanged.
 */
test.describe("@smoke board from source (tsx path, bug-tsx-board-dead-script)", () => {
  let fixture: string;
  let server: { child: ChildProcess; url: string } | undefined;

  /** Run the CLI FROM SOURCE through tsx inside the fixture. */
  function runCliTs(args: string[]): string {
    const result = spawnSync(process.execPath, [...cliNodeArgs(), ...args], {
      cwd: fixture,
      encoding: "utf8",
      timeout: 120_000,
    });
    if (result.status !== 0) {
      throw new Error(
        `tsx arggon ${args.join(" ")} failed (${result.status}): ${result.stdout ?? ""}${result.stderr ?? ""}`,
      );
    }
    return result.stdout ?? "";
  }

  /** Start `board --serve` from the tsx source path on a free port. */
  function startBoardServerTs(): Promise<{ child: ChildProcess; url: string }> {
    const child = spawn(process.execPath, [...cliNodeArgs(), "board", "--serve", "--port", "0"], {
      cwd: fixture,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return new Promise((resolvePromise, reject) => {
      let output = "";
      const timer = setTimeout(() => {
        reject(new Error(`tsx board --serve printed no URL within ${TIMEOUT_MS}ms:\n${output}`));
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

  test.beforeAll(async () => {
    fixture = createFixture();
    server = await startBoardServerTs();
    await waitForBoard(server.url);
  });

  test.afterAll(async () => {
    if (server) await stopServer(server.child);
    if (fixture) rmSync(fixture, { recursive: true, force: true });
  });

  test("the served page boots with zero errors and theme/density/collapse respond", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(server?.url ?? "");
    await expect(page.locator("h1")).toContainText("arggon board");

    // The served script must be free of keepNames artifacts (the class gate;
    // the unit-level spawn gate lives in cli/src/board.test.ts).
    const html = await (await fetch(server?.url ?? "")).text();
    expect(html).not.toContain("__name(");
    expect(html).toContain("function applyBoardFilter");

    // Theme: auto -> light -> dark (the painted surface actually flips).
    const root = page.locator("html");
    const themeToggle = page.locator("#board-theme-toggle");
    await expect(themeToggle).toHaveText("theme: auto");
    await themeToggle.click();
    await expect(themeToggle).toHaveText("theme: light");
    await themeToggle.click();
    await expect(themeToggle).toHaveText("theme: dark");
    await expect(root).toHaveAttribute("data-theme", "dark");
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
      .toBe("rgb(13, 17, 23)"); // --bg dark: #0d1117

    // Density: comfortable -> compact.
    await page.locator("#board-density-toggle").click();
    await expect(root).toHaveAttribute("data-density", "compact");

    // Column collapse (wireBoardColumns) responds and persists with the
    // theme choice across a reload — proof the wiring, not just the markup,
    // survived the transform.
    const todo = page.locator('.column[data-status="todo"]');
    await todo.locator('.col-toggle[data-status="todo"]').click();
    await expect(todo).toHaveClass(/collapsed/);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator('.column[data-status="todo"]')).toHaveClass(/collapsed/);
    await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
    expect(errors).toEqual([]);
  });

  test("a filter expression visibly filters cards", async ({ page }) => {
    await page.goto(server?.url ?? "");
    await page.locator("#board-filter-input").fill(`label:smoke`);
    await expect(page.locator(".card:not(.filtered-out)")).toHaveCount(1);
    await expect(page.locator(`.card:not(.filtered-out)[data-id="${FILTER_ITEM_ID}"]`)).toHaveCount(
      1,
    );
    await expect(page.locator("#board-filter-count")).toHaveText(
      `1 of ${cliJson<{ items: unknown[] }>(fixture, ["list"]).items.length} item(s)`,
    );
    expect(filterFromUrl(page.url())).toBe("label:smoke");
    await page.locator("#board-filter-clear").click();
    await expect(page.locator("#board-filter-input")).toHaveValue("");
  });

  test("a status move round-trips through the UI and persists", async ({ page }) => {
    // Mute the SSE stream: the move broadcasts a reload that would navigate
    // mid-assertion (same discipline as the dist-lane move tests).
    await page.route("**/events", (route) => route.abort());
    await page.goto(server?.url ?? "");
    const card = page.locator(`.card[data-id="${MOVED_ITEM_ID}"]`);
    await expect(card).toHaveAttribute("data-status", "todo");

    await card.dragTo(page.locator('.column[data-status="cancelled"]'));
    await expect(
      page.locator(`.column[data-status="cancelled"] .card[data-id="${MOVED_ITEM_ID}"]`),
    ).toHaveCount(1);
    // The ok toast only appears after the update endpoint answered, so the
    // persistence check below cannot race the POST.
    await expect(page.locator("#board-toast")).toContainText(`${MOVED_ITEM_ID} -> cancelled`);
    await expect
      .poll(
        () => cliJson<{ item: { status: string } }>(fixture, ["show", MOVED_ITEM_ID]).item.status,
      )
      .toBe("cancelled");
  });

  test("the tsx static export is script-clean and filters offline", async ({ page }) => {
    const boardFile = join(fixture, "tsx-board.html");
    runCliTs(["board", "--out", boardFile]);
    const html = readFileSync(boardFile, "utf8");
    expect(html).not.toContain("__name(");

    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(`file://${boardFile}`);
    await expect(page.locator("h1")).toContainText("arggon board");
    await page.locator("#board-filter-input").fill("Board filter task");
    await expect(page.locator(".card:not(.filtered-out)")).toHaveCount(1);
    await expect(page.locator(`.card:not(.filtered-out)[data-id="${FILTER_ITEM_ID}"]`)).toHaveCount(
      1,
    );
    expect(errors).toEqual([]);
  });
});

/**
 * bug-tree-ignores-hide-terminal-toggle: the filterbar's hide done/cancelled
 * toggle is a LAYOUT preference (it must never move the lens verdict), and it
 * covers the grouped-ancestry tree exactly like the status columns. In the tree
 * it is subtree-aware: a terminal row hides unless hiding it would orphan a
 * visible row below it (then it stays, muted, as terminal context), and a tree
 * whose composed state has no visible row left renders the same `—` empty state
 * the empty columns use. The same page script runs in the static export and on
 * the served board, so both are asserted here.
 */
test.describe("@smoke board tree terminal layout", () => {
  let fixture: string;
  let server: { child: ChildProcess; url: string } | undefined;

  test.beforeAll(async () => {
    fixture = createTreeTerminalFixture();
    server = await startBoardServer(fixture);
    await waitForBoard(server.url);
  });

  test.afterAll(async () => {
    if (server) await stopServer(server.child);
    if (fixture) rmSync(fixture, { recursive: true, force: true });
  });

  test("hide done/cancelled composes with the tree, keeps context rows and persists", async ({
    page,
  }) => {
    await page.goto(server?.url ?? "");
    const tree = page.locator("#board-tree");
    const toggle = page.locator("#board-terminal-toggle");
    const filterCount = page.locator("#board-filter-count");
    const treeCount = page.locator("#board-tree-count");
    const leaf = tree.locator(`.tree-node[data-id="${TREE_CLOSED_LEAF_ID}"]`);
    const story = tree.locator(`.tree-node[data-id="${TREE_STORY_ID}"]`);
    const openChild = tree.locator(`.tree-node[data-id="${TREE_OPEN_CHILD_ID}"]`);

    await page.locator("#board-view-toggle").click();
    await expect(tree).toBeVisible();
    // The reproducer, pinned: with the toggle OFF every terminal row renders.
    await expect(tree.locator(".tree-node:not(.filtered-out):not(.terminal-hidden)")).toHaveCount(
      6,
    );
    await expect(leaf).toBeVisible();
    await expect(story).toBeVisible();
    await expect(filterCount).toHaveText("6 item(s)");
    await expect(treeCount).toHaveText("6");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(toggle).toHaveText("show done/cancelled");
    // The preference rides the EXISTING layout state (one key, one reset).
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("arggon-board-columns-v1") || "null"),
    );
    expect(stored?.terminalHidden).toBe(true);

    // The done leaf hides; the cancelled story stays because hiding it would
    // orphan the open task under it — dimmed, not part of the lens verdict.
    await expect(leaf).toBeHidden();
    await expect(leaf).toHaveClass(/terminal-hidden/);
    await expect(story).toBeVisible();
    await expect(story).toHaveClass(/terminal-context/);
    await expect(openChild).toBeVisible();
    const storyRow = story.locator("> .tree-row");
    const openRow = openChild.locator("> .tree-row");
    const backgrounds = await Promise.all([
      storyRow.evaluate((el) => getComputedStyle(el).backgroundColor),
      openRow.evaluate((el) => getComputedStyle(el).backgroundColor),
    ]);
    expect(backgrounds[0]).not.toBe(backgrounds[1]);

    // A layout preference moves no counter: the `N of M` line and the tree
    // heading keep the lens verdict (all 6 rows still match).
    await expect(filterCount).toHaveText("6 item(s)");
    await expect(treeCount).toHaveText("6");
    // Same invariant in the columns layout: hiding both terminal columns
    // leaves the counts and the `N of M` line untouched.
    const columnCounts = await page.locator(".column .count").allTextContents();
    await page.locator("#board-view-toggle").click();
    await expect(page.locator('.column[data-status="done"]')).toBeHidden();
    await expect(page.locator('.column[data-status="cancelled"]')).toBeHidden();
    await expect(filterCount).toHaveText("6 item(s)");
    expect(await page.locator(".column .count").allTextContents()).toEqual(columnCounts);
    // The tree terminal state is a scanned surface of its own (the counts
    // above are its deterministic readiness signal).
    await page.locator("#board-view-toggle").click();
    await expect(leaf).toBeHidden();
    await axeScan(page);

    // The preference persists in the shared layout state and comes back with
    // the view: reload keeps the tree layout AND the terminal hiding.
    await page.reload();
    await expect(tree).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(leaf).toBeHidden();
    await expect(story).toHaveClass(/terminal-context/);

    // OFF restores every row live, and reset restores the default and keeps it.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(leaf).toBeVisible();
    await expect(story).not.toHaveClass(/terminal-context/);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(leaf).toBeHidden();
    await page.locator("#board-layout-reset").click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(leaf).toBeVisible();
    await expect(story).not.toHaveClass(/terminal-context/);
    const reset = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("arggon-board-columns-v1") || "null"),
    );
    expect(reset?.terminalHidden).toBe(false);
    await page.reload();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(leaf).toBeVisible();
  });

  test("the lens composes with the terminal rule and an all-hidden tree is honest", async ({
    page,
  }) => {
    await page.goto(server?.url ?? "");
    await page.locator("#board-view-toggle").click();
    const tree = page.locator("#board-tree");
    await expect(tree).toBeVisible();
    const toggle = page.locator("#board-terminal-toggle");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");

    // Lens match deep under the cancelled story: the match plus its ancestor
    // path stay — the terminal ancestor is BOTH lens context and terminal
    // context (muted), never orphaned and never counted as a match.
    await page.locator("#board-filter-input").fill(TREE_OPEN_CHILD_ID);
    await expect(tree.locator(".tree-node:not(.filtered-out):not(.terminal-hidden)")).toHaveCount(
      4,
    );
    const story = tree.locator(`.tree-node[data-id="${TREE_STORY_ID}"]`);
    await expect(story).toHaveClass(/context/);
    await expect(story).toHaveClass(/terminal-context/);
    await expect(page.locator("#board-filter-count")).toHaveText("1 of 6 item(s)");
    await expect(page.locator("#board-tree-count")).toHaveText("1");

    // The lens matches a terminal row whose whole lens path is terminal too
    // (a parentless cancelled initiative): the layout hides it, nothing else
    // is in the verdict, so the composed tree has no visible row left.
    await page.locator("#board-filter-input").fill(TREE_TERMINAL_ROOT_ID);
    await expect(tree.locator(".tree-node:not(.filtered-out):not(.terminal-hidden)")).toHaveCount(
      0,
    );
    // The counts still report the lens verdict, not the rendered rows.
    await expect(page.locator("#board-filter-count")).toHaveText("1 of 6 item(s)");
    await expect(page.locator("#board-tree-count")).toHaveText("1");
    // Nothing visible is a state, not a blank gap: the tree renders the same
    // empty placeholder an empty column uses.
    const empty = tree.locator(".tree-empty");
    await expect(empty).toBeVisible();
    await expect(empty).toHaveText("—");

    // Clearing the lens brings the rows back under the same terminal rule:
    // the leaf and the parentless terminal root stay hidden, the cancelled
    // story stays as context for the open child (4 visible rows).
    await page.locator("#board-filter-clear").click();
    await expect(empty).toHaveCount(0);
    await expect(tree.locator(".tree-node:not(.filtered-out):not(.terminal-hidden)")).toHaveCount(
      4,
    );
    await expect(page.locator("#board-filter-count")).toHaveText("6 item(s)");
  });

  test("folding composes with the terminal rule and the lens (task-tree-rows-open-detail)", async ({
    page,
  }) => {
    await page.goto(server?.url ?? "");
    await page.locator("#board-view-toggle").click();
    const tree = page.locator("#board-tree");
    await expect(tree).toBeVisible();
    const story = tree.locator(`.tree-node[data-id="${TREE_STORY_ID}"]`);
    const openChild = tree.locator(`.tree-node[data-id="${TREE_OPEN_CHILD_ID}"]`);
    const leaf = tree.locator(`.tree-node[data-id="${TREE_CLOSED_LEAF_ID}"]`);
    await page.locator("#board-terminal-toggle").click();
    await expect(story).toHaveClass(/terminal-context/);
    await expect(leaf).toBeHidden();
    await expect(openChild).toBeVisible();

    // Folding the cancelled story hides the open child but never the folded row
    // itself: the fold is a display rule under the terminal verdict, so the
    // control the user just used cannot vanish with its subtree.
    const storyToggle = story.locator("> .tree-row > .tree-toggle");
    await storyToggle.click();
    await expect(openChild).toBeHidden();
    await expect(story).toBeVisible();
    await expect(story).toHaveClass(/terminal-context/);
    // Neither mechanic moves a counter: the lens verdict keeps counting.
    await expect(page.locator("#board-filter-count")).toHaveText("6 item(s)");
    await expect(page.locator("#board-tree-count")).toHaveText("6");
    // The composed state (fold + terminal hiding) is a scanned surface of its
    // own; the counts above are its deterministic readiness signal.
    await axeScan(page);

    // A lens match inside the folded terminal branch is MARKED, not swallowed:
    // the match row stays folded away while the branch reports it honestly.
    await page.locator("#board-filter-input").fill(TREE_OPEN_CHILD_ID);
    const marker = story.locator("> .tree-row > .tree-matches");
    await expect(marker).toHaveText("1 match inside");
    await expect(openChild).toBeHidden();
    await expect(page.locator("#board-filter-count")).toHaveText("1 of 6 item(s)");
    await expect(page.locator("#board-tree-count")).toHaveText("1");
    // Expanding restores the match with both rules still applied.
    await storyToggle.click();
    await expect(openChild).toBeVisible();
    await expect(marker).toBeHidden();
    await expect(story).toHaveClass(/terminal-context/);
  });

  test("the static export hides terminal tree rows exactly like the served board", async ({
    page,
  }) => {
    const boardFile = join(fixture, "tree-terminal-board.html");
    runCli(fixture, ["board", "--group-by", "tree", "--out", boardFile]);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(`file://${boardFile}`);
    await expect(page.locator("h1")).toContainText("arggon board");
    const tree = page.locator("#board-tree");
    await expect(tree).toBeVisible();
    const leaf = tree.locator(`.tree-node[data-id="${TREE_CLOSED_LEAF_ID}"]`);
    const story = tree.locator(`.tree-node[data-id="${TREE_STORY_ID}"]`);
    await expect(leaf).toBeVisible();

    await page.locator("#board-terminal-toggle").click();
    await expect(leaf).toBeHidden();
    await expect(leaf).toHaveClass(/terminal-hidden/);
    await expect(story).toBeVisible();
    await expect(story).toHaveClass(/terminal-context/);
    await expect(page.locator("#board-filter-count")).toHaveText("6 item(s)");
    await expect(page.locator("#board-tree-count")).toHaveText("6");
    expect(errors).toEqual([]);
  });
});

/**
 * bug-tree-done-container-hides-open-work: the tree rendered a container's
 * AUTHORED status chip only, so a terminal container with open work below read
 * as a bare `done` (15 of the tracker's 84 containers are in that state). The
 * row now discloses `N open` — the count of `todo`/`in_progress`/`blocked`
 * descendants at every depth — beside that chip; the chip itself never rolls
 * up. The count is static markup computed from the complete item set, so the
 * client-side layout preferences (hide done/cancelled, a lens, a fold) can
 * never move it, and the static export renders it exactly like the served
 * board. Both are asserted here.
 */
test.describe("@smoke board tree open-descendant disclosure", () => {
  let fixture: string;
  let server: { child: ChildProcess; url: string } | undefined;

  test.beforeAll(async () => {
    fixture = createOpenDescendantFixture();
    server = await startBoardServer(fixture);
    await waitForBoard(server.url);
  });

  test.afterAll(async () => {
    if (server) await stopServer(server.child);
    if (fixture) rmSync(fixture, { recursive: true, force: true });
  });

  test("a done container discloses its open descendants and no filter moves the count", async ({
    page,
  }) => {
    await page.goto(server?.url ?? "");
    await page.locator("#board-view-toggle").click();
    const tree = page.locator("#board-tree");
    await expect(tree).toBeVisible();
    const row = (id: string) => tree.locator(`.tree-node[data-id="${id}"] > .tree-row`);
    const node = (id: string) => tree.locator(`.tree-node[data-id="${id}"]`);
    const badge = (id: string) => row(id).locator("> .tree-open");

    // The reproducer, pinned: the initiative reads `open 2 open` — the stored
    // `done` is masked by the derived display (task-board-no-done-over-open-work),
    // the disclosure sits right after the displayed chip.
    await expect(row(OPEN_ROOT_ID).locator("> .status-chip")).toHaveText("open");
    await expect(node(OPEN_ROOT_ID)).toHaveAttribute("data-status", "done");
    await expect(node(OPEN_ROOT_ID)).toHaveAttribute("data-display-status", "open");
    await expect(badge(OPEN_ROOT_ID)).toHaveText("2 open");
    // The whole path discloses the same subtree count, three levels down from
    // the initiative — a direct-children count would have answered 0 there.
    await expect(badge(OPEN_EPIC_ID)).toHaveText("2 open");
    await expect(badge(OPEN_STORY_ID)).toHaveText("2 open");
    // The `done` story with the open leaf follow-ups is the acceptance's own
    // case: its chip reads `open`, not the stored `done`.
    await expect(row(OPEN_STORY_ID).locator("> .status-chip")).toHaveText("open");
    await expect(node(OPEN_STORY_ID)).toHaveAttribute("data-status", "done");
    await expect(node(OPEN_STORY_ID)).toHaveAttribute("data-display-status", "open");
    // The accessible name carries the DISPLAYED state and the disclosure on the
    // interactive row: never `done` over open work.
    await expect(row(OPEN_ROOT_ID)).toHaveAttribute(
      "aria-label",
      /^initiative tree-done-root: Tree done root \(open, 2 open descendants\)$/,
    );
    // A done container whose whole subtree is terminal keeps its authored chip
    // and discloses nothing, and neither do the leaves — open, done or cancelled.
    await expect(row(CLEAN_EPIC_ID).locator("> .status-chip")).toHaveText("done");
    await expect(node(CLEAN_EPIC_ID)).not.toHaveAttribute("data-display-status", /.+/);
    await expect(row(CLEAN_EPIC_ID).locator("> .tree-open")).toHaveCount(0);
    await expect(row(CLEAN_STORY_ID).locator("> .tree-open")).toHaveCount(0);
    await expect(row(OPEN_TASK_ID).locator("> .tree-open")).toHaveCount(0);
    await expect(row(OPEN_DONE_TASK_ID).locator("> .tree-open")).toHaveCount(0);
    await expect(row(OPEN_CANCELLED_BUG_ID).locator("> .tree-open")).toHaveCount(0);

    // Hide done/cancelled: a masked container READS OPEN, so it is not a
    // terminal row at all — it stays visible at full strength (never muted
    // terminal-context, never hidden) and the disclosure does not move.
    await page.locator("#board-terminal-toggle").click();
    await expect(node(OPEN_STORY_ID)).toBeVisible();
    await expect(node(OPEN_STORY_ID)).not.toHaveClass(/terminal-context/);
    await expect(node(OPEN_STORY_ID)).not.toHaveClass(/terminal-hidden/);
    await expect(node(OPEN_ROOT_ID)).not.toHaveClass(/terminal-context/);
    await expect(badge(OPEN_ROOT_ID)).toHaveText("2 open");
    await expect(badge(OPEN_STORY_ID)).toHaveText("2 open");
    // The all-terminal container hides (nothing visible hangs below it).
    await expect(row(CLEAN_EPIC_ID)).toBeHidden();
    // Columns render only task/bug leaves; containers (story/initiative) live
    // in the tree view and no longer appear as flat cards. Terminal-hide is on,
    // so every done/cancelled leaf is hidden and its column hides whole.
    await page.locator("#board-view-toggle").click();
    await expect(page.locator('.column[data-status="done"]')).toBeHidden();
    await expect(page.locator(`.card[data-id="${OPEN_STORY_ID}"]`)).toHaveCount(0);
    await expect(page.locator(`.card[data-id="${OPEN_ROOT_ID}"]`)).toHaveCount(0);
    await expect(page.locator(`.card[data-id="${OPEN_DONE_TASK_ID}"]`)).toBeHidden();
    await expect(page.locator('.column[data-status="cancelled"]')).toBeHidden();
    await page.locator("#board-view-toggle").click();
    await expect(tree).toBeVisible();

    // A fold hides the subtree, never the disclosure on the folded row.
    const rootToggle = row(OPEN_ROOT_ID).locator("> .tree-toggle");
    await rootToggle.click();
    await expect(tree.locator(`.tree-node[data-id="${OPEN_STORY_ID}"]`)).toBeHidden();
    await expect(rootToggle).toHaveAttribute("aria-expanded", "false");
    await expect(badge(OPEN_ROOT_ID)).toHaveText("2 open");
    await rootToggle.click();
    await expect(tree.locator(`.tree-node[data-id="${OPEN_STORY_ID}"]`)).toBeVisible();

    // A lens narrows the rows to one match plus its context path; the masked
    // container is lens context but still NOT terminal context (it reads open),
    // and the disclosure is the subtree's truth, not the lens verdict (the
    // `N of M` counter stays the verdict).
    await page.locator("#board-filter-input").fill(OPEN_TASK_ID);
    await expect(node(OPEN_STORY_ID)).toHaveClass(/context/);
    await expect(node(OPEN_STORY_ID)).not.toHaveClass(/terminal-context/);
    await expect(badge(OPEN_ROOT_ID)).toHaveText("2 open");
    await expect(badge(OPEN_STORY_ID)).toHaveText("2 open");
    await expect(page.locator("#board-filter-count")).toHaveText("1 of 10 item(s)");
    await expect(page.locator("#board-tree-count")).toHaveText("1");
    // The composed state (lens + terminal + fold) is a scanned surface of its
    // own; the assertions above are its deterministic readiness signal.
    await axeScan(page);
    await page.locator("#board-filter-clear").click();
    await page.locator("#board-terminal-toggle").click();
    await expect(badge(OPEN_ROOT_ID)).toHaveText("2 open");
    await expect(row(CLEAN_EPIC_ID)).toBeVisible();
  });

  test("the static export carries the same disclosure (bug-tree-done-container-hides-open-work)", async ({
    page,
  }) => {
    const boardFile = join(fixture, "tree-open-board.html");
    runCli(fixture, ["board", "--group-by", "tree", "--out", boardFile]);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(`file://${boardFile}`);
    await expect(page.locator("h1")).toContainText("arggon board");
    const tree = page.locator("#board-tree");
    await expect(tree).toBeVisible();
    const row = (id: string) => tree.locator(`.tree-node[data-id="${id}"] > .tree-row`);
    const badge = (id: string) => row(id).locator("> .tree-open");

    await expect(badge(OPEN_ROOT_ID)).toHaveText("2 open");
    await expect(badge(OPEN_STORY_ID)).toHaveText("2 open");
    // The derived display ships offline exactly like on the served board.
    await expect(row(OPEN_ROOT_ID).locator("> .status-chip")).toHaveText("open");
    await expect(row(CLEAN_EPIC_ID).locator("> .status-chip")).toHaveText("done");
    await expect(row(CLEAN_EPIC_ID).locator("> .tree-open")).toHaveCount(0);

    // The same layout preferences, offline: folding and hiding terminal rows
    // leave the disclosure untouched, and a masked container is never hidden
    // (it reads open, not terminal).
    await row(OPEN_ROOT_ID).locator("> .tree-toggle").click();
    await expect(tree.locator(`.tree-node[data-id="${OPEN_STORY_ID}"]`)).toBeHidden();
    await expect(badge(OPEN_ROOT_ID)).toHaveText("2 open");
    await page.locator("#board-terminal-toggle").click();
    await expect(badge(OPEN_ROOT_ID)).toHaveText("2 open");
    await expect(tree.locator(`.tree-node[data-id="${OPEN_ROOT_ID}"]`)).toBeVisible();
    await expect(tree.locator(`.tree-node[data-id="${OPEN_ROOT_ID}"]`)).not.toHaveClass(
      /terminal-context/,
    );
    await expect(row(CLEAN_EPIC_ID)).toBeHidden();
    expect(errors).toEqual([]);
  });
});
