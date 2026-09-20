import {
  cpSync,
  existsSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checksumOf, extractProjectNameFromContent } from "./docs.js";
import {
  parseConventionConfig,
  parseGeneratedProjectName,
  readGeneratedProjectName,
  updateGeneratedSection,
} from "@arggon/lib";
import { dryRunInit, runInit } from "./init.js";
import { runDoctor } from "./doctor.js";

// bug-project-name-dir-derived: {{PROJECT_NAME}} must be RECOVERED on re-runs
// (recorded state → content extraction) and derived from the directory
// basename only for fresh scaffolds — otherwise init/--dry-run/--propose/
// doctor produce different (contaminated) results from differently-named
// worktrees/renamed clones.

const tmpDirs: string[] = [];
afterAll(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string): string {
  // Absolute prefix: a relative one would create fixtures inside the CWD
  // (the worktree), where init's auto-commit would sweep them into the branch.
  const dir = _mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

/** Strip the x-generated.projectName line, simulating a pre-fix (legacy) tree. */
function stripRecordedName(dir: string): void {
  const path = join(dir, "ArggonManager/.convention.yml");
  writeFileSync(
    path,
    readFileSync(path, "utf8")
      .split("\n")
      .filter((l) => !l.startsWith("  projectName:"))
      .join("\n"),
    "utf8",
  );
}

/** Copy a fixture to a fresh directory whose basename differs from the source. */
function copyFixture(from: string, prefix: string): string {
  const to = mkdtempSync(prefix);
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  tmpDirs.push(to);
  return to;
}

/** Normalize a result for cross-directory comparison (location fields stripped). */
function normalize(result: unknown): string {
  return JSON.stringify(result, (key, value) => {
    if (typeof value !== "string") return value;
    if (key === "root" || key === "conventionPath" || key === "cwd") return "";
    return value.replace(/\/tmp\/arggon-[A-Za-z0-9._-]+/g, "<TMP>");
  });
}

describe("bug-project-name-dir-derived: project-name recovery", () => {
  it("extractProjectNameFromContent recovers the name between template anchors", () => {
    const template = "# {{PROJECT_NAME}}\n\nsome fixed text {{YEAR}}\n";
    expect(extractProjectNameFromContent(template, "# my-repo.1\n\nsome fixed text 2031\n")).toBe(
      "my-repo.1",
    );
    // Marker lines and other content before the anchor are tolerated.
    expect(
      extractProjectNameFromContent(
        template,
        '<!-- arggon:generated template="x" -->\n# Acme\n\nsome fixed text 2031\n',
      ),
    ).toBe("Acme");
    // Refusals: no placeholder, structure drift, empty, insane charset.
    expect(extractProjectNameFromContent("no placeholder", "x")).toBeNull();
    expect(extractProjectNameFromContent(template, "completely different\n")).toBeNull();
    expect(extractProjectNameFromContent(template, "# \n\nsome fixed text 2031\n")).toBeNull();
    expect(
      extractProjectNameFromContent(template, "# bad name!\n\nsome fixed text 2031\n"),
    ).toBeNull();
    // bug-crlf-provenance-breakage: LF-anchored template text must also match
    // a git-smudged CRLF disk (`* text=auto eol=crlf` trees) — and vice versa —
    // otherwise name recovery (and with it propose/doctor's name-bearing
    // comparisons) goes inert on those trees.
    expect(
      extractProjectNameFromContent(template, "# my-repo.1\r\n\r\nsome fixed text 2031\r\n"),
    ).toBe("my-repo.1");
    expect(
      extractProjectNameFromContent(
        template.replaceAll("\n", "\r\n"),
        "# Acme\r\n\r\nsome fixed text 2031\r\n",
      ),
    ).toBe("Acme");
    // Lone CR terminators normalize too.
    expect(extractProjectNameFromContent(template, "# my-repo.1\r\rsome fixed text 2031\r")).toBe(
      "my-repo.1",
    );
    // A CRLF disk content that genuinely drifts still refuses.
    expect(
      extractProjectNameFromContent(template, "# my-repo.1\r\n\r\nCHANGED STRUCTURE\r\n"),
    ).toBeNull();
  });

  it("records the project name in x-generated.projectName on init", () => {
    const dir = mkdtempSync("arggon-pn-record-");
    runInit({ dir, force: false });
    const recorded = readGeneratedProjectName(dir);
    expect(recorded).toBeTruthy();
    expect(recorded).toBe(dir.split("/").pop()); // fresh scaffold: dir basename
    expect(
      parseGeneratedProjectName(readFileSync(join(dir, "ArggonManager/.convention.yml"), "utf8")),
    ).toBe(recorded);
    // The generated docs carry that name, not the placeholder.
    const editorconfig = readFileSync(join(dir, ".editorconfig"), "utf8");
    expect(editorconfig).toContain(recorded);
    expect(editorconfig).not.toContain("{{PROJECT_NAME}}");
    // Additive + namespaced: the full parser accepts the new key (ignore-unknown).
    const config = parseConventionConfig(
      readFileSync(join(dir, "ArggonManager/.convention.yml"), "utf8"),
    );
    expect(config.generatedProjectName).toBe(recorded);
    expect(Object.keys(config.generated).length).toBeGreaterThan(0);
  });

  it("KEY: init/dry-run/propose/doctor are identical from differently-named dirs", () => {
    const fixture = mkdtempSync("arggon-pn-repo-x-");
    runInit({ dir: fixture, force: false, full: true });
    const fixtureName = fixture.split("/").pop()!;

    // Both variants must behave identically: a tree WITH the recorded name
    // and a legacy tree whose state predates x-generated.projectName (the
    // content-extraction recovery layer).
    for (const base of [
      fixture,
      (() => {
        const legacy = mkdtempSync("arggon-pn-repo-x-legacy-");
        cpSync(fixture, legacy, { recursive: true });
        stripRecordedName(legacy);
        return legacy;
      })(),
    ]) {
      const wt = copyFixture(base, "arggon-pn-repo-x-worktree-1-");
      const ctrl = copyFixture(base, "arggon-pn-ctrl-");
      expect(wt.split("/").pop()).not.toBe(base.split("/").pop());

      const results = [wt, ctrl].map((target) => {
        const res = runInit({ dir: target, force: false });
        const dry = dryRunInit({ dir: target, force: false });
        const propose = dryRunInit({ dir: target, force: false, propose: true });
        const doc = runDoctor({ cwd: target });
        return { target, res, dry, propose, doc };
      });

      for (const r of results) {
        // Recovered name everywhere — never the copy's directory basename.
        expect(r.doc.projectName).toBe(fixtureName);
        expect(r.doc.projectName).not.toContain("worktree-1");
        // Zero spurious signals from the name drift.
        expect(r.doc.docs.outdated).toBe(0);
        expect(r.propose.proposals?.filter((p) => p.decision === "proposed").length ?? 0).toBe(0);
        expect(r.dry.created).toEqual([]);
        // No regeneration with a guessed name: docs stay name-clean. The
        // canonical name-bearing doc (.editorconfig) carries the original
        // fixture name, not the copy's basename.
        for (const dest of r.res.updated) {
          const content = readFileSync(join(r.target, dest), "utf8");
          expect(content).not.toContain("{{PROJECT_NAME}}");
          expect(content).not.toContain("worktree-1");
        }
        expect(readFileSync(join(r.target, ".editorconfig"), "utf8")).toContain(fixtureName);
      }
      // Byte-identical payloads between the differently-named dirs.
      expect(normalize(results[1]!.dry)).toBe(normalize(results[0]!.dry));
      expect(normalize(results[1]!.propose)).toBe(normalize(results[0]!.propose));
      expect(normalize(results[1]!.doc)).toBe(normalize(results[0]!.doc));
      expect(normalize(results[1]!.res)).toBe(normalize(results[0]!.res));
    }
  });

  it("legacy trees (state without projectName) recover the name from content", () => {
    const dir = mkdtempSync("arggon-pn-legacy-");
    runInit({ dir, force: false });
    stripRecordedName(dir);
    expect(readGeneratedProjectName(dir)).toBeNull();
    // Doctor recovers the original name — not this directory's basename.
    const doc = runDoctor({ cwd: dir });
    expect(doc.projectName).toBe(dir.split("/").pop());
    expect(doc.docs.outdated).toBe(0);
    // And from a differently-named copy, the same name and zero drift.
    const wt = copyFixture(dir, "arggon-pn-legacy-worktree-1-");
    const docWt = runDoctor({ cwd: wt });
    expect(docWt.projectName).toBe(doc.projectName);
    expect(docWt.docs.outdated).toBe(0);
  });

  it("unrecoverable names degrade safely: skip with reason, keep bytes and state", () => {
    const dir = mkdtempSync("arggon-pn-unrec-");
    runInit({ dir, force: false });
    // Corrupt every managed doc so content extraction fails, then re-stamp
    // the state checksums so the docs still count as "untouched" — the worst
    // case: untouched name-bearing docs whose name cannot be recovered.
    const statePath = join(dir, "ArggonManager/.convention.yml");
    const state = parseConventionConfig(readFileSync(statePath, "utf8"));
    const originalName = readGeneratedProjectName(dir)!;
    for (const [dest, entry] of Object.entries(state.generated)) {
      const abs = join(dir, dest);
      if (!existsSync(abs)) continue;
      // Replace the baked-in project name with an invalid name: the on-disk
      // content no longer yields a sane extraction, but the checksums are
      // re-stamped so the docs still count as "untouched" — the worst case:
      // untouched name-bearing docs whose name cannot be recovered.
      const content = readFileSync(abs, "utf8").replaceAll(originalName, "not a valid name!");
      writeFileSync(abs, content, "utf8");
      entry.checksum = checksumOf(content);
    }
    writeFileSync(
      statePath,
      updateGeneratedSection(
        readFileSync(statePath, "utf8")
          .split("\n")
          .filter((l) => !l.startsWith("  projectName:"))
          .join("\n"),
        state.generated,
        null,
      ),
      "utf8",
    );

    const before = readFileSync(join(dir, ".editorconfig"), "utf8");
    const dry = dryRunInit({ dir, force: false });
    const skips = dry.plan.filter((e) => e.decision === "project-name-unrecoverable");
    expect(skips.length).toBeGreaterThan(0);
    expect(skips.map((s) => s.dest)).toContain(".editorconfig");
    for (const s of skips) expect(s.reason).toContain("project-name-unrecoverable");
    expect(dry.skipped).toContain(".editorconfig");
    expect(dry.updated).not.toContain(".editorconfig");
    // A real run writes nothing name-bearing: bytes stay intact, and the
    // .editorconfig state entry is untouched. Non-name-bearing untouched docs
    // (e.g. the skill, whose render does not depend on the name) may still
    // regenerate — their renders are name-independent, so that is harmless.
    const res = runInit({ dir, force: false });
    expect(readFileSync(join(dir, ".editorconfig"), "utf8")).toBe(before);
    const stateAfter = parseConventionConfig(readFileSync(statePath, "utf8"));
    const editorconfigEntry = stateAfter.generated[".editorconfig"]!;
    expect(editorconfigEntry).toEqual(state.generated[".editorconfig"]!);
    expect(res.updated).not.toContain(".editorconfig");
    // Doctor skips the name-sensitive outdated comparison (no false signals).
    const doc = runDoctor({ cwd: dir });
    expect(doc.projectName).toBeNull();
    expect(doc.docs.outdated).toBe(0);
  });
});
