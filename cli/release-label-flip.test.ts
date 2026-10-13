/**
 * Release label flip (bug-autorelease-label-lifecycle-unowned).
 *
 * `cli/release-label-flip.mjs` is the piece of release-please's bookkeeping this
 * repo owes itself because it opted out of release-please's tagging path
 * (`skip-github-release: true`): after `release.yml` creates the tag, a merged
 * release PR must stop carrying `autorelease: pending`, or release-please reads
 * it as a merged-but-untagged release and aborts — the deadlock that killed
 * releases 2026-10-02 → 2026-10-07 (#556) and struck again on #664
 * (2026-10-09 → 2026-10-12).
 *
 * These tests inject a fake `gh` on GH_BIN and drive every path offline:
 *
 *   - no-op: nothing merged carries the label -> exit 0, one query, no edit —
 *     the rule-0/rule-2 path that runs on every ordinary push;
 *   - flip: a merged pending PR is moved to `autorelease: tagged` with EXACTLY
 *     the command the manual recovery documents, then verified against the PR
 *     object itself (`gh pr view <n> --json labels`) — never against the
 *     search-index query, whose lag warned on the healthy v0.7.0 flip of #744
 *     (bug-release-label-flip-verification-index-lag, run 38296293861);
 *   - warn-and-continue: a failed query, a failed edit, or a label that
 *     survives the flip exits 0 with the manual recovery in the message. This
 *     step sits before the publish: it must never be able to strand a tagged
 *     release, and the release-please backstop is the detector.
 *
 * The second describe block pins the workflow contract: the flip runs in
 * `release.yml` (the workflow that tags), right after the tag↔version
 * agreement step and before anything ships, under the documented minimal
 * `pull-requests: write` permission.
 */
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { removeFixtureTree } from "./src/test-tmp.js";
import { assertOrder } from "../test/assert-order.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const flipPath = join(repoRoot, "cli", "release-label-flip.mjs");

const PENDING = "autorelease: pending";
const TAGGED = "autorelease: tagged";
const MANUAL_RECOVERY = `gh pr edit <n> --add-label "${TAGGED}" --remove-label "${PENDING}"`;

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) removeFixtureTree(dir);
});

/** One canned `gh` invocation. */
type GhCall = { stdout?: string; status?: number; stderr?: string };

/**
 * A fake `gh` serving a QUEUE of canned responses: invocation N reads out.N,
 * err.N and code.N, and records its argv one-argument-per-line in argv.N. Hermetic
 * — no network, no real gh — and a test that expects three calls but causes a
 * fourth fails loudly on the missing `out.4` instead of silently passing.
 */
function makeGh(calls: GhCall[]): { bin: string; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), "arggon-release-label-flip-"));
  tmpDirs.push(dir);
  calls.forEach((call, index) => {
    const n = index + 1;
    writeFileSync(join(dir, `out.${n}`), call.stdout ?? "");
    writeFileSync(join(dir, `err.${n}`), call.stderr ?? "");
    writeFileSync(join(dir, `code.${n}`), String(call.status ?? 0));
  });
  const script = [
    "#!/bin/sh",
    'dir="$(dirname "$0")"',
    'n=$(( $(cat "$dir/count" 2>/dev/null || echo 0) + 1 ))',
    `printf '%s' "$n" > "$dir/count"`,
    `printf '%s\\n' "$@" > "$dir/argv.$n"`,
    `cat "$dir/out.$n"`,
    `cat "$dir/err.$n" >&2`,
    `exit "$(cat "$dir/code.$n")"`,
    "",
  ].join("\n");
  const bin = join(dir, "gh");
  writeFileSync(bin, script);
  chmodSync(bin, 0o755);
  return { bin, dir };
}

/** The argv of each recorded invocation, in order. */
function invocations(dir: string): string[][] {
  let count = 0;
  try {
    count = Number(readFileSync(join(dir, "count"), "utf8"));
  } catch {
    return [];
  }
  return Array.from({ length: count }, (_, index) =>
    readFileSync(join(dir, `argv.${index + 1}`), "utf8")
      .split("\n")
      .filter((line) => line !== ""),
  );
}

function runFlip(bin: string, extraArgs: string[] = [], extraEnv: Record<string, string> = {}) {
  return spawnSync("node", [flipPath, "--repo", "Arggon/ArggonManager", ...extraArgs], {
    encoding: "utf8",
    env: { ...process.env, GH_BIN: bin, ...extraEnv },
  });
}

/** What `gh pr view <n> --json labels` prints for the given label names. */
function labelsJson(names: string[]): string {
  return `${JSON.stringify({ labels: names.map((name) => ({ name })) })}\n`;
}

