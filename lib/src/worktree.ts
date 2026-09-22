import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
  type Dirent,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

/**
 * Worktree dependency-link helpers, shared by every surface (W4,
 * task-native-permissions-worktrees).
 *
 * `arggon start --worktree` prepares a fresh worktree so the project gate
 * (`npm run arggon -- validate`) can run there
 * (bug-start-worktree-node-modules), and `cleanup --prune` removes that
 * preparation before deleting the worktree (git refuses to remove a worktree
 * carrying an untracked symlink; review F2). The native `cleanup` tool needs
 * the same unlink step, so the ownership rule lives here, in the kernel, and
 * never forks: only a SYMLINK whose target resolves to the primary checkout's
 * `node_modules`, or the start-created link farm itself (marker + matching
 * primary), is ever removed.
 *
 * A fresh worktree has no install, so the primary's install is linked in
 * best-effort (never throws; the claim commit still runs when linking is
 * impossible). Linking the WHOLE install makes workspace packages inside it
 * resolve to the primary checkout's copies, so a worktree editing `lib/` would
 * run the primary's kernel build (W6/PR-374 finding 2). When the worktree
 * carries its own copy of a workspace package, the install is therefore built
 * as a **link farm** instead: a real directory whose entries link the primary's
 * packages, with the packages the worktree owns pointing at the worktree copy
 * (task-start-worktree-lib-resolution). The farm is left at the primary's copy
 * for any local package that is not importable yet (its declared entry file is
 * missing), so the install never dangles; `buildLocalWorkspaces` then runs the
 * package's own `build` script and points the entry locally before the
 * claim-commit gate runs — only when the install can consume the result (a farm
 * of ours to flip, or a reified install already resolving that copy, never a
 * bare symlink left over on an attach) and only when the build exits 0, so a
 * failed build falls back to the primary's copy visibly (PR #388 findings 1/3).
 */

/**
 * One workspace package the worktree carries its own copy of — the npm
 * workspace-link shape (`<install>/@scope/name -> ../../<relativePath>`).
 */
export type LocalWorkspacePackage = {
  /** Package name as it appears in the install, e.g. `@arggon/lib`. */
  name: string;
  /** Absolute path of the worktree's own copy, e.g. `<worktree>/lib`. */
  path: string;
  /** Posix path of the copy relative to the worktree root, e.g. `lib`. */
  relativePath: string;
};

/** Marker file inside a start-created link farm (ownership, see unlink below). */
const LINK_FARM_MARKER = ".arggon-link-farm";

/** True when `child` is `parent` itself or lives under it (physical paths). */
function isInside(parent: string, child: string): boolean {
  return child === parent || child.startsWith(`${parent}${sep}`);
}

/** Parsed package.json, or null when missing/unreadable/not an object. */
function packageManifest(pkgDir: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
    return parsed !== null && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Entry files the package declares, in Node's preference order (`exports["."]`
 * runtime conditions, then `main`, then `index.js`) — enough to answer "is the
 * worktree's own copy importable as published?" without loading it. Build
 * outputs (`lib/dist/index.js`) are exactly the files a fresh worktree lacks.
 */
