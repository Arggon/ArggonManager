#!/usr/bin/env node
/**
 * CI version guard (bug-ci-version-guard-dev-only).
 *
 * `.github/workflows/ci.yml` fails a PR when `package.json` changed while the
 * current version is already tagged — the "release forgotten" signal. The
 * original inline check treated ANY `package.json` change as shipping-relevant,
 * which blocked dev-only edits (a devDependency, a script) that the release
 * runbook does not consider adopter-facing (patch = bug fixes, minor =
 * adopter-facing). This guard scopes the demand to the publish-relevant fields;
 * everything else (`devDependencies`, `scripts`, formatter config, …) passes
 * with an explicit message.
 *
 * Usage: `node cli/version-guard.mjs <base-package.json>`
 *   `<base-package.json>` is the merge-target `package.json` (in CI:
 *   `git show origin/main:package.json`), compared field-by-field against
 *   `./package.json`. Git tag lookup (`refs/tags/v<version>`) runs in the
 *   current working directory.
 *
 * Exit codes: 0 — pass (dev-only change, or shipping change not yet tagged);
 * 1 — fail (shipping fields changed and the version is already tagged);
 * 2 — usage / IO error.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Fields that ship to adopters: the published identity, the packed contents
 * and the install/runtime surface. Everything else in `package.json` is
 * repo-only tooling.
 */
export const SHIPPING_FIELDS = [
  "name",
  "version",
  "private",
  "bin",
  "files",
  "dependencies",
  "engines",
];

/** Stable stringify: object key order must not read as a field change. */
function canonical(value) {
  return JSON.stringify(value, (_key, item) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : 1)));
    }
    return item;
  });
}

/** Shipping fields whose value differs between base and head (missing = null). */
export function changedShippingFields(base, head, fields = SHIPPING_FIELDS) {
  return fields.filter(
    (field) => canonical(base[field] ?? null) !== canonical(head[field] ?? null),
  );
}

/** True when `refs/tags/v<version>` exists in `cwd`'s repository. */
export function tagExists(version, cwd = process.cwd()) {
  try {
    execFileSync("git", ["rev-parse", "-q", "--verify", `refs/tags/v${version}`], {
      cwd,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function main() {
  const basePath = process.argv[2];
  if (!basePath) {
    console.error("usage: node cli/version-guard.mjs <base-package.json>");
    process.exitCode = 2;
    return;
  }
  let base;
  let head;
  try {
    base = JSON.parse(readFileSync(basePath, "utf8"));
    head = JSON.parse(readFileSync("package.json", "utf8"));
  } catch (err) {
    console.error(`version-guard: cannot read package.json (${String(err)})`);
    process.exitCode = 2;
    return;
  }

  const changed = changedShippingFields(base, head);
  if (changed.length === 0) {
    console.log(
      "package.json changed, but none of the publish-relevant fields " +
        `(${SHIPPING_FIELDS.join(", ")}) — dev-only change, no version bump required`,
    );
    return;
  }

  const version = String(head.version ?? "");
  if (tagExists(version)) {
    console.error(
      `version ${version} already tagged - bump package.json ` +
        `(publish-relevant fields changed: ${changed.join(", ")})`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    `publish-relevant fields changed (${changed.join(", ")}); version ${version} is not yet tagged - ok`,
  );
}

// Direct-run guard: the test suite imports the pure predicate above.
const invokedDirectly = (() => {
  try {
    return (
      process.argv[1] !== undefined &&
      realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
})();
if (invokedDirectly) main();
