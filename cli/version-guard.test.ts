import { describe, expect, it } from "vitest";
import { changedShippingFields, SHIPPING_FIELDS } from "./version-guard.mjs";

// bug-ci-version-guard-dev-only: the CI guard demands a version bump only when
// a publish-relevant package.json field changed. These tests pin the predicate;
// the workflow step and the local probe exercise the CLI wiring and the tag
// lookup (cli/version-guard.mjs).

const BASE = {
  name: "arggon-manager",
  version: "0.4.0",
  private: true,
  bin: { arggon: "./dist/cli.js" },
  files: ["dist/**"],
  dependencies: { "@arggondev/lib": "^0.4.0", commander: "^13.1.0" },
  engines: { node: ">=22.12.0" },
  devDependencies: { vitest: "^5.0.0" },
  scripts: { test: "vitest run" },
};

describe("version-guard: changedShippingFields", () => {
  it("ignores a devDependencies/scripts-only change (the bug's first hit)", () => {
    const head = {
      ...BASE,
      devDependencies: { ...BASE.devDependencies, "@playwright/test": "^1.63.0" },
      scripts: { ...BASE.scripts, "smoke:ui": "playwright test --grep @smoke" },
    };
    expect(changedShippingFields(BASE, head)).toEqual([]);
  });

  it("ignores an added non-shipping field", () => {
    expect(changedShippingFields(BASE, { ...BASE, description: "new text" })).toEqual([]);
  });

  it("does not read object key order as a change", () => {
    const head = { ...BASE, dependencies: { commander: "^13.1.0", "@arggondev/lib": "^0.4.0" } };
    expect(changedShippingFields(BASE, head)).toEqual([]);
  });

  it("reports every changed shipping field", () => {
    const head = {
      ...BASE,
      version: "0.5.0",
      bin: { arggon: "./bin/arggon.js" },
      dependencies: { ...BASE.dependencies, commander: "^14.0.0" },
    };
    expect(changedShippingFields(BASE, head)).toEqual(["version", "bin", "dependencies"]);
  });

  it("treats a missing field as null on both sides", () => {
    expect(changedShippingFields(BASE, { ...BASE, engines: undefined })).toEqual(["engines"]);
    expect(changedShippingFields({}, {})).toEqual([]);
  });

  it("covers exactly the documented publish-relevant fields", () => {
    expect(SHIPPING_FIELDS).toEqual([
      "name",
      "version",
      "private",
      "bin",
      "files",
      "dependencies",
      "engines",
    ]);
  });
});