export function packageEntryPaths(pkgDir: string): string[] {
  const manifest = packageManifest(pkgDir);
  if (!manifest) return [];
  const entries: string[] = [];
  const collect = (value: unknown): void => {
    if (typeof value === "string") {
      entries.push(value);
      return;
    }
    if (value === null || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    for (const condition of ["import", "default", "require", "node"]) collect(record[condition]);
  };
  const exportsField = manifest.exports;
  if (typeof exportsField === "string") collect(exportsField);
  else if (exportsField !== null && typeof exportsField === "object") {
    const record = exportsField as Record<string, unknown>;
    collect("." in record ? record["."] : record);
  }
  if (entries.length === 0) {
    if (typeof manifest.main === "string") entries.push(manifest.main);
    else entries.push("index.js");
  }
  return [...new Set(entries.map((entry) => resolve(pkgDir, entry)))];
}

/** True when at least one declared entry file exists (`main`/`exports` shape). */
export function packageEntryExists(pkgDir: string): boolean {
  const entries = packageEntryPaths(pkgDir);
  return entries.length > 0 && entries.some((entry) => existsSync(entry));
}

/** The package's `build` script, when it declares a non-empty one. */
export function packageBuildScript(pkgDir: string): string | undefined {
  const scripts = packageManifest(pkgDir)?.scripts;
  if (scripts === null || typeof scripts !== "object") return undefined;
  const build = (scripts as Record<string, unknown>).build;
  return typeof build === "string" && build.trim().length > 0 ? build : undefined;
}

/**
 * Workspace links inside the PRIMARY install: entries whose symlink resolves
 * into the primary checkout itself but outside its install
 * (`node_modules/@arggon/lib -> ../../lib`). Ordinary dependencies and
 * install-internal aliases are not workspace links. Physical detection (as in
 * `linkedWorkspacePackages`): symlinks are resolved through their real parent,
 * so a workspace whose own directory does not exist is simply absent.
 * Best-effort: unreadable or raced entries are skipped.
 */
function primaryWorkspaceLinks(
  primaryRoot: string,
): Map<string, { target: string; relativePath: string }> {
  const links = new Map<string, { target: string; relativePath: string }>();
  let primary: string;
  try {
    primary = realpathSync(primaryRoot);
  } catch {
    return links;
  }
  const modules = join(primary, "node_modules");
  const consider = (name: string, link: string): void => {
    try {
      if (!lstatSync(link).isSymbolicLink()) return;
      const target = resolve(realpathSync(dirname(link)), readlinkSync(link));
      if (!isInside(primary, target) || isInside(modules, target)) return;
      const rel = relative(primary, target);
      if (rel === "") return;
      links.set(name, { target, relativePath: rel.split(sep).join("/") });
    } catch {
      // Raced or unreadable entry: nothing to map.
    }
  };
  let entries: Dirent[];
  try {
    entries = readdirSync(modules, { withFileTypes: true });
  } catch {
    return links;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const path = join(modules, entry.name);
    if (entry.name.startsWith("@")) {
      let members: Dirent[];
      try {
        members = readdirSync(path, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const member of members) {
        if (member.name.startsWith(".")) continue;
        consider(`${entry.name}/${member.name}`, join(path, member.name));
      }
      continue;
    }
    consider(entry.name, path);
  }
  return links;
}

/**
 * Workspace packages the worktree carries its own copy of
 * (task-start-worktree-lib-resolution): the primary install links them to the
 * primary checkout, and the same relative path exists in the worktree. These
 * are the packages the install may resolve worktree-locally instead.
 */
export function localWorkspacePackages(
  primaryRoot: string,
  worktreePath: string,
): LocalWorkspacePackage[] {
  return localPackagesFromLinks(primaryWorkspaceLinks(primaryRoot), worktreePath);
}

/** `localWorkspacePackages` over an already-computed link map. */
function localPackagesFromLinks(
  links: Map<string, { target: string; relativePath: string }>,
  worktreePath: string,
): LocalWorkspacePackage[] {
  const packages: LocalWorkspacePackage[] = [];
  for (const [name, link] of links) {
    const path = join(worktreePath, link.relativePath);
    if (!existsSync(path)) continue;
    packages.push({ name, path, relativePath: link.relativePath });
  }
  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Symlink one install entry, "junction" for directories on Windows (no
 * privilege required); POSIX ignores the type argument.
 */
function linkEntry(source: string, to: string): void {
  let type: "dir" | "file" | "junction" = "file";
  try {
    if (statSync(source).isDirectory()) {
      type = process.platform === "win32" ? "junction" : "dir";
    }
  } catch {
    // A raced entry links as a file; it is no more broken than the primary's.
  }
  symlinkSync(source, to, type);
}

/**
 * Mirror the primary install as a directory of symlinks (a "link farm") so a
 * worktree can resolve its OWN workspace copies without duplicating the
 * install: every top-level entry links the primary's package, scoped
 * directories are mirrored one level down, and a local workspace package
 * overrides its entry — but only when the worktree copy is importable as
 * declared (`packageEntryExists`). A copy without its build output keeps the
 * primary's copy (linked directly to the primary package directory, not to the
 * install's own symlink, so the resolution stays physical and detectable), so
 * the farm is never left dangling; `buildLocalWorkspaces` then builds it and
 * flips the entry. Returns false (after cleaning up) when the farm cannot be
 * created, so the caller falls back to the whole-install symlink.
 */
function createLinkFarm(
  target: string,
  link: string,
  workspaceLinks: Map<string, { target: string; relativePath: string }>,
  locals: LocalWorkspacePackage[],
): boolean {
  const overrides = new Map<string, string>();
  for (const pkg of locals) {
    if (packageEntryExists(pkg.path)) overrides.set(pkg.name, pkg.path);
  }
  // The fallback for a workspace link is the primary's own package directory:
  // linking to the install's symlink would chain back through the install and
  // hide the shadowing from `linkedWorkspacePackages` (W6/PR-374 finding 2).
  const sourceFor = (name: string, from: string): string =>
    overrides.get(name) ?? workspaceLinks.get(name)?.target ?? from;
  try {
    mkdirSync(link, { recursive: true });
  } catch {
    return false;
  }
  try {
    for (const entry of readdirSync(target, { withFileTypes: true })) {
      const from = join(target, entry.name);
      if (entry.name.startsWith("@")) {
        let members: Dirent[];
        try {
          members = readdirSync(from, { withFileTypes: true });
        } catch {
          linkEntry(from, join(link, entry.name));
          continue;
        }
        mkdirSync(join(link, entry.name), { recursive: true });
        for (const member of members) {
          const name = `${entry.name}/${member.name}`;
          linkEntry(sourceFor(name, join(from, member.name)), join(link, entry.name, member.name));
        }
        continue;
      }
      linkEntry(sourceFor(entry.name, from), join(link, entry.name));
    }
    writeFileSync(join(link, LINK_FARM_MARKER), `${resolve(target)}\n`);
    return true;
  } catch {
    try {
      rmSync(link, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup: the caller falls back to the whole-install link.
    }
    return false;
  }
}

/**
 * Link the primary checkout's install into a worktree that lacks one
 * (bug-start-worktree-node-modules), as a link farm when the worktree carries
 * its own workspace package copy (task-start-worktree-lib-resolution). A fresh
 * worktree has no dependencies, so the documented pre-commit gate
 * (`npm run arggon -- validate`) dies with ERR_MODULE_NOT_FOUND and the claim
 * commit never lands — and the old flow deleted the worktree, so the documented
 * manual symlink order could not work. Best-effort by design: never throws (a
 * platform without symlink support, missing permissions, or a racing creator
 * degrades to `false` and the commit failure is still reported actionably). The
 * install is untracked but, because a `node_modules/` ignore pattern matches
 * directories only, a link farm IS ignored while a bare symlink is not — start's
 * claim commit stages only the item file either way (stage explicit paths;
 * `git add -A` would stage the bare link). Returns true only when an install was
 * created.
 */
export function linkNodeModules(primaryRoot: string, worktreePath: string): boolean {
  const target = join(primaryRoot, "node_modules");
  const link = join(worktreePath, "node_modules");
  if (!existsSync(target) || existsSync(link)) return false;
  const workspaceLinks = primaryWorkspaceLinks(primaryRoot);
  const locals = localPackagesFromLinks(workspaceLinks, worktreePath);
  if (locals.length > 0 && createLinkFarm(target, link, workspaceLinks, locals)) return true;
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
 * The start-created link farm in `worktreePath` when it exists and belongs to
 * THIS primary install: a real directory (never a symlink) whose marker names
 * the primary's `node_modules`. Anything else (npm-reified install, foreign
 * directory, absent install) is not ours and must never be touched.
 */
function ownedLinkFarm(primaryRoot: string, worktreePath: string): string | null {
  const link = join(worktreePath, "node_modules");
  try {
    if (lstatSync(link).isSymbolicLink()) return null;
    const marker = readFileSync(join(link, LINK_FARM_MARKER), "utf8").trim();
    if (marker.length === 0) return null;
    if (resolve(marker) !== resolve(join(primaryRoot, "node_modules"))) return null;
    return link;
  } catch {
    return null;
  }
}

/**
 * Remove a start-created install from a worktree, if present
 * (bug-start-worktree-node-modules / task-start-worktree-lib-resolution). Only
 * ever removes a SYMLINK whose target resolves to the primary checkout's
 * `node_modules`, or a link farm this start created (real directory + matching
 * marker): a real install or a link/directory pointing anywhere else is left
 * alone. Removing a farm never follows its entries, so the primary install is
 * untouched. Returns true only when a matching install was removed.
 * Best-effort: never throws.
 */
export function unlinkNodeModulesLink(primaryRoot: string, worktreePath: string): boolean {
  const target = resolve(join(primaryRoot, "node_modules"));
  const link = join(worktreePath, "node_modules");
  let isLink: boolean;
  try {
    isLink = lstatSync(link).isSymbolicLink();
  } catch {
    return false;
  }
  if (isLink) {
    try {
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
  if (ownedLinkFarm(primaryRoot, worktreePath) === null) return false;
  try {
    // The farm holds only symlinks plus the scoped directories we created, so
    // a recursive remove unlinks the entries without ever following them into
    // the primary install.
    rmSync(link, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Point a farm entry at the worktree's own copy of a workspace package
 * (task-start-worktree-lib-resolution), after `buildLocalWorkspaces` made that
 * copy importable. Only ever rewrites an entry inside a farm this start created
 * (`ownedLinkFarm`): an npm-reified install or a foreign directory is left
 * alone. Returns true when the entry now resolves to the worktree copy.
 * Best-effort: never throws.
 */
export function pointWorkspaceAtLocal(
  primaryRoot: string,
  worktreePath: string,
  name: string,
): boolean {
  const link = ownedLinkFarm(primaryRoot, worktreePath);
  if (link === null) return false;
  const local = localWorkspacePackages(primaryRoot, worktreePath).find((pkg) => pkg.name === name);
  if (!local) return false;
  const entry = join(link, ...name.split("/"));
  // Swap through a staged link: the entry keeps resolving into the primary
  // until the new link exists, so a failure never leaves a hole in the install.
  const staged = `${entry}.arggon-new`;
  try {
    unlinkSync(staged); // a leftover from an interrupted run
  } catch {
    // Nothing staged: expected.
  }
  try {
    linkEntry(local.path, staged);
  } catch {
    return false;
  }
  try {
    renameSync(staged, entry);
    return true;
  } catch {
    try {
      unlinkSync(staged);
    } catch {
      // Best-effort: the entry still resolves into the primary.
    }
    return false;
  }
}

/**
 * Runs one package's `build` script in its directory (injectable for tests).
 * Returns true only when the build succeeded (exit 0): callers never trust an
 * entry a failed build emitted (PR #388 review finding 1).
 */
export type WorkspaceBuildRunner = (pkgDir: string) => boolean;

/**
 * `npm run build` in the package directory, inheriting the invoking env. The
 * exit status is the contract: `tsc` without `noEmitOnError` emits output for a
 * build it reports as failed, and flipping that partial entry would run the
 * gate against a build the package itself rejected.
 */
function defaultWorkspaceBuildRunner(pkgDir: string): boolean {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npm, ["run", "build"], {
    cwd: pkgDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return result.error === undefined && result.status === 0;
}

/**
 * True when the worktree's install can consume a local build: start's own link
 * farm (which `pointWorkspaceAtLocal` flips once the entry exists), or an
 * install entry that already resolves the worktree's copy (an npm-reified
 * `npm ci`, whose workspace link points at `../../lib` — the declared entry is
 * what the gate then needs). A bare symlink to the primary install — or no
 * install at all — keeps resolving the primary's copy, so building the local
 * one only costs time: attach re-runs skip it (PR #388 review finding 3).
 * Physical and best-effort: an unreadable entry is a no.
 */
function installConsumesLocalBuild(
  primaryRoot: string,
  worktreePath: string,
  pkg: LocalWorkspacePackage,
): boolean {
  if (ownedLinkFarm(primaryRoot, worktreePath) !== null) return true;
  try {
    const local = realpathSync(pkg.path);
    const target = realpathSync(join(worktreePath, "node_modules", ...pkg.name.split("/")));
    return isInside(local, target);
  } catch {
    return false;
  }
}

/**
 * Pre-build the worktree's own copies of the workspace packages the install
 * shadows, so the claim-commit gate can load them worktree-locally
 * (task-start-worktree-lib-resolution). A fresh worktree has no build output
 * (`lib/dist` is gitignored), so `linkNodeModules` leaves those entries on the
 * primary's copy and the gate would run the PRIMARY's kernel — exactly the
 * staleness W6/PR-374 flagged. For every local package whose declared entry is
 * missing, the package's own `build` script is run (the repo's build, not a
 * hardcoded kernel step) — but only when the install can consume the result
 * (`installConsumesLocalBuild`) and only when the build exits 0; when the entry
 * exists afterwards the farm entry is pointed at the worktree copy, otherwise
 * the primary's copy stands and `linkedWorkspacePackages` reports the package.
 * Never throws: a failed or absent build degrades to the previous (reported)
 * behavior. Returns the names it built and pointed locally.
 */
export function buildLocalWorkspaces(
  primaryRoot: string,
  worktreePath: string,
  deps: { runBuild?: WorkspaceBuildRunner } = {},
): string[] {
  const runBuild = deps.runBuild ?? defaultWorkspaceBuildRunner;
  const built: string[] = [];
  for (const pkg of localWorkspacePackages(primaryRoot, worktreePath)) {
    try {
      if (packageEntryExists(pkg.path)) continue; // already importable
      if (packageBuildScript(pkg.path) === undefined) continue; // nothing to run
      // Never pay for a build the install cannot use: with a bare symlink to
      // the primary install there is no farm to flip, so an attach re-run would
      // rebuild for ~2s and still resolve the primary's copy (PR #388 finding 3).
      if (!installConsumesLocalBuild(primaryRoot, worktreePath, pkg)) continue;
      // The exit is honored: a failed build falls back visibly even when it
      // emitted the declared entry (`tsc` without `noEmitOnError`), so the gate
      // never runs a kernel the package itself reported as failed.
      if (!runBuild(pkg.path)) continue;
      // A build that did not produce the declared entry leaves the primary's
      // copy in place: the gate keeps a loadable package and the report names
      // the shadowed one.
      if (!packageEntryExists(pkg.path)) continue;
      if (pointWorkspaceAtLocal(primaryRoot, worktreePath, pkg.name)) built.push(pkg.name);
    } catch {
      // Best-effort: one broken package never fails the start (or the others).
    }
  }
  return built;
}

/**
 * Workspace packages the worktree's install still resolves into the **primary**
 * checkout (W6/PR-374 finding 2).
 *
 * After `linkNodeModules` / `buildLocalWorkspaces`, a workspace package the
 * worktree owns resolves to the worktree copy; only packages that stayed on the
 * primary's copy land here — an unbuilt local copy with no `build` script, a
 * failed build, or an install too broken to flip. Resolution is a property of
 * the install, so start cannot fix it by fiat: these names are reported so the
 * worktree user knows the requirement (build where the imports resolve, or give
 * the worktree its own install — `npm ci`, e.g. via `x-worktree.post-start: npm
 * ci`, which npm reifies locally and `prepare` builds).
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
