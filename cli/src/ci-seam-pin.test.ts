/**
 * Seam-pin guard (task-ci-seam-pin-tracks-release).
 *
 * `.github/workflows/arggon.yml` pins `ARGGON_VERSION` as a literal and uses
 * it two ways: the registry install
 * (`npm install -g "arggon-manager@$ARGGON_VERSION"`), and the drift gate's
 * **pinned-lag assertion** — no committed `x-generated` `arggonVersion` stamp
 * may be newer than the pin.
 *
 * Since bug-seam-drift-gate-blocks-new-generated-seam-content the byte
 * comparison is NOT against the pin in this repo: the drift gate regenerates
 * with the checkout's OWN build when the checkout is the seam's source (so a
 * feature PR that adds generated content can go green), and with the pinned
 * release everywhere else (every adopter — their only generator). What changed
 * for the pin is the ASSERTION, not the install: the #527 incident (the seam
 * was regenerated with 0.4.1 while the pin still said 0.4.0) is now caught by
 * the stamp comparison in the drift step instead of by a dirty byte diff, and
 * the remedy is the same manual re-pin (release runbook Gotchas: "Re-pin the
 * seam check").
 *
 * This test pins the invariant that keeps the drift gate green: the literal
 * pin must never lag the newest `arggonVersion` stamp in
 * `ArggonManager/.convention.yml` — the newest version whose `init` actually
 * rewrote committed seam bytes (a stamp moves only when a generated doc's bytes
 * change, so a template-less patch release does not move it).
 *
 * Why NOT derive the pin from `package.json` in the workflow (the approach
 * ADR 0018's parenthetical mentions): the install is a registry pin, and the
 * release flow bumps `package.json` (step 1, one `chore(release)` commit on
 * main) BEFORE the publish (step 3) — between the two, the bumped version
 * does not exist on the registry. A derived pin turns `tasks-validate` red
 * on main on every release, and on the release PR too once publishing moves
 * into a release-PR pipeline (ADR 0018): that PR runs CI pre-merge,
 * pre-publish. That trades the rare manual re-pin (#527) for a guaranteed
 * red window — the exact outage class this item exists to prevent. The
 * shipped template cannot derive either: an adopter's `package.json`
 * version is unrelated to arggon releases. The literal pin plus this guard
 * stays green through the whole documented release flow:
 *
 *   state                                          pin   package.json  seam stamps  verdict
 *   --------------------------------------------  ----  ------------  -----------  ---------------------------------
 *   mid-cycle (== last release)                    V     V             V            green
 *   release bump / pre-publish window              V     V+1           V            green
 *   post-publish, pre-re-pin                       V     V+1           V            green
 *   re-pin (pin moved + seam regen)                V+1   V+1           V+1          green
 *   template-less patch re-pin                     V+1   V+1           V            green
 *   #527: seam regenerated, pin stale              V     V+1           V+1          RED — bump the pin
 *   #527, release bump landed too                  V     V             V+1          RED — bump the pin
 *
 * The `package.json` column is CONTEXT, not an input: no row's verdict depends
 * on it (last row below explains why that is the point, not an oversight). The
 * opposite drift — the pin moved without regenerating the seam — is not this
 * predicate's business either (the pin ahead of the stamps is the documented
 * template-less-patch case above). In this repo the byte comparison belongs to
 * the branch-local path: the drift gate regenerates with this checkout's own
 * build and requires a clean tree, which catches a pin that moved without a
 * seam regen only insofar as the SEAM disagrees with the SOURCE, not with the
 * pin.
 *
 * **ONE RULE, TWO SURFACES (bug-ci-seam-pin-shell-vs-test-copy-divergence,
 * closed).** The rule of record is the drift step's pinned-lag CLAUSE in the
 * workflow template; `pinLagsSeam()` below is its TypeScript transcription, and
 * the `pin-lag parity` block below executes that clause — lifted out of BOTH
 * workflow copies, not remembered — against the predicate over a corpus. Two
 * consequences that used to be invisible:
 *
 *   - The predicate USED to carry an extra `pin !== pkgVersion` conjunct the
 *     clause does not have, so a state the shell copy flagged RED was green
 *     here — the "green because the other copy was tested" hole, pointed at
 *     ourselves. It is gone, for two reasons that the corpus rows make
 *     checkable rather than arguable. (1) No documented release-flow state
 *     needs it: every green row above stays green without it (that was the
 *     conjunct's stated justification, and the table refutes it). (2) It
 *     silenced the lag signal in exactly the state the clause exists to
 *     catch — a stamp newer than the pin while `package.json` equals the pin
 *     (the last row, reachable whenever a contributor's installed `arggon`
 *     is newer than their branch and they run `arggon init`). And it could
 *     not have been "closed" by pasting it into the shell copy: the clause
 *     cannot read `package.json` because an ADOPTER's version is unrelated
 *     to the arggon pin, so pasted in, every adopter whose version happens
 *     to coincide with the pin literal would have the #527 gate switch off
 *     for them and ship the outage silently. The clause is the stricter
 *     predicate and it is the one that decides `tasks-validate`.
 *
 * So the rule deliberately does NOT read `package.json`'s version — named here
 * so a future edit cannot re-add it as "obviously also true". Equally out of
 * scope, and for the same reason (not this predicate's business): byte
 * equality of the seam against the pin, and the pin sitting AHEAD of the
 * stamps. `ArggonManager/docs/ci.md` §Where the rule of record lives states
 * the same split for humans.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const WORKFLOW = join(root, ".github/workflows/arggon.yml");
const WORKFLOW_TEMPLATE = join(root, "templates/docs/github/workflows/arggon.yml");
const GENERATED_STATE = join(root, "ArggonManager/.convention.yml");
const PACKAGE_JSON = join(root, "package.json");

/** The derivation this item REJECTED — its return must stay a red test. */
const DERIVE_PIN = `node -p "require('./package.json').version"`;
const INSTALL_PIN = `npm install -g "arggon-manager@$ARGGON_VERSION"`;

