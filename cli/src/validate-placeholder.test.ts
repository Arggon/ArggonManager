import { mkdtempSync as _mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  acceptanceBody,
  findTasksDir,
  itemsById,
  liveAcceptanceRegion,
  liveContextRegion,
  loadItems,
  placeholderSections,
  regionHasScaffoldMarker,
  runCreate,
  runUpdate,
  runValidate,
  stripInlineCodeSpans,
} from "@arggondev/lib";
import { runInit } from "./init.js";
import { runCli } from "./test-spawn.js";

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string, options?: { encoding?: "utf8" }): string {
  const dir = _mkdtempSync(prefix, options);
  tmpDirs.push(dir);
  return dir;
}

/** The repo root, so markers derive from the scaffold source at run time. */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * `bug-template-only-bodies-ship-green`: the item whose own Context QUOTES the
 * placeholder strings in real content (inline code spans). Read from the tree
 * at test time (frontmatter dropped) rather than pasted, so the negative
 * control cannot drift away from the item it exists to protect.
 */
const QUOTED_BUG_ITEM =
  "ArggonManager/arggon-manager/cli/story-tracker-hygiene/bug-template-only-bodies-ship-green.md";

function bodyOf(path: string): string {
  const raw = readFileSync(join(repoRoot, path), "utf8");
  const end = raw.indexOf("\n---\n");
  if (end < 0) throw new Error(`bodyOf: no frontmatter terminator in ${path}`);
  return raw.slice(end + 5);
}

// ---------------------------------------------------------------------------
// The markers, derived from the scaffold source — never restated here
// (task-validate-refuses-placeholder-bodies). A test that pastes the marker
// strings as literals is the same bug one level down: the guard would match
// its own copy. So every placeholder below is EXTRACTED from `templates/`:
// the live `## Context` / `## Acceptance` region of a template body IS its
// scaffold marker, and the assertions below pin that shape (a template whose
// live region stops being a bare `<!-- … -->` comment fails loudly here
// instead of silently testing nothing).
// ---------------------------------------------------------------------------

function templateBody(type: string): string {
  const raw = readFileSync(join(repoRoot, "templates", `${type}.md`), "utf8");
  const end = raw.indexOf("\n---", 3);
  if (end < 0) throw new Error(`templateBody: no frontmatter in templates/${type}.md`);
  return raw.slice(end + 4).replace(/^\n/, "");
}

/** The live `## Context` marker of one scaffold template (a bare comment). */
function contextMarker(type: string): string {
  const region = liveContextRegion(templateBody(type));
  expect(region, `templates/${type}.md live ## Context is the scaffold marker`).toMatch(
    /^\s*<!--[\s\S]*?-->\s*$/,
  );
  return region!.trim();
}

/** The live `## Acceptance` marker of one scaffold template (a bare comment). */
function acceptanceMarker(type: string): string {
  const region = liveAcceptanceRegion(templateBody(type));
  expect(region, `templates/${type}.md live ## Acceptance is the scaffold marker`).toMatch(
    /^\s*<!--[\s\S]*?-->\s*$/,
  );
  return region!.trim();
}

const NOW = new Date("2026-10-12T12:00:00Z");

/** Seed initiative → epic → story and return the story id. */
function seedChain(dir: string, storyId: string): string {
  // The chain itself carries REAL prose: a seeded container with a scaffold
  // body would trip the very guard under test (correctly), so every helper
  // below authors the scaffolding's sections explicitly.
  const context = "## Context\n\nSeed chain.\n";
  const acceptance = "## Acceptance\n\nSeed chain.\n";
  runCreate({
    cwd: dir,
    type: "initiative",
    title: "Launch MVP",
    body: `${context}\n${acceptance}`,
    now: NOW,
  });
  runCreate({
    cwd: dir,
    type: "epic",
    title: "Auth",
    parent: "launch-mvp",
    body: `${context}\n${acceptance}`,
    now: NOW,
  });
  runCreate({
    cwd: dir,
    type: "story",
    title: "Login",
    parent: "auth",
    id: storyId,
    body: `${context}\n${acceptance}`,
    now: NOW,
  });
  return storyId;
}

/**
 * A temp tracker tree holding ONE open task whose live sections are exactly
 * the template-derived markers (the fixture shape: a placeholder body that
 * must FAIL). `section` selects which live section carries its marker; the
 * other carries real prose.
 */
