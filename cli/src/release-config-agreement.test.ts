/**
 * Release-please config ↔ workflow tag-form agreement
 * (bug-release-config-workflow-agreement-ungated).
 *
 * The release pipeline was dead for five days (2026-10-02 → 2026-10-07) and
 * nobody could see it, because the thing that killed it was a config field that
 * never got set. `release-please-config.json` never carried
 * `include-component-in-tag`, and the official schema documents its default as
 * `true` — so release-please looked for the component-prefixed tags
 * (`arggon-manager-v0.5.0`, `lib-v0.5.0`), while `.github/workflows/release.yml`
 * creates the PLAIN `vX.Y.Z` tag (`git tag -a "v${VERSION}"`, spec invariant 1:
 * "the root tag `vX.Y.Z` names the exact commit being published"). release-please
 * could never find its own tag, concluded its merged release PR was untagged,
 * and aborted before ever opening the next one — see `release-abort-check.mjs`
 * for the run that reported success while doing nothing.
 *
 * Nothing gated the two against each other, so a one-word omission surfaced as a
 * silent, permanent outage instead of a red test. THIS gate is the fix that
 * outlives the one-word config repair (b7b5f866, already on main): the component-
 * in-tag setting must resolve to the SAME tag form the workflow produces, so the
 * next drift fails loudly here rather than aborting inside a green run.
 *
 * The predicate is two-sided on purpose — it catches BOTH drift directions:
 *
 *   - the config asks release-please for component-prefixed tags while the
 *     workflow creates plain `v${VERSION}` (the 2026-10 outage; includes the
 *     key-absent shape, because the schema default is `true`);
 *   - the workflow is edited to tag with a component prefix while the config
 *     says `false` (the release.yml side moving — the version guard and the
 *     agreement step key on the plain form, so this is a regression too).
 *
 * The tag form and the option that must agree with it are the decided contract
 * (spec-release-pipeline-015 invariant 1); they are written down for the next
 * author in `release.md` §The tag↔config agreement, not only in this item.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CONFIG = join(root, "release-please-config.json");
const WORKFLOW = join(root, ".github/workflows/release.yml");

/** The tag ref the decided contract requires: plain `vX.Y.Z`, no component. */
const PLAIN_TAG_REF = "v${VERSION}";

/** The tag ref release.yml creates, from its `git tag -a "<ref>"` line. */
function workflowTagRef(workflow: string): string | null {
  return /git tag -a "([^"]+)"/.exec(workflow)?.[1] ?? null;
}

/**
 * The agreement violation for the given config object + workflow text, or
 * `null` when they agree. Pure, so the corpus below can drive every shape
 * (green and red) rather than only the tree's current, green state.
 *
 * @param config The parsed `release-please-config.json` (any shape).
 * @param workflow The parsed `.github/workflows/release.yml` text.
 */
export function agreementViolation(
  config: Record<string, unknown>,
  workflow: string,
): string | null {
  // Side 1 — the CONTRACT: release.yml tags the plain v(V) form the version
  // guard and the agreement step key on (spec invariant 1).
  const workflowTag = workflowTagRef(workflow);
  if (workflowTag === null) {
    return (
      `release.yml no longer creates the annotated tag (no \`git tag -a "…"\` line) — ` +
      `the tag that names the exact commit being published (spec-release-pipeline-015 invariant 1)`
    );
  }
  if (workflowTag !== PLAIN_TAG_REF) {
    return (
      `release.yml tags ${JSON.stringify(workflowTag)}, but the decided contract is the plain ` +
      `${JSON.stringify(PLAIN_TAG_REF)} vX.Y.Z form with no component prefix — version-guard and the ` +
      `agreement step in release.yml key on it`
    );
  }

  // Side 2 — the CONFIG: release-please must look for that SAME plain tag. An
  // absent key is the schema default (`true`), i.e. component-prefixed — the
  // exact shape that killed releases 2026-10-02 → 2026-10-07.
  const includeComponent = config["include-component-in-tag"];
  if (includeComponent !== false) {
    const observed =
      includeComponent === undefined
        ? "absent (schema default: true)"
        : JSON.stringify(includeComponent);
    return (
      `release-please-config.json does not set "include-component-in-tag": false (it is ${observed}) — ` +
      `release-please then looks for the component-prefixed tag (e.g. arggon-manager-v0.5.0) while ` +
      `release.yml creates the plain ${PLAIN_TAG_REF}, so release-please can never find its own tag and ` +
      `aborts: this is the outage root cause, gated here instead of silent`
    );
  }

  return null;
}

/** A workflow text carrying `git tag -a "<ref>"` (rest is inert filler). */
function workflowTagging(tagRef: string): string {
  return [
    "jobs:",
    "  release:",
    "    steps:",
    "      - run: |",
    `          git tag -a "${tagRef}" -m "arggon-manager ${tagRef}" "$RELEASE_SHA"`,
    "",
  ].join("\n");
}