/**
 * The drift step's pinned-lag clause, as one line of shell — the rule of record,
 * spelled out so the parity block below can assert it executes THIS text and not
 * a lookalike. Byte-for-byte the two workflow copies' clause (they are checked
 * equal to each other too). Changing the rule means changing this constant, both
 * workflow copies, and `ArggonManager/docs/ci.md` in the same change.
 */
const LAG_CLAUSE = `if [ -n "$newest" ] && [ "$(printf '%s\\n%s\\n' "$newest" "$ARGGON_VERSION" | sort -V | tail -1)" != "$ARGGON_VERSION" ]; then`;

/** First `ARGGON_VERSION: "X.Y.Z"` literal in a workflow. */
function readPin(workflow: string): string | undefined {
  return /^\s*ARGGON_VERSION:\s*["']?(\d+\.\d+\.\d+)["']?\s*$/m.exec(workflow)?.[1];
}

/**
 * Every per-doc `arggonVersion` stamp in the generated state. Hand-rolled on
 * purpose: the repo has no YAML parser dependency (same trade as
 * `workflowRunSteps` in headless-ci.test.ts), and the stamps are flat
 * `key: "X.Y.Z"` entries under `x-generated`.
 */
function readSeamStamps(state: string): string[] {
  return [...state.matchAll(/^\s+arggonVersion:\s*["']?(\d+\.\d+\.\d+)["']?\s*$/gm)].map(
    (match) => match[1]!,
  );
}

/** Numeric `MAJOR.MINOR.PATCH` comparison (no dependencies); -1 | 0 | 1. */
function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return (pa[i] ?? 0) < (pb[i] ?? 0) ? -1 : 1;
  }
  return 0;
}

/** Newest stamp, mirroring the clause's `sort -V | tail -1`; "" when there is none. */
function newestOf(stamps: string[]): string {
  return stamps.reduce((a, b) => (a === "" || compareVersions(b, a) > 0 ? b : a), "");
}

/**
 * The drift step's pinned-lag clause, lifted out of a workflow copy verbatim and
 * folded back into the single line bash sees (`\` continuations joined), so what
 * the parity block executes is the shipped shell rather than a restatement of it.
 * Throws when the shape is not found: a restructure of the clause must fail
 * loudly here instead of silently stopping being compared.
 */
function extractLagClause(workflow: string): string {
  const lines = workflow.split("\n");
  const start = lines.findIndex((line) => line.trimStart().startsWith('if [ -n "$newest" ]'));
  if (start < 0) {
    throw new Error(
      `no pinned-lag clause (an 'if [ -n "$newest" ] …' line) in this workflow — the clause ` +
        `was restructured; update LAG_CLAUSE, extractLagClause and the ` +
        `ArggonManager/docs/ci.md drift-step description in the same change`,
    );
  }
  const parts: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i]!.trim();
    parts.push(line.endsWith("\\") ? line.slice(0, -1).trimEnd() : line);
    if (!line.endsWith("\\")) break;
  }
  const clause = parts.join(" ");
  if (!clause.startsWith('if [ -n "$newest" ]') || !clause.endsWith("; then")) {
    throw new Error(`the pinned-lag clause did not parse as one shell 'if': ${clause}`);
  }
  return clause;
}

