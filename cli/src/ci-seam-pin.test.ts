/**
 * Seam-pin guard (task-ci-seam-pin-tracks-release).
 *
 * `.github/workflows/arggon.yml` pins `ARGGON_VERSION` as a literal: the
 * registry install (`npm install -g "arggon-manager@$ARGGON_VERSION"`) and
 * the drift gate compare the committed seam against that release. The #527
 * incident: the seam was regenerated with 0.4.1 while the pin still said
 * 0.4.0 — `tasks-validate` went red on main and every open PR until the pin
 * was moved by hand (the release runbook's post-release re-pin, Gotchas:
 * "Re-pin the seam check").
 *
 * This test pins the invariant that keeps the drift gate green: the literal
 * pin must never LAG both:
 *
 *   - the root `package.json` version (the release flow's step-1 bump), and
 *   - the newest `arggonVersion` stamp in `ArggonManager/.convention.yml`
 *     (the newest version whose `init` actually rewrote committed seam
 *     bytes — a stamp moves only when a generated doc's bytes change, so a
 *     template-less patch release does not move it).
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
 *   state                                pin   package.json  seam stamps  verdict
 *   -----------------------------------  ----  ------------  -----------  ---------------------
 *   mid-cycle (== last release)          V     V             V            green (pin == pkg)
 *   release bump / pre-publish window    V     V+1           V            green (pin == stamps)
 *   post-publish, pre-re-pin             V     V+1           V            green (pin == stamps)
 *   re-pin (pin moved + seam regen)      V+1   V+1           V+1          green (pin == pkg)
 *   template-less patch re-pin           V+1   V+1           V            green (pin == pkg)
 *   #527: seam regenerated, pin stale    V     V             V+1          RED — bump the pin
 *
 * The opposite drift — the pin moved without regenerating the seam — stays
 * policed by the workflow's own drift gate at CI time.
 */
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

/**
 * The lag predicate, extracted so the verdict table below can assert the RED
 * case (#527's shape) directly — the file-based test at the bottom can only
 * witness the tree's current, green state.
 *
 * @precondition all inputs are `MAJOR.MINOR.PATCH`; `stamps` is non-empty
 *   (the file-based test asserts that before calling).
 */
export function pinLagsSeam(pin: string, pkgVersion: string, stamps: string[]): boolean {
  const newest = stamps.reduce((a, b) => (compareVersions(a, b) >= 0 ? a : b));
  return pin !== pkgVersion && compareVersions(pin, newest) < 0;
}

describe("seam-pin lag predicate (verdict table)", () => {
  it("is green through the whole documented release flow", () => {
    // Mid-cycle: everything at the last release.
    expect(pinLagsSeam("0.4.1", "0.4.1", ["0.4.1"])).toBe(false);
    // Release bump / pre-publish window: step-1 bump landed, pin == stamps.
    expect(pinLagsSeam("0.4.1", "0.4.2", ["0.4.1"])).toBe(false);
    // Post-publish, pre-re-pin: same shape — still no drift to flag.
    expect(pinLagsSeam("0.4.1", "0.4.2", ["0.4.1"])).toBe(false);
    // Re-pin: pin moved + seam regenerated together.
    expect(pinLagsSeam("0.4.2", "0.4.2", ["0.4.2"])).toBe(false);
    // Template-less patch re-pin: the stamp never moved, pin == package.json.
    expect(pinLagsSeam("0.4.2", "0.4.2", ["0.4.1"])).toBe(false);
  });

  it("is red exactly on the #527 shape: seam regenerated, pin lags both", () => {
    // The outage: init regenerated the seam with 0.4.1 while the pin said
    // 0.4.0 and package.json said 0.4.1.
    expect(pinLagsSeam("0.4.0", "0.4.1", ["0.4.1"])).toBe(true);
    // Stays red while the pin sits behind both constraints.
    expect(pinLagsSeam("0.4.0", "0.4.2", ["0.4.1"])).toBe(true);
  });

  it("with several stamps, the newest one decides", () => {
    expect(pinLagsSeam("0.4.0", "0.4.1", ["0.3.0", "0.4.1", "0.4.0"])).toBe(true);
    expect(pinLagsSeam("0.4.1", "0.4.2", ["0.3.0", "0.4.1"])).toBe(false);
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
      pinLagsSeam(pin!, pkgVersion, stamps),
      `ARGGON_VERSION ${pin} lags the committed seam: the seam was regenerated by a newer ` +
        `version while the pin sits behind both it and package.json (${pkgVersion}). ` +
        `Bump ARGGON_VERSION in .github/workflows/arggon.yml (release runbook Gotchas: ` +
        `"Re-pin the seam check"). A stale pin is a red test, not a silent outage.`,
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
