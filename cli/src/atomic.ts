import { randomBytes } from "node:crypto";
import { renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Atomic file write for generated docs (scaffolds, templates).
 *
 * Writes the content to a temp file in the SAME directory as the target, then
 * `renameSync`s it onto the target. rename(2) is atomic on POSIX, so the
 * target is always either the old content or the full new content — never a
 * truncated/partial file, even if the process is interrupted mid-write.
 *
 * After the rename, a shrink guard verifies the on-disk byte length matches
 * the rendered content; on mismatch it throws loudly instead of silently
 * leaving a truncated doc behind.
 */
export function writeFileAtomic(path: string, content: string): void {
  const tmpPath = join(dirname(path), `.${randomBytes(6).toString("hex")}.tmp-${process.pid}`);
  try {
    writeFileSync(tmpPath, content, "utf8");
    renameSync(tmpPath, path);
  } catch (err) {
    // Best-effort cleanup of the temp file; the target is untouched.
    try {
      unlinkSync(tmpPath);
    } catch {
      // temp already gone (never created or renamed) — nothing to clean up
    }
    throw err;
  }
  const written = statSync(path);
  const expected = Buffer.byteLength(content, "utf8");
  if (written.size !== expected) {
    throw new Error(
      `shrink guard: wrote ${expected} bytes but ${path} has ${written.size} bytes on disk — ` +
        `refusing to leave a truncated doc`,
    );
  }
}