/**
 * The clause's verdict, executed: `bash` with `newest`/`ARGGON_VERSION` in the
 * environment exactly as the runner supplies them, and a marker echo as the
 * `then` body so only the branch the clause took is read. `bash -e` and GNU
 * `sort -V` are what `ubuntu-latest` gives the drift step too — the parity is
 * only worth anything if it runs the same shell the gate does.
 */
function shellLagFires(clause: string, pin: string, newest: string): boolean {
  const run = spawnSync("bash", ["-c", `${clause} echo __arggon_pin_lag__; fi`], {
    encoding: "utf8",
    env: { ...process.env, ARGGON_VERSION: pin, newest },
  });
  if (run.status !== 0) throw new Error(`the shipped pinned-lag clause failed: ${run.stderr}`);
  return run.stdout.includes("__arggon_pin_lag__");
}

/**
 * The `newest` the drift step hands the clause: `grep … | sort -V | tail -1` over
 * the stamps, executed. Version sort is not lexicographic (`0.10.0` beats
 * `0.9.0`) and not `compareVersions`, so the row that could tell those apart is
 * in the corpus and the derivation is run rather than assumed.
 */
function shellNewest(stamps: string[]): string {
  const run = spawnSync(
    "bash",
    ["-c", `printf '%s\\n' "$@" | sort -V | tail -1`, "sort", ...stamps],
    {
      encoding: "utf8",
    },
  );
  if (run.status !== 0) throw new Error(`sort -V failed: ${run.stderr}`);
  return run.stdout.trim();
}

/**
 * The lag predicate: the drift step's clause, transcribed. Extracted so the
 * verdict table can assert the RED case (#527's shape) directly — the file-based
 * test at the bottom can only witness the tree's current, green state.
 *
 * @precondition `pin` is `MAJOR.MINOR.PATCH` (the file-based test asserts the
 *   pin's shape before calling); `stamps` MAY be empty, which the clause's
 *   `[ -n "$newest" ]` guard treats as "no committed stamps, nothing to compare".
 */
export function pinLagsSeam(pin: string, stamps: string[]): boolean {
  const newest = newestOf(stamps);
  return newest !== "" && compareVersions(pin, newest) < 0;
}

/**
 * One row per input the two implementations must agree on. `pkg` is the
 * `package.json` version at that moment and is CONTEXT ONLY — no verdict may
 * depend on it, and the rows where it equals the pin are exactly the ones that
 * used to diverge (bug-ci-seam-pin-shell-vs-test-copy-divergence).
 */