/**
 * A fake `gh` that answers by COMMAND SHAPE, not by call order — the shape the
 * search-index bug needs pinned. `pr list` keeps answering from a search index
 * that never catches up (the lag is what warned on the healthy #744 flip, run
 * 38296293861), while the authoritative per-PR read (`pr view <n> --json
 * labels`) reports the label state the test sets. An invocation it does not
 * recognise fails loudly, and every argv is recorded like `makeGh` records it.
 */
function makeIndexLagGh(options: { search: string; labels: Record<number, string[]> }): {
  bin: string;
  dir: string;
} {
  const dir = mkdtempSync(join(tmpdir(), "arggon-release-label-flip-"));
  tmpDirs.push(dir);
  writeFileSync(join(dir, "search"), options.search);
  for (const [number, names] of Object.entries(options.labels)) {
    writeFileSync(join(dir, `labels.${number}`), labelsJson(names));
  }
  const script = [
    "#!/bin/sh",
    'dir="$(dirname "$0")"',
    'n=$(( $(cat "$dir/count" 2>/dev/null || echo 0) + 1 ))',
    `printf '%s' "$n" > "$dir/count"`,
    `printf '%s\\n' "$@" > "$dir/argv.$n"`,
    'case "$1 $2" in',
    '  "pr list") cat "$dir/search" ;;',
    '  "pr view") f="$dir/labels.$3"; if [ -f "$f" ]; then cat "$f"; else echo "fake gh: no labels fixture for PR #$3" >&2; exit 1; fi ;;',
    '  "pr edit") : ;;',
    '  *) echo "fake gh: unexpected invocation: $*" >&2; exit 1 ;;',
    "esac",
    "",
  ].join("\n");
  const bin = join(dir, "gh");
  writeFileSync(bin, script);
  chmodSync(bin, 0o755);
  return { bin, dir };
}

const STUCK_664 = JSON.stringify([
  { number: 664, title: "chore: release main", headRefName: "release-please--branches--main" },
]);

const STUCK_744 = JSON.stringify([
  { number: 744, title: "chore: release main", headRefName: "release-please--branches--main" },
]);

const VIEW_664 = ["pr", "view", "664", "--repo", "Arggon/ArggonManager", "--json", "labels"];

