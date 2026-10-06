import { readFileSync, writeFileSync } from "node:fs";
import { findTasksDir, itemsById, loadItems, liveAcceptanceCriteria } from "@arggondev/lib";

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