const PARITY_CORPUS: readonly { label: string; pin: string; pkg: string; stamps: string[] }[] = [
  { label: "mid-cycle", pin: "0.5.0", pkg: "0.5.0", stamps: ["0.5.0"] },
  { label: "release bump landed, pre-publish", pin: "0.5.0", pkg: "0.6.0", stamps: ["0.5.0"] },
  { label: "post-publish, pre-re-pin", pin: "0.5.0", pkg: "0.6.0", stamps: ["0.5.0"] },
  { label: "re-pin, seam regenerated with it", pin: "0.5.1", pkg: "0.5.1", stamps: ["0.5.1"] },
  { label: "template-less patch re-pin", pin: "0.5.1", pkg: "0.5.1", stamps: ["0.5.0"] },
  {
    label: "#527: pin behind the bump and the stamps",
    pin: "0.5.0",
    pkg: "0.6.0",
    stamps: ["0.5.1"],
  },
  {
    label: "#527 with the release bump landed (pin == package.json, seam newer)",
    pin: "0.5.0",
    pkg: "0.5.0",
    stamps: ["0.5.1"],
  },
  {
    label: "several stamps; newest decides, and version sort is not lexicographic",
    pin: "0.5.0",
    pkg: "0.6.0",
    stamps: ["0.9.0", "0.3.0", "0.10.0"],
  },
  { label: "no committed stamps yet", pin: "0.5.0", pkg: "0.5.0", stamps: [] },
];

describe("seam-pin lag predicate (verdict table)", () => {
  it("is green through the whole documented release flow", () => {
    // Mid-cycle: everything at the last release.
    expect(pinLagsSeam("0.5.0", ["0.5.0"])).toBe(false);
    // Release bump / pre-publish window: step-1 bump landed, pin == stamps.
    expect(pinLagsSeam("0.5.0", ["0.5.0"])).toBe(false);
    // Post-publish, pre-re-pin: same shape — still no drift to flag.
    expect(pinLagsSeam("0.5.0", ["0.5.0"])).toBe(false);
    // Re-pin: pin moved + seam regenerated together.
    expect(pinLagsSeam("0.5.1", ["0.5.1"])).toBe(false);
    // Template-less patch re-pin: the stamp never moved, pin moved alone.
    expect(pinLagsSeam("0.5.1", ["0.5.0"])).toBe(false);
  });

  it("is red on the #527 shape: seam regenerated, pin lags it", () => {
    // The outage: init regenerated the seam with 0.4.1 while the pin said 0.4.0.
    expect(pinLagsSeam("0.4.0", ["0.4.1"])).toBe(true);
    // Stays red while the pin sits behind the committed seam.
    expect(pinLagsSeam("0.4.0", ["0.4.1", "0.4.2"])).toBe(true);
  });

  it("is red when the pin equals package.json but the seam postdates it", () => {
    // The case the removed `pin !== pkgVersion` conjunct made GREEN. It is the
    // #527 class — the pinned init rewrites committed content — reached whenever
    // a contributor's installed arggon is newer than their branch's
    // `package.json` and they run `arggon init`. The shell clause has no
    // `package.json` input and fires; so must this.
    expect(pinLagsSeam("0.4.1", ["0.4.2"])).toBe(true);
  });

  it("with several stamps, the newest one decides", () => {
    expect(pinLagsSeam("0.4.0", ["0.3.0", "0.4.1", "0.4.0"])).toBe(true);
    expect(pinLagsSeam("0.4.1", ["0.3.0", "0.4.1"])).toBe(false);
  });
});

