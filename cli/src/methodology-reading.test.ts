import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runInit } from "./init.js";
import { coreExcerpts, EXCERPT_DESTINATION, spliceCoreExcerpts } from "./methodology-excerpts.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const docs = "ArggonManager/docs/";
const carriers = [
  "agents.md",
  "convention.md",
  "engineering.md",
  "claim.md",
  "references/agent-runtime.md",
  "references/documentation.md",
  "references/orchestration.md",
  "references/convention.md",
  "references/engineering.md",
  "runbooks/agent-recovery.md",
].map((path) => docs + path);

// Code examples (including headings and regexes) are not navigation. This
// deliberately covers inline links, the form used throughout these carriers.
function prose(text: string): string {
  return text
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*(?:\n|$)/gm, "")
    .replace(/`[^`\n]*`/g, "");
}

function anchors(text: string): Set<string> {
  const result = new Set<string>();
  const seen = new Map<string, number>();
  const withoutFences = text.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*(?:\n|$)/gm, "");
  for (const match of withoutFences.matchAll(/^#{1,6} (.+)$/gm)) {
    const slug = match[1]!
      .replace(/<[^>]*>/g, "")
      .replace(/`/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .trim()
      .replace(/\s/g, "-");
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    result.add(slug + (count === 0 ? "" : `-${count}`));
  }
  for (const match of text.matchAll(/<a (?:id|name)="([^"]+)"/g)) result.add(match[1]!);
  return result;
}

describe("methodology progressive reading routes", () => {
  it("keeps installed ordinary boundaries generated from their canonical homes", () => {
    const source = readFileSync(join(root, EXCERPT_DESTINATION), "utf8");
    const excerpts = coreExcerpts(root);
    expect(spliceCoreExcerpts(source, excerpts)).toBe(source);
    expect(excerpts.dispatch).toContain("tools.arggon.start({ id, assignee, worktree: true })");
    expect(excerpts.dispatch).toContain("before launching a maker");
    expect(excerpts.dispatch).toContain("does not re-claim");
    expect(excerpts.dispatch).toContain("or flip done");
    expect(excerpts.priority).toContain("product owner _sets_ the `priority` field");
    expect(() => spliceCoreExcerpts("", excerpts)).toThrow("expected one dispatch destination");
    expect(() => spliceCoreExcerpts(source + source, excerpts)).toThrow(
      "expected one dispatch destination",
    );
  });

  it("keeps core and extracted-reference file/fragment links resolvable", () => {
    const broken: string[] = [];
    for (const file of carriers) {
      for (const match of prose(readFileSync(join(root, file), "utf8")).matchAll(
        /\]\(([^\s)]+)\)/g,
      )) {
        const target = match[1]!;
        if (/^[a-z]+:/i.test(target)) continue;
        const [path, fragment] = target.split("#");
        const destination = path ? resolve(root, dirname(file), path) : join(root, file);
        if (!existsSync(destination)) broken.push(`${file}: missing ${target}`);
        else if (fragment && statSync(destination).isFile() && destination.endsWith(".md")) {
          if (!anchors(readFileSync(destination, "utf8")).has(fragment)) {
            broken.push(`${file}: missing fragment ${target}`);
          }
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("preserves old agent reference entry points after extraction", () => {
    const found = anchors(readFileSync(join(root, docs, "agents.md"), "utf8"));
    for (const anchor of [
      "agent-playbook-v0",
      "agent-seams-arggon-init---agents----no-agents",
      "orphaned-destinations-what-init-reaps-and-when",
      "worktree-in-the-claim-start---worktree",
      "readiness-reporting-manifestcoverage",
      "install-hygiene",
      "fresh-worktree-install-gate-bug-start-install-ordering",
      "worktree-env-contract-arggonenv",
      "single-writer-ownership-claim-stamp-exploration-017-f12",
      "failure-semantics",
      "force-push-spellings-what-the-seam-permits-and-what-it-refuses",
      "which-layer-enforces-the-seams-shell-gates",
      "cleanup",
      "worktree-ownership-and-collisions",
      "decision-briefs-and-the-answer-grammar",
      "native-start-dependency-contract",
      "what-to-update-by-change-type",
      "specs-and-plans-for-non-trivial-features",
      "technology-playbooks-stack-decisions-and-doc-freshness",
      "promoting-lessons-promote-never-store",
      "verification-before-opening-the-pr",
      "related",
    ])
      expect(found.has(anchor), anchor).toBe(true);
  });

  it("routes fresh adopters to installed project rules, not source-only docs", () => {
    const fixture = mkdtempSync(join(tmpdir(), "arggon-reading-route-"));
    try {
      runInit({ dir: fixture, full: true, force: false, noAgents: true });
      const installedBoundaries = readFileSync(
        join(fixture, ".agents/skills/arggon-cli/references/orchestration.md"),
        "utf8",
      );
      for (const body of Object.values(coreExcerpts(root)))
        expect(installedBoundaries).toContain(body);
      const skill = readFileSync(join(fixture, ".agents/skills/arggon-cli/SKILL.md"), "utf8");
      expect(skill).toContain("repository's root");
      expect(skill).toContain("`AGENTS.md` first");
      expect(skill).toContain("not\ninstalled there");
      expect(existsSync(join(fixture, "AGENTS.md"))).toBe(true);
      for (const file of ["convention.md", "engineering.md"]) {
        expect(existsSync(join(fixture, docs, file))).toBe(true);
      }
      // All actual relative links in the installed umbrella stay in its bundle.
      for (const match of prose(skill).matchAll(/\]\(([^\s)]+)\)/g)) {
        expect(existsSync(resolve(fixture, ".agents/skills/arggon-cli", match[1]!)), match[1]).toBe(
          true,
        );
      }
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
});
