import { readFileSync, writeFileSync } from "node:fs";
import { findTasksDir, itemsById, loadItems } from "@arggondev/lib";

/**
 * Shared test arrange helper for the done gate (task-done-gate-acceptance-waiver,
 * ADR 0015): the kernel refuses `-> done` on a task/bug while its body carries
 * unchecked acceptance checkboxes, so tests that flip items done for OTHER
 * rules (cascade, commit, board, lease, ...) arrange a satisfied contract
 * first instead of waiving — each suite keeps exercising the unwaived path.
 *
 * The replacement targets the same task-list shape `acceptanceComplete` scans
 * (`- [ ]`, leading whitespace and `*` bullets included) and only rewrites the
 * box marker; everything after the frontmatter terminator is the body.
 */
const UNCHECKED = /^([ \t]*[-*] \[) (\])/gm;

function tickedFile(raw: string): string {
  const marker = "\n---\n";
  const sep = raw.indexOf(marker);
  if (sep < 0) throw new Error("tickAcceptance: no frontmatter terminator in item file");
  const bodyStart = sep + marker.length;
  return raw.slice(0, bodyStart) + raw.slice(bodyStart).replace(UNCHECKED, "$1x]");
}

/** Tick every unchecked acceptance checkbox in ONE item's body (in place). */
export function tickAcceptance(cwd: string, id: string): void {
  const tasksDir = findTasksDir(cwd);
  const item = itemsById(loadItems(tasksDir)).get(id);
  if (!item) throw new Error(`tickAcceptance: id '${id}' not found under the tracker`);
  writeFileSync(item.filePath, tickedFile(readFileSync(item.filePath, "utf8")), "utf8");
}

/** Tick every unchecked acceptance checkbox of EVERY item in the tracker tree. */
export function tickAllAcceptance(cwd: string): void {
  const tasksDir = findTasksDir(cwd);
  for (const item of loadItems(tasksDir)) {
    writeFileSync(item.filePath, tickedFile(readFileSync(item.filePath, "utf8")), "utf8");
  }
}
