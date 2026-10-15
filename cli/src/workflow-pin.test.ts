/**
 * bug-init-writes-stale-workflow-pin: `arggon init` must write the running
 * CLI's own version (package.json) into the generated workflow's literal
 * `ARGGON_VERSION` pin, whatever literal the template file happens to carry.
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { arggonVersion, generateDocs, renderDocPlaceholders, renderWorkflowPin } from "./docs.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const pkgVersion = (
  JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as { version: string }
).version;
const readPin = (text: string) => /^[ \t]*ARGGON_VERSION:[ \t]*"([^"\n]*)"/m.exec(text)?.[1];

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("generated workflow pin tracks the CLI version", () => {
  it("arggonVersion() is the package.json version", () => {
    expect(arggonVersion()).toBe(pkgVersion);
  });

  it("init writes package.json's version into .github/workflows/arggon.yml", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-workflow-pin-"));
    dirs.push(dir);
    generateDocs({ root: dir, full: true });
    const generated = readFileSync(join(dir, ".github/workflows/arggon.yml"), "utf8");
    expect(readPin(generated), "generated ARGGON_VERSION diverges from package.json").toBe(
      pkgVersion,
    );
    // The install step still consumes the literal pin.
    expect(generated).toContain('npm install -g "arggon-manager@$ARGGON_VERSION"');
  });

  it("a stale template literal is overridden, not copied", () => {
    const stale = 'env:\n  ARGGON_VERSION: "0.4.0"\nsteps: []\n';
    expect(
      readPin(
        renderDocPlaceholders(stale, { projectName: "x", year: 2026, arggonVersion: "9.8.7" }),
      ),
    ).toBe("9.8.7");
    expect(readPin(renderDocPlaceholders(stale, { projectName: "x", year: 2026 }))).toBe(
      pkgVersion,
    );
  });

  it("leaves content without a pin, and non-semver versions, untouched", () => {
    expect(renderWorkflowPin("# no pin here\n", "1.2.3")).toBe("# no pin here\n");
    const pinned = '  ARGGON_VERSION: "0.4.0"\n';
    expect(renderWorkflowPin(pinned, "latest")).toBe(pinned);
    expect(renderWorkflowPin(pinned, "1.2.3-rc.1")).toBe('  ARGGON_VERSION: "1.2.3-rc.1"\n');
  });
});
