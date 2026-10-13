import { readFileSync, writeFileSync } from "node:fs";
import {
  findTasksDir,
  itemsById,
  liveAcceptanceRegion,
  liveContextRegion,
  loadItems,
  liveAcceptanceCriteria,
  placeholderSections,
} from "@arggondev/lib";

/**
 * Shared test arrange helper for the done gate (task-done-gate-acceptance-waiver,
 * ADR 0015; scoped by bug-done-gate-counts-checkboxes-inside-comment-blocks).
 *
 * The kernel refuses `-> done` on a claimable leaf when its LIVE `## Acceptance`
 * section carries an unticked criterion — and also when that section publishes
 * no criterion at all, which is every item `arggon create` scaffolds (the
 * template ships a placeholder comment, not a checklist). So the arrange step
 * for a suite that flips items done for OTHER rules (cascade, commit, board,
 * lease, ...) has two halves, and both are needed:
 *
 *   1. tick every unchecked criterion in the body (what the gate reads), and
 *   2. publish a ticked criterion in the live section when it has none.
 *
 * Each suite keeps exercising the unwaived path — no `--waive`, no flag the
 * product does not have.
 *
 * The replacement targets the same task-list shape the kernel's row parser
 * scans (`- [ ]`, leading whitespace and `*` bullets included) and only rewrites
 * the box marker; everything after the frontmatter terminator is the body. The
 * "does it have a live criterion?" question is asked by the kernel
 * (`liveAcceptanceCriteria`), never by a second rule here.
 */
const UNCHECKED = /^([ \t]*[-*] \[) (\])/gm;
const ACCEPTANCE_HEADING = /^##[ \t]+acceptance[ \t]*$/im;
const CONTRACT = "- [x] fixture acceptance contract (arranged by test/acceptance.ts)";

function tickedFile(raw: string): string {
  const marker = "\n---\n";
  const sep = raw.indexOf(marker);
  if (sep < 0) throw new Error("satisfyAcceptance: no frontmatter terminator in item file");
  const bodyStart = sep + marker.length;
  const front = raw.slice(0, bodyStart);
  const body = raw.slice(bodyStart).replace(UNCHECKED, "$1x]");
  return front + publishedContract(body);
}

/**
 * Insert a ticked criterion into the body when its live `## Acceptance` section
 * has none, and return it unchanged when it already has one.
 */
function publishedContract(body: string): string {
  if (liveAcceptanceCriteria(body).length > 0) return body;
  const heading = ACCEPTANCE_HEADING.exec(body);
  if (!heading) return `${body.replace(/\s+$/, "")}\n\n## Acceptance\n\n${CONTRACT}\n`;
  const insertAt = heading.index + heading[0].length;
  return `${body.slice(0, insertAt)}\n\n${CONTRACT}${body.slice(insertAt)}`;
}

/** Arrange a satisfied live acceptance contract for ONE item (in place). */
export function satisfyAcceptance(cwd: string, id: string): void {
  const tasksDir = findTasksDir(cwd);
  const item = itemsById(loadItems(tasksDir)).get(id);
  if (!item) throw new Error(`satisfyAcceptance: id '${id}' not found under the tracker`);
  writeFileSync(item.filePath, tickedFile(readFileSync(item.filePath, "utf8")), "utf8");
}

/** Arrange a satisfied live acceptance contract for EVERY item in the tree. */
export function satisfyAllAcceptance(cwd: string): void {
  const tasksDir = findTasksDir(cwd);
  for (const item of loadItems(tasksDir)) {
    writeFileSync(item.filePath, tickedFile(readFileSync(item.filePath, "utf8")), "utf8");
  }
}

/**
 * Fixture prose substituted for a scaffold marker left in a live section.
 * Deliberately NOT a checkbox: whether the arranged item carries criteria is
 * the caller's business (see `satisfyAcceptance`); this step only removes the
 * marker so `validate` reads real prose.
 */
const FIXTURE_PROSE = "Fixture prose (arranged by test/acceptance.ts).";

/** A full-line scaffold comment inside a live region (spans already excluded). */
const MARKER_LINE = /^[ \t]*<!--[\s\S]*?-->[ \t]*$/gm;

/** The raw-body heading opening one live section (mirrors the kernel's exact match). */
function sectionHeading(section: "Context" | "Acceptance"): RegExp {
  return section === "Context" ? /^##[ \t]+context[ \t]*$/im : /^##[ \t]+acceptance[ \t]*$/im;
}

/**
 * Replace the first occurrence of `marker` at or after the section heading —
 * the live one, since live sections precede the Notes record in file order.
 * Fixture-only approximation (like the rest of this helper): exotic bodies
 * (fenced headings before the live one, marker duplicates inside dated
 * comments) arrange by hand instead.
 */
function clearAfter(raw: string, heading: RegExp, marker: string): string {
  const found = heading.exec(raw);
  if (!found) return raw;
  const at = raw.indexOf(marker, found.index);
  if (at === -1) return raw;
  return `${raw.slice(0, at)}${FIXTURE_PROSE}${raw.slice(at + marker.length)}`;
}

/**
 * Arrange real prose over the scaffold markers of EVERY item in the tree, so a
 * suite that seeds fixtures through `runCreate` (whose scaffold IS the
 * template placeholder) can assert `validate` green for OTHER rules
 * (task-validate-refuses-placeholder-bodies).
 *
 * Detection is the kernel's own (`placeholderSections` — the `<!-- … -->`
 * grammar in the live sections, quoted prose excluded), never a restated
 * marker copy here; only the replacement prose is fixture-owned. Runs AFTER
 * `satisfyAcceptance`/`satisfyAllAcceptance` when a suite needs both (the
 * marker stays put while criteria are arranged, then is replaced).
 */
export function satisfyPlaceholders(cwd: string): void {
  const tasksDir = findTasksDir(cwd);
  for (const item of loadItems(tasksDir)) {
    let out = readFileSync(item.filePath, "utf8");
    const raw = out;
    for (const section of placeholderSections(item.body)) {
      const region =
        section === "Context" ? liveContextRegion(item.body) : liveAcceptanceRegion(item.body);
      if (region === null) continue;
      for (const match of region.matchAll(MARKER_LINE)) {
        out = clearAfter(out, sectionHeading(section), match[0]);
      }
    }
    if (out !== raw) writeFileSync(item.filePath, out, "utf8");
  }
}
