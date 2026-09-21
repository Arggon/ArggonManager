import {
  existsSync,
  lstatSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  rmdirSync,
  symlinkSync,
  unlinkSync,
  type Dirent,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

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

/** True when `child` is `parent` itself or lives under it (physical paths). */
function isInside(parent: string, child: string): boolean {
  return child === parent || child.startsWith(`${parent}${sep}`);
}

/**
 * Workspace packages the worktree's install resolves into the **primary**
 * checkout (W6/PR-374 review finding 2).
 *
 * `linkNodeModules` links the primary checkout's whole `node_modules` into the
 * worktree, and npm/workspace links inside it (`node_modules/@arggon/lib ->
 * ../../lib`) therefore resolve to the PRIMARY's copy even though the worktree
 * carries its own `lib/`. For this repo that means the worktree's spawned CLI
 * and child processes run the primary's kernel build: stale whenever the
 * worktree's `lib/` differs, `ERR_MODULE_NOT_FOUND` when the primary was never
 * built. Resolution is a property of the install, so start cannot fix it by
 * fiat — it can only make the requirement visible; these names are reported so
 * the worktree user knows to build where the imports actually resolve, or to
 * give the worktree its own install (`npm ci`, e.g. via
 * `x-worktree.post-start: npm ci`, which npm reifies locally and `prepare`
 * builds).
 *
 * Detection is physical, not textual: symlinks are resolved through their real
 * parent (`node_modules` is itself often a symlink here), and a package only
 * counts when the worktree has the same relative path — a package that exists
 * only in the primary has no worktree copy to shadow. Best-effort by design:
 * never throws, returns `[]` when there is nothing to report.
 */
export function linkedWorkspacePackages(primaryRoot: string, worktreePath: string): string[] {
  const names: string[] = [];
  const worktreeModules = join(worktreePath, "node_modules");
  let primary: string;
  try {
    primary = realpathSync(primaryRoot);
  } catch {
    return names;
  }
  const primaryModules = join(primary, "node_modules");

  const inspect = (name: string, link: string): void => {
    try {
      if (!lstatSync(link).isSymbolicLink()) return;
      const target = resolve(realpathSync(dirname(link)), readlinkSync(link));
      // Inside the primary checkout but not merely inside its install: a real
      // workspace/file link, not an ordinary dependency.
      if (!isInside(primary, target) || isInside(primaryModules, target)) return;
      const rel = relative(primary, target);
      if (rel === "" || !existsSync(join(worktreePath, rel))) return;
      names.push(name);
    } catch {
      // Raced or unreadable entry: nothing to report.
    }
  };

  let entries: Dirent[];
  try {
    entries = readdirSync(worktreeModules, { withFileTypes: true });
  } catch {
    return names; // no install to inspect
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue; // .bin, .package-lock.json, ...
    const path = join(worktreeModules, entry.name);
    if (entry.isDirectory() && entry.name.startsWith("@")) {
      let scoped: Dirent[];
      try {
        scoped = readdirSync(path, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const pkg of scoped) {
        if (pkg.name.startsWith(".")) continue;
        inspect(`${entry.name}/${pkg.name}`, join(path, pkg.name));
      }
      continue;
    }
    inspect(entry.name, path);
  }
  return names.sort();
}