/** The committed config, with `include-component-in-tag` forced to one shape. */
function configWith(includeComponent: unknown): Record<string, unknown> {
  const base: Record<string, unknown> = {
    "release-type": "node",
    "skip-github-release": true,
    "include-component-in-tag": includeComponent,
    packages: { ".": {}, lib: {} },
  };
  return base;
}

describe("release-please config ↔ tag-form agreement (bug-release-config-workflow-agreement-ungated)", () => {
  it("is green when the config resolves to the plain form the workflow tags", () => {
    expect(agreementViolation(configWith(false), workflowTagging("v${VERSION}"))).toBeNull();
  });

  it("is red when include-component-in-tag is true while the workflow tags plain (the outage)", () => {
    // The config as it was when the pipeline died: release-please searches the
    // component-prefixed tag, release.yml has only ever created the plain one.
    const violation = agreementViolation(configWith(true), workflowTagging("v${VERSION}"));
    expect(violation).not.toBeNull();
    expect(violation).toContain('does not set "include-component-in-tag": false');
    expect(violation).toContain("arggon-manager-v0.5.0");
  });

  it("is red when the key is absent (schema default true) — the exact omission", () => {
    // Absent, not present-and-true: this is the byte state that shipped the
    // five-day outage, and the gate must catch a future removal too.
    const { "include-component-in-tag": _dropped, ...withoutKey } = configWith(false);
    void _dropped; // the spread drops it on purpose
    const violation = agreementViolation(withoutKey, workflowTagging("v${VERSION}"));
    expect(violation).not.toBeNull();
    expect(violation).toContain("absent (schema default: true)");
  });

  it("is red on the reverse drift: workflow tags a component while config says false", () => {
    // The other side moving: someone edits release.yml's tag line to include
    // the component. The config is correct, but the tag form the contract
    // pins (and the version guard reads) is gone.
    const violation = agreementViolation(
      configWith(false),
      workflowTagging("arggon-manager-v${VERSION}"),
    );
    expect(violation).not.toBeNull();
    expect(violation).toContain('release.yml tags "arggon-manager-v${VERSION}"');
    expect(violation).toContain("plain");
  });

  it("is red when release.yml no longer creates the tag at all", () => {
    const violation = agreementViolation(configWith(false), "jobs:\n  release:\n    steps: []\n");
    expect(violation).not.toBeNull();
    expect(violation).toContain("no longer creates the annotated tag");
  });

  it("reddens even when both sides drift to the component form (invariant 1 still wants plain)", () => {
    // Consistency is not enough: the contract is the ABSOLUTE plain form, so a
    // config `true` is red regardless of what the workflow does.
    expect(
      agreementViolation(configWith(true), workflowTagging("arggon-manager-v${VERSION}")),
    ).toContain('release.yml tags "arggon-manager-v${VERSION}"');
  });
});

describe("the committed release-please config agrees with the committed release.yml", () => {
  it("the real files are green against this predicate", () => {
    const config = JSON.parse(readFileSync(CONFIG, "utf8")) as Record<string, unknown>;
    const workflow = readFileSync(WORKFLOW, "utf8");
    expect(
      agreementViolation(config, workflow),
      `The release-please config and release.yml disagree on the tag form. This is the exact ` +
        `deadlock that killed releases (bug-release-config-workflow-agreement-ungated): release.yml ` +
        `creates the plain vX.Y.Z tag (git tag -a "v\${VERSION}") while release-please would search a ` +
        `component-prefixed tag and abort. Set "include-component-in-tag": false in ` +
        `release-please-config.json (and keep release.yml tagging the plain form).`,
    ).toBeNull();
  });

  it("the config carries the key explicitly false, and the workflow tags the plain form", () => {
    // Documents that green is not an absent-key accident: the committed config
    // sets the key to false and the workflow's tag line is the plain contract.
    const config = JSON.parse(readFileSync(CONFIG, "utf8")) as Record<string, unknown>;
    expect(config["include-component-in-tag"]).toBe(false);
    expect(workflowTagRef(readFileSync(WORKFLOW, "utf8"))).toBe(PLAIN_TAG_REF);
  });

  it("the negative case against the REAL config bytes: flipping the key goes red", () => {
    // Fixture-based negative case tied to the committed config, not a synthetic
    // object: clone the real config, set include-component-in-tag true, and the
    // gate must fire. A gate that has never been seen red is not evidence.
    const real = JSON.parse(readFileSync(CONFIG, "utf8")) as Record<string, unknown>;
    const workflow = readFileSync(WORKFLOW, "utf8");
    const flipped = agreementViolation({ ...real, "include-component-in-tag": true }, workflow);
    expect(
      flipped,
      "flipping include-component-in-tag on the real config must go red",
    ).not.toBeNull();
    expect(flipped).toContain('does not set "include-component-in-tag": false');

    // And removing the key entirely (the absent-default shape) goes red too.
    const { "include-component-in-tag": _dropped, ...withoutKey } = real;
    void _dropped;
    expect(agreementViolation(withoutKey, workflow)).toContain("absent (schema default: true)");
  });
});