function placeholderFixture(section: "Context" | "Acceptance"): { dir: string; id: string } {
  const dir = mkdtempSync(join(tmpdir(), "arggon-validate-placeholder-"));
  runInit({ dir, force: false });
  const story = seedChain(dir, "story-s");
  const context = contextMarker("task");
  const acceptance = acceptanceMarker("task");
  const task = runCreate({
    cwd: dir,
    type: "task",
    title: "Placeholder body",
    parent: story,
    id: "placeholder-body",
    body:
      section === "Context"
        ? `## Context\n\n${context}\n\n## Acceptance\n\n- [ ] a real criterion\n`
        : `## Context\n\nReal context prose.\n\n## Acceptance\n\n${acceptance}\n`,
    now: NOW,
  });
  return { dir, id: task.id };
}

function placeholderErrors(dir: string): { path: string; message: string; code: string }[] {
  return runValidate({ cwd: dir }).errors.filter((e) => e.code === "PLACEHOLDER_BODY");
}

describe("validate refuses placeholder bodies on open items", () => {
  it("fails a todo task whose live ## Context still carries the scaffold marker", () => {
    const { dir } = placeholderFixture("Context");
    const errors = placeholderErrors(dir);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.path).toContain("task-placeholder-body.md");
    expect(errors[0]!.message).toMatch(/live '## Context'/);
    // Done/cancelled exclusion is part of the message (the contract, stated).
    expect(errors[0]!.message).toMatch(/done\/cancelled items are excluded/);
  });

  it("fails a todo task whose live ## Acceptance still carries the scaffold marker", () => {
    const { dir } = placeholderFixture("Acceptance");
    const errors = placeholderErrors(dir);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/live '## Acceptance'/);
  });

  it("names both sections when both still carry the marker", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-validate-placeholder-both-"));
    runInit({ dir, force: false });
    const story = seedChain(dir, "story-s");
    // Both markers derived from the bug template (a second scaffold source).
    runCreate({
      cwd: dir,
      type: "bug",
      title: "Both placeholders",
      parent: story,
      id: "both-placeholders",
      body: `## Context\n\n${contextMarker("bug")}\n\n## Acceptance\n\n${acceptanceMarker("bug")}\n`,
      now: NOW,
    });
    const errors = placeholderErrors(dir);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/'## Context' and '## Acceptance'/);
  });

  it("fails in_progress and blocked items the same way (every open status)", () => {
    const { dir, id } = placeholderFixture("Context");
    runUpdate({ cwd: dir, id, status: "in_progress", assignee: "worker", now: NOW });
    expect(placeholderErrors(dir)).toHaveLength(1);
    runUpdate({
      cwd: dir,
      id,
      status: "blocked",
      blockedReason: "waiting on credentials",
      now: NOW,
    });
    const errors = placeholderErrors(dir);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/^open task/);
  });

  it("fails open containers too (the bug was filed on containers)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-validate-placeholder-story-"));
    runInit({ dir, force: false });
    const real = "## Context\n\nReal.\n\n## Acceptance\n\nReal.\n";
    runCreate({ cwd: dir, type: "initiative", title: "I", body: real, now: NOW });
    runCreate({ cwd: dir, type: "epic", title: "E", parent: "i", id: "e", body: real, now: NOW });
    // The story's own live sections carry the story template's markers.
    runCreate({
      cwd: dir,
      type: "story",
      title: "Placeholder story",
      parent: "e",
      id: "placeholder-story",
      body: `## Context\n\n${contextMarker("story")}\n\n## Acceptance\n\n${acceptanceMarker("story")}\n`,
      now: NOW,
    });
    const errors = placeholderErrors(dir);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/^open story/);
  });

  it("excludes done/cancelled items (history, not the contract)", () => {
    const { dir, id } = placeholderFixture("Context");
    // Cancelled directly (todo -> cancelled is a legal flip, no gate).
    runUpdate({ cwd: dir, id, status: "cancelled", now: NOW });
    expect(placeholderErrors(dir)).toEqual([]);
    expect(runValidate({ cwd: dir }).errors).toEqual([]);
  });

  it("excludes a done item even though the done gate had to be waived to close it", () => {
    const { dir, id } = placeholderFixture("Acceptance");
    runUpdate({ cwd: dir, id, status: "in_progress", assignee: "worker", now: NOW });
    // The placeholder body publishes no live contract, so the done gate
    // refuses without a human waiver — the waiver path stays human-only.
    runUpdate({
      cwd: dir,
      id,
      status: "done",
      waive: "closing a placeholder body under test",
      now: NOW,
    });
    expect(placeholderErrors(dir)).toEqual([]);
  });

  it("stays green on quoted placeholder prose (the negative control)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-validate-placeholder-quoted-"));
    runInit({ dir, force: false });
    const story = seedChain(dir, "story-s");
    // The marker TEXTS, derived from the templates above, quoted as content:
    // an inline code span and a fenced block. Both must read as prose.
    const quoted = contextMarker("task");
    runCreate({
      cwd: dir,
      type: "task",
      title: "Quoted marker",
      parent: story,
      id: "quoted-marker",
      body: `## Context\n\nThe scaffold used to say \`${quoted}\` here.\n\n## Acceptance\n\n- [x] real criterion\n\n\`\`\`markdown\n## Context\n\n${quoted}\n\`\`\`\n`,
      now: NOW,
    });
    expect(placeholderSections(quotedBody(dir))).toEqual([]);
    expect(runValidate({ cwd: dir }).errors).toEqual([]);
  });

  /** The canonical body of the quoted-marker item in a temp tree. */
  function quotedBody(cwd: string): string {
    return acceptanceBody(itemsById(loadItems(findTasksDir(cwd))).get("task-quoted-marker")!);
  }

  it("stays green on the real bug-template-only-bodies-ship-green body", () => {
    // THE negative control, from source: that open item quotes the placeholder
    // strings in real content and must keep validating.
    const dir = mkdtempSync(join(tmpdir(), "arggon-validate-placeholder-bugbody-"));
    runInit({ dir, force: false });
    const story = seedChain(dir, "story-s");
    runCreate({
      cwd: dir,
      type: "bug",
      title: "Template-only bodies ship green",
      parent: story,
      id: "template-only-bodies-ship-green",
      body: bodyOf(QUOTED_BUG_ITEM),
      now: NOW,
    });
    expect(runValidate({ cwd: dir }).errors).toEqual([]);
  });

  it("ignores the placement comment (it is not in a live section)", () => {
    const { dir } = placeholderFixture("Context");
    // Precondition: the only error is the Context one — the file-top
    // `<!-- Placement … -->` comment never reports on its own.
    const errors = placeholderErrors(dir);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).not.toMatch(/Placement/);
  });

  it("exits non-zero with the named code on the CLI (the merge-blocking bar)", () => {
    const { dir } = placeholderFixture("Acceptance");
    const proc = runCli(["validate"], dir);
    expect(proc.status).toBe(1);
    expect(proc.stdout).toContain("[PLACEHOLDER_BODY]");
    expect(proc.stdout).toMatch(/done\/cancelled items are excluded/);
  });

  it("exits zero on the CLI for quoted prose (the probe's passing half)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-validate-placeholder-cli-"));
    runInit({ dir, force: false });
    const story = seedChain(dir, "story-s");
    const quoted = acceptanceMarker("task");
    runCreate({
      cwd: dir,
      type: "task",
      title: "Quoted",
      parent: story,
      id: "quoted",
      body: `## Context\n\nReal prose quoting \`${quoted}\`.\n\n## Acceptance\n\n- [x] real criterion\n`,
      now: NOW,
    });
    const proc = runCli(["validate"], dir);
    expect(proc.status).toBe(0);
    expect(proc.stdout).toMatch(/arggon validate: ok/);
  });
});

describe("placeholderSections unit grammar", () => {
  it("reads sections in document order and returns [] on real prose", () => {
    expect(placeholderSections("## Context\n\nReal.\n\n## Acceptance\n\n- [x] done\n")).toEqual([]);
    expect(
      placeholderSections(
        `## Context\n\n${contextMarker("epic")}\n\n## Acceptance\n\n${acceptanceMarker("epic")}\n`,
      ),
    ).toEqual(["Context", "Acceptance"]);
  });

  it("a null region never matches and stripping keeps unclosed spans literal", () => {
    expect(regionHasScaffoldMarker(null)).toBe(false);
    // `` ` `` + marker with no closer is literal text: the marker is real.
    expect(stripInlineCodeSpans("a ` lone tick <!-- x -->")).toContain("<!-- x -->");
    // A closed span quoting the marker strips clean.
    expect(stripInlineCodeSpans("say `<!-- x -->` here")).not.toContain("<!--");
  });
});
