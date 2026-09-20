import { randomBytes } from "node:crypto";
import { chmodSync, renameSync, statSync, unlinkSync, writeFileSync, type Stats } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Atomic file write for generated docs (scaffolds, templates) and the
 * the tracker `.convention.yml` config (bug-atomic-write-followups).
 *
 * Writes the content to a temp file in the SAME directory as the target, then
 * `renameSync`s it onto the target. rename(2) is atomic on POSIX, so the
 * target is always either the old content or the full new content — never a
 * truncated/partial file, even if the process is interrupted mid-write.
 *
 * Mode preservation (F2): when the target already exists, its permission bits
 * are applied to the temp file before the rename, so replacing a 0600 file no
 * longer resets it to the default 0644. Ownership cannot be preserved without
 * privileges and hard links to the old inode are necessarily severed by
 * rename(2) — both accepted: every CLI-created file is default-mode and
 * hard-linked generated docs are not a supported layout.
 *
 * Shrink guard (F1): after the rename, the on-disk byte length is verified
 * against the rendered content — but ONLY while the path still holds the very
 * inode this call renamed into place. A non-locking co-writer that replaces
 * the path inside that window (the promotion `depends_on` rewrite, `priority
 * migrate`, a concurrent `create` of the same id — all atomic renames
 * themselves) swaps the inode; the on-disk size then says nothing about our
 * write, so the misleading "refusing to leave a truncated doc" error is not
 * raised. The same holds when the target is moved or deleted by a co-writer
 * (ENOENT after our successful rename). The guard still fires when our own
 * inode is observably short — e.g. a truncating in-place writer touched it
 * between rename and stat.
 */
export function writeFileAtomic(path: string, content: string): void {
  const tmpPath = join(dirname(path), `.${randomBytes(6).toString("hex")}.tmp-${process.pid}`);
  try {
    const mode = existingTargetMode(path);
    writeFileSync(tmpPath, content, "utf8");
    if (mode !== null) chmodSync(tmpPath, mode);
    const tmpStat = statSync(tmpPath);
    renameSync(tmpPath, path);
    verifyOnDisk(path, tmpStat, Buffer.byteLength(content, "utf8"));
  } catch (err) {
    // Best-effort cleanup of the temp file; nothing to do when it was already
    // renamed into place (the failure came from the post-rename guard).
    try {
      unlinkSync(tmpPath);
    } catch {
      // temp already gone (never created or renamed) — nothing to clean up
    }
    throw err;
  }
}

/** Permission bits of an existing target, or null when it does not exist yet. */
function existingTargetMode(path: string): number | null {
  try {
    return statSync(path).mode & 0o7777;
  } catch {
    return null;
  }
}

/**
 * Post-rename shrink guard (see the module doc for the F1 rationale). Throws
 * only while the target is still THIS call's inode (dev+ino identity captured
 * on the temp file before the rename) and its size does not match the rendered
 * content; a same-path replacement or move by a co-writer is tolerated.
 */
function verifyOnDisk(path: string, tmpStat: Stats, expected: number): void {
  let written: Stats;
  try {
    written = statSync(path);
  } catch (err) {
    // Moved/deleted between our rename and this stat — not our truncation.
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
    throw err;
  }
  if (written.size === expected) return;
  // Inode identity is only usable where the platform reports inodes; when it
  // does not (ino 0), keep the conservative pre-fix behavior and throw.
  const ours = tmpStat.ino !== 0 && written.ino === tmpStat.ino && written.dev === tmpStat.dev;
  if (!ours) return; // replaced by a co-writer's rename since our rename
  throw new Error(
    `shrink guard: wrote ${expected} bytes but ${path} has ${written.size} bytes on disk — ` +
      `refusing to leave a truncated doc`,
  );
}