describe("release-label-flip (bug-autorelease-label-lifecycle-unowned)", () => {
  it("queries release-please's abort predicate: merged PRs still pending the autorelease label", () => {
    const { bin, dir } = makeGh([{ stdout: "[]\n" }]);
    const result = runFlip(bin);
    expect(result.status).toBe(0);
    expect(invocations(dir)[0]).toEqual(
      expect.arrayContaining([
        "pr",
        "list",
        "--state",
        "merged",
        "--label",
        PENDING,
        "--limit",
        "200",
      ]),
    );
  });

  it("no-op path: nothing pending -> exit 0, one query, no edit (every rule-0/rule-2 run)", () => {
    const { bin, dir } = makeGh([{ stdout: "[]\n" }]);
    const result = runFlip(bin);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("nothing to flip");
    expect(result.stdout).toContain("OK");
    // The flip is never attempted when the predicate is empty — this is what
    // makes it safe on every ordinary push.
    expect(invocations(dir).map((argv) => argv[1])).toEqual(["list"]);
  });

  it("flip path: moves the merged pending PR to `autorelease: tagged` and reads the PR back to verify", () => {
    const { bin, dir } = makeGh([
      { stdout: `${STUCK_664}\n` },
      {},
      { stdout: labelsJson([TAGGED]) },
    ]);
    const result = runFlip(bin);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("#664");
    expect(result.stdout).toContain(TAGGED);
    expect(result.stdout).toContain("release-please is not aborting");
    const calls = invocations(dir);
    // Call 2 IS the documented manual recovery (same command, same flags), so
    // the automation and the operator instruction cannot drift.
    expect(calls[1]).toEqual([
      "pr",
      "edit",
      "664",
      "--repo",
      "Arggon/ArggonManager",
      "--add-label",
      TAGGED,
      "--remove-label",
      PENDING,
    ]);
    // Call 3 reads the PR OBJECT back (`pr view`), not the search query whose
    // index lags the edit (bug-release-label-flip-verification-index-lag).
    expect(calls[2]).toEqual(VIEW_664);
  });

  it("flips every stuck PR, not just the first", () => {
    const two = JSON.stringify([
      { number: 556, title: "chore: release 0.6.0", headRefName: "release-please--branches--main" },
      { number: 664, title: "chore: release main", headRefName: "release-please--branches--main" },
    ]);
    const { bin } = makeGh([
      { stdout: `${two}\n` },
      {},
      { stdout: labelsJson([TAGGED]) },
      {},
      { stdout: labelsJson([TAGGED]) },
    ]);
    const result = runFlip(bin);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("#556");
    expect(result.stdout).toContain("#664");
    expect(result.stdout).toContain("flipped 2 merged release PR(s)");
  });

  it("a failed flip warns with the manual recovery, exits 0, and never strands the release", () => {
    // The step sits BEFORE the publish: exit 0 is the whole contract here.
    // The label is read back even after a failed edit (a partial edit can still
    // leave it pending), and the failure is reported either way.
    const { bin } = makeGh([
      { stdout: `${STUCK_664}\n` },
      { status: 1, stderr: "HTTP 403: Resource not accessible by integration\n" },
      { stdout: labelsJson([PENDING]) },
    ]);
    const result = runFlip(bin);
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("release-label-flip: WARNING");
    expect(result.stderr).toContain("could not flip #664");
    expect(result.stderr).toContain("Resource not accessible by integration");
    expect(result.stderr).toContain("still 'autorelease: pending' on 1 merged release PR(s)");
    expect(result.stderr).toContain(MANUAL_RECOVERY);
  });

  it("a label that survives the flip warns that release-please WILL abort, and names the recovery", () => {
    const { bin } = makeGh([
      { stdout: `${STUCK_664}\n` },
      {},
      // The edit claimed success but the PR still carries the label — the
      // authoritative per-PR read, not the edit's exit code, decides the verdict.
      { stdout: labelsJson([PENDING]) },
    ]);
    const result = runFlip(bin);
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("still 'autorelease: pending' on 1 merged release PR(s)");
    expect(result.stderr).toContain("#664");
    expect(result.stderr).toContain(MANUAL_RECOVERY);
  });

  it("a healthy flip whose search index still lags reports no warning at all", () => {
    // The live shape (v0.7.0, run 38296293861): the edit succeeds, and the
    // search query — however often it is asked — still lists #744 as pending,
    // while the PR object itself is already `tagged`. No crying wolf.
    const { bin, dir } = makeIndexLagGh({
      search: `${STUCK_744}\n`,
      labels: { 744: [TAGGED] },
    });
    const result = runFlip(bin);
    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("WARNING");
    expect(result.stdout).toContain("release-please is not aborting");
    const calls = invocations(dir);
    // The flip really happened, and the verdict came from the PR object.
    expect(calls[1]).toEqual(expect.arrayContaining(["pr", "edit", "744"]));
    expect(calls.some((argv) => argv[0] === "pr" && argv[1] === "view" && argv[2] === "744")).toBe(
      true,
    );
  });

  it("under that same lagging search, a label the PR really still carries still warns and names the recovery", () => {
    // The mirror of the test above: the index lag must not mask a genuinely
    // stuck label either — the per-PR read is `pending`, so the warning stands.
    const { bin } = makeIndexLagGh({
      search: `${STUCK_744}\n`,
      labels: { 744: [PENDING] },
    });
    const result = runFlip(bin);
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("still 'autorelease: pending' on 1 merged release PR(s)");
    expect(result.stderr).toContain("#744");
    expect(result.stderr).toContain(MANUAL_RECOVERY);
  });

  it("a gh query failure warns and exits 0 without attempting an edit", () => {
    const { bin, dir } = makeGh([{ status: 1, stderr: "HTTP 503\n" }]);
    const result = runFlip(bin);
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("release-label-flip: WARNING");
    expect(result.stderr).toContain("could not query");
    expect(invocations(dir).map((argv) => argv[1])).toEqual(["list"]);
  });

  it("unparseable query output warns and exits 0", () => {
    const { bin } = makeGh([{ stdout: "not-json\n" }]);
    const result = runFlip(bin);
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("could not parse");
  });

  it("an unverifiable flip (the per-PR read fails) warns instead of claiming success", () => {
    const { bin } = makeGh([{ stdout: `${STUCK_664}\n` }, {}, { status: 1, stderr: "HTTP 500\n" }]);
    const result = runFlip(bin);
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("could not re-query to verify #664");
    expect(result.stderr).toContain("could not verify 1 merged release PR(s)");
    expect(result.stderr).toContain(MANUAL_RECOVERY);
    expect(result.stdout).not.toContain("release-please is not aborting");
  });

  it("an unreadable per-PR payload ([null]) warns instead of claiming a clean release", () => {
    // `pr view` may exit 0 with a payload the script cannot read. Treating that
    // as "cleared" would be the false green this script must never print; the
    // unreadable read is counted as unverified and reported.
    const { bin } = makeGh([{ stdout: `${STUCK_664}\n` }, {}, { stdout: "[null]\n" }]);
    const result = runFlip(bin);
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("could not re-query to verify #664");
    expect(result.stderr).toContain("could not verify 1 merged release PR(s)");
    expect(result.stderr).toContain(MANUAL_RECOVERY);
    expect(result.stdout).not.toContain("release-please is not aborting");
  });

  it("a malformed discovery payload ([null]) warns and still exits 0 — the contract is absolute", () => {
    // A payload entry read before any edit; an unguarded dereference would throw
    // and exit non-zero, contradicting the exit-0 contract, and an entry the
    // script cannot read keeps the summary from claiming the release is clean
    // (fail closed for the warning, never the run). The flip loop already guards
    // `pr.number`; the renderer must be equally defensive.
    const { bin, dir } = makeGh([{ stdout: "[null]\n" }]);
    const result = runFlip(bin);
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("release-label-flip: WARNING");
    expect(result.stderr).toContain("skipping a malformed entry");
    expect(result.stderr).toContain("still 'autorelease: pending' on 1 merged release PR(s)");
    // Rendered defensively, not dereferenced: no number, no title -> placeholders.
    expect(result.stderr).toContain("  #? (untitled)");
    expect(result.stderr).toContain(MANUAL_RECOVERY);
    // Nothing was flipped on a payload the script cannot read.
    expect(invocations(dir).map((argv) => argv[1])).toEqual(["list"]);
  });

  it("accepts the repository from GITHUB_REPOSITORY when --repo is absent", () => {
    const { bin } = makeGh([{ stdout: "[]\n" }]);
    const result = spawnSync("node", [flipPath], {
      encoding: "utf8",
      env: { ...process.env, GH_BIN: bin, GITHUB_REPOSITORY: "Arggon/ArggonManager" },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("nothing to flip");
  });

  it("a missing repository warns and exits 0 — bookkeeping must not fail the publish run", () => {
    const { bin } = makeGh([{ stdout: "[]\n" }]);
    const result = spawnSync("node", [flipPath], {
      encoding: "utf8",
      env: { ...process.env, GH_BIN: bin, GITHUB_REPOSITORY: "" },
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("no repository");
    expect(result.stderr).toContain(MANUAL_RECOVERY);
  });
});

describe("the release.yml flip step (workflow contract)", () => {
  const workflowPath = join(repoRoot, ".github", "workflows", "release.yml");
  const workflow = readFileSync(workflowPath, "utf8");

  /** The YAML block of the step whose `name:` is given, up to the next step. */
  function stepBlock(name: string): string {
    const start = workflow.indexOf(`- name: ${name}`);
    if (start === -1) throw new Error(`release.yml has no step named "${name}"`);
    const next = workflow.indexOf("\n      - ", start + 1);
    return next === -1 ? workflow.slice(start) : workflow.slice(start, next);
  }

  it("runs in the tagging workflow, after the tag↔version agreement and before anything ships", () => {
    // The ownership decision (option (a), recorded on the item): the workflow
    // that creates the tag flips the label, in the same run, so the window
    // between the tag and the flip is as short as the run allows. A run that
    // dies before the flip is caught by the release-please backstop.
    // The agreement step's root==lib half moved BEFORE the tag
    // (bug-release-proposal-non-lockstep-undetected); this ordering — tag, then
    // agreement, then flip — is unchanged.
    assertOrder(
      workflow,
      `- name: Create the annotated tag v(V) at the pushed commit`,
      `- name: Assert tag-version agreement`,
      `node cli/release-label-flip.mjs --repo "$GITHUB_REPOSITORY"`,
      `- name: GitHub Release v(V) with the merged CHANGELOG section as notes`,
      `node cli/publish-auth-hint.mjs --package "@arggondev/lib"`,
    );
  });

  it("runs only on the release commit (guard release == true) and passes the token", () => {
    const block = stepBlock(
      "Flip the merged release PR's label (release-please bookkeeping this run owns)",
    );
    expect(block).toContain("if: steps.guard.outputs.release == 'true'");
    expect(block).toContain("GH_TOKEN: ${{ github.token }}");
    expect(block).toContain("GITHUB_REPOSITORY: ${{ github.repository }}");
  });

  it("grants the documented minimal permission for PR labels: pull-requests: write", () => {
    // GitHub's GITHUB_TOKEN permission table (docs.github.com → Workflow syntax
    // → permissions): `pull-requests: write` "permits an action to add a label
    // to a pull request". `gh pr edit` applies labels with the GraphQL
    // addLabelsToLabelable/removeLabelsFromLabelable mutations (not the REST
    // /issues/{n}/labels endpoints), and its PR read no longer needs a
    // repository-projects grant on github.com (cli/cli#8784 → #10714/#13280).
    // `contents: write` (tag/release) and `id-token: write` (OIDC) stay as they
    // were.
    expect(workflow).toMatch(/^permissions:\n(?:.*\n)*? {2}pull-requests: write$/m);
    expect(workflow).toContain("contents: write");
    expect(workflow).toContain("id-token: write");
  });
});
