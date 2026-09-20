import { lstatSync, readlinkSync, rmdirSync, symlinkSync, unlinkSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Worktree dependency-link helpers, shared by every surface (W4,
 * task-native-permissions-worktrees).
 *
 * `arggon start --worktree` links the primary checkout's `node_modules` into a
 * fresh worktree so a dependency-needing pre-commit gate
 * (`npm run arggon -- validate`) can run there
 * (bug-start-worktree-node-modules), and `cleanup --prune` removes that link
 * before deleting the worktree (git refuses to remove a worktree carrying the
 * untracked symlink; review F2). The native `cleanup` tool needs the same
 * unlink step, so the ownership rule lives here, in the kernel, and never
 * forks: only a SYMLINK whose target resolves to the primary checkout's
 * `node_modules` is ever removed.
 */

/**
 * Link the primary checkout's `node_modules` into a worktree that lacks one
 * (bug-start-worktree-node-modules). A fresh worktree has no dependencies, so
 * the documented pre-commit gate (`npm run arggon -- validate`) dies with
 * ERR_MODULE_NOT_FOUND and the claim commit never lands — and the old flow
 * deleted the worktree, so the documented manual symlink order could not work.
 * Best-effort by design: never throws (a platform without symlink support,
 * missing permissions, or a racing creator degrades to `false` and the commit
 * failure is still reported actionably). The link is untracked and, because a
 * `node_modules/` ignore pattern matches directories only, not ignored — but
 * start's claim commit stages only the item file, so start never commits it
 * (stage explicit paths; `git add -A` would stage the link). Returns true only
 * when a link was created.
 */
export function linkNodeModules(primaryRoot: string, worktreePath: string): boolean {
  const target = join(primaryRoot, "node_modules");
  const link = join(worktreePath, "node_modules");
  if (!existsSync(target) || existsSync(link)) return false;
  try {
    // "junction" is the no-privilege directory link on Windows; POSIX ignores
    // the type argument.
    symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove a start-created `node_modules` link from a worktree, if present
 * (bug-start-worktree-node-modules). Only ever removes a SYMLINK whose target
 * resolves to the primary checkout's `node_modules`: a real directory or a
 * link pointing anywhere else is left alone. Removing the link never follows
 * it, so the primary install is untouched. Returns true only when a matching
 * link was removed. Best-effort: never throws.
 */
export function unlinkNodeModulesLink(primaryRoot: string, worktreePath: string): boolean {
  const target = resolve(join(primaryRoot, "node_modules"));
  const link = join(worktreePath, "node_modules");
  try {
    if (!lstatSync(link).isSymbolicLink()) return false;
    // readlink returns the RAW target: a relative target is relative to the
    // link's own directory, never to process.cwd() (review R1). Resolving
    // against cwd would miss a relative link whenever the command runs from
    // anywhere but the primary checkout.
    if (resolve(dirname(link), readlinkSync(link)) !== target) return false;
  } catch {
    return false;
  }
  try {
    unlinkSync(link);
    return true;
  } catch {
    try {
      // Windows junctions are directory links; unlink can refuse them.
      rmdirSync(link);
      return true;
    } catch {
      return false;
    }
  }
}