describe("pin-lag parity: the shipped clause vs this predicate", () => {
  it("both workflow copies carry the clause this guard transcribes", () => {
    // The two-copy pair that actually decides tasks-validate: the TEMPLATE (the
    // rule of record, what adopters vendor) and the COMMITTED copy (what CI
    // runs). Same clause, not merely the same shape.
    const template = extractLagClause(readFileSync(WORKFLOW_TEMPLATE, "utf8"));
    const committed = extractLagClause(readFileSync(WORKFLOW, "utf8"));
    expect(
      committed,
      `${WORKFLOW} carries a different pinned-lag clause than ${WORKFLOW_TEMPLATE} — the drift ` +
        `gate runs the COMMITTED copy, so edit the template and regenerate (never hand-divide)`,
    ).toBe(template);
    // And it is the documented clause, not a lookalike: what the next test
    // executes is pinned here.
    expect(template).toBe(LAG_CLAUSE);
  });

  it("both copies derive the newest stamp with the same sort the clause compares", () => {
    // The other half of the clause's input: `newest` comes from a grep piped
    // into `sort -V`. If either copy changes how `newest` is derived, the
    // executed clause and this predicate are no longer comparable and the
    // parity below would be quietly meaningless.
    for (const file of [WORKFLOW_TEMPLATE, WORKFLOW]) {
      const workflow = readFileSync(file, "utf8");
      expect(workflow, `${file}: the newest-stamp extraction moved`).toContain(
        `grep -oE 'arggonVersion: "[0-9]+\\.[0-9]+\\.[0-9]+"'`,
      );
      expect(workflow, `${file}: the newest-stamp sort moved`).toContain("| sort -V | tail -1");
    }
  });

  it("agrees with the executed clause on every corpus row", () => {
    const clause = extractLagClause(readFileSync(WORKFLOW_TEMPLATE, "utf8"));
    for (const row of PARITY_CORPUS) {
      const shell = shellLagFires(clause, row.pin, shellNewest(row.stamps));
      expect(
        pinLagsSeam(row.pin, row.stamps),
        `${row.label}: this predicate disagrees with the clause CI runs (pin ${row.pin}, ` +
          `package.json ${row.pkg} — context only, the clause never reads it, stamps ` +
          `${JSON.stringify(row.stamps)}). The clause is the rule of record: fix the predicate, ` +
          `never widen the clause (bug-ci-seam-pin-shell-vs-test-copy-divergence).`,
      ).toBe(shell);
    }
  });
});

describe("seam-pin guard (task-ci-seam-pin-tracks-release)", () => {
  it("ARGGON_VERSION never lags the committed seam", () => {
    const pkgVersion = (JSON.parse(readFileSync(PACKAGE_JSON, "utf8")) as { version: string })
      .version;
    expect(pkgVersion, "package.json version is not MAJOR.MINOR.PATCH").toMatch(/^\d+\.\d+\.\d+$/);

    const pin = readPin(readFileSync(WORKFLOW, "utf8"));
    expect(pin, `no ARGGON_VERSION literal found in ${WORKFLOW}`).toBeDefined();

    const stamps = readSeamStamps(readFileSync(GENERATED_STATE, "utf8"));
    expect(stamps.length, `no arggonVersion stamps found in ${GENERATED_STATE}`).toBeGreaterThan(0);

    expect(
      pinLagsSeam(pin!, stamps),
      `ARGGON_VERSION ${pin} lags the committed arggon seam (newest stamp ` +
        `${newestOf(stamps)}, this checkout's package.json says ${pkgVersion} — context, not an ` +
        `input): the pinned init would REWRITE committed content. Bump ARGGON_VERSION in ` +
        `.github/workflows/arggon.yml (release runbook Gotchas: "Re-pin the seam check"). A stale ` +
        `pin is a red test, not a silent outage.`,
    ).toBe(false);
  });

  it("the repo workflow keeps the literal pin — it never derives it", () => {
    const workflow = readFileSync(WORKFLOW, "utf8");
    // Deriving from package.json installs a version the registry does not
    // have yet between the release bump (step 1) and the publish (step 3) —
    // guaranteed red tasks-validate on main and on the release PR. If this
    // ever flips back to derivation, it must come with a new decision that
    // answers the red window, not a silent workflow edit.
    expect(workflow).not.toContain(DERIVE_PIN);
    expect(workflow).not.toContain("GITHUB_ENV");
    // The install step still consumes the pinned env var.
    expect(workflow).toContain(INSTALL_PIN);
  });

  it("adopter template still pins literally (by design) — it never derives", () => {
    const template = readFileSync(WORKFLOW_TEMPLATE, "utf8");
    expect(
      readPin(template),
      `no literal ARGGON_VERSION pin in ${WORKFLOW_TEMPLATE}`,
    ).toBeDefined();
    expect(template).toContain(INSTALL_PIN);
    expect(template).not.toContain(DERIVE_PIN);
    expect(template).not.toContain("GITHUB_ENV");
  });
});
