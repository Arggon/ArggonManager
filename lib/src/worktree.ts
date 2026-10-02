import { spawnSync } from "node:child_process";
import {
  closeSync,
  constants as fsConstants,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
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
  writeSync,
  type Dirent,
} from "node:fs";
import { homedir as osHomedir } from "node:os";
import { basename, delimiter, dirname, join, relative, resolve, sep } from "node:path";

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
 *
 * A linked install MIRRORS the primary's, so it is only as current as that
 * install: a dependency added to `package.json` after the primary's last install
 * is missing from every worktree until the primary is re-installed, and the
 * mirrored install used to be reported as ready anyway
 * (bug-worktree-readiness-misses-stale-primary-install).
 * `inspectDeclaredDependencies` compares the declared top-level dependency names
 * against what the worktree can actually resolve, and the preparation receipt
 * names the missing ones — without turning start into a package manager (no
 * version solving, no transitive walk, no install it runs itself).
 */

/**
 * One workspace package the worktree carries its own copy of — the npm
 * workspace-link shape (`<install>/@scope/name -> ../../<relativePath>`).
 */
export type LocalWorkspacePackage = {
  /** Package name as it appears in the install, e.g. `@arggondev/lib`. */
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
 * (`node_modules/@arggondev/lib -> ../../lib`). Ordinary dependencies and
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
 * Why `linkNodeModules` did (or did not) lay an install
 * (bug-start-install-ordering): every incident flavor of the eight-count
 * record was a silent `false` here — a skipped farm whose reason was never
 * surfaced. The detailed outcome makes the skip reason nameable, so the
 * preparation receipt can correlate a refusal (or a broken worktree) with the
 * exact decision that produced it.
 *
 * - `farm-created`: the per-worktree link farm was laid (workspace copies shadowed).
 * - `symlink-created`: a bare symlink to the primary install (no workspace
 *   packages to shadow).
 * - `farm-failed-symlink-fallback`: the farm could not be created and the bare
 *   symlink stood in — the worktree now resolves the PRIMARY's workspace
 *   copies (the W6 staleness), so `linkedWorkspaces` will report them.
 * - `worktree-install-present`: skipped — the worktree already had a
 *   `node_modules` (an attach re-run, or a PARTIAL install left by an
 *   interrupted `npm ci`; reused as-is, never repaired — the gate-bin probe
 *   names what the reused install cannot provide).
 * - `primary-install-missing`: skipped — the primary checkout had no
 *   `node_modules` at preparation time. Either the repo has no install (fresh
 *   clone) or one was in flight (`npm ci`/`npm install` deletes the tree
 *   first) — the intermittent flavor behind the "no install at all" incidents.
 * - `failed`: neither the farm nor the bare symlink could be created
 *   (permissions, platform without symlinks).
 */
export type LinkOutcome =
  | "farm-created"
  | "symlink-created"
  | "farm-failed-symlink-fallback"
  | "worktree-install-present"
  | "primary-install-missing"
  | "failed";

/** Result of `linkNodeModulesDetailed`: the boolean plus WHY. */
export type LinkNodeModulesResult = { linked: boolean; outcome: LinkOutcome };

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
  return linkNodeModulesDetailed(primaryRoot, worktreePath).linked;
}

/** `linkNodeModules` plus the named outcome (bug-start-install-ordering). */
export function linkNodeModulesDetailed(
  primaryRoot: string,
  worktreePath: string,
): LinkNodeModulesResult {
  const target = join(primaryRoot, "node_modules");
  const link = join(worktreePath, "node_modules");
  if (!existsSync(target)) return { linked: false, outcome: "primary-install-missing" };
  if (existsSync(link)) return { linked: false, outcome: "worktree-install-present" };
  const workspaceLinks = primaryWorkspaceLinks(primaryRoot);
  const locals = localPackagesFromLinks(workspaceLinks, worktreePath);
  if (locals.length > 0 && createLinkFarm(target, link, workspaceLinks, locals)) {
    return { linked: true, outcome: "farm-created" };
  }
  try {
    // "junction" is the no-privilege directory link on Windows; POSIX ignores
    // the type argument.
    symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
    return {
      linked: true,
      // A farm that could not be created falls back to the whole-install
      // symlink: usable for the gate, but the worktree now resolves the
      // PRIMARY's workspace copies — named so the fallback is never silent.
      outcome: locals.length > 0 ? "farm-failed-symlink-fallback" : "symlink-created",
    };
  } catch {
    return { linked: false, outcome: "failed" };
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
  deps: {
    runBuild?: WorkspaceBuildRunner;
    /** Per-package outcome collector (bug-start-install-ordering instrumentation). */
    onStep?: (outcome: string, pkg: string) => void;
  } = {},
): string[] {
  const runBuild = deps.runBuild ?? defaultWorkspaceBuildRunner;
  const built: string[] = [];
  for (const pkg of localWorkspacePackages(primaryRoot, worktreePath)) {
    try {
      if (packageEntryExists(pkg.path)) {
        deps.onStep?.("entry-exists", pkg.name); // already importable
        continue;
      }
      if (packageBuildScript(pkg.path) === undefined) {
        deps.onStep?.("no-build-script", pkg.name); // nothing to run
        continue;
      }
      // Never pay for a build the install cannot use: with a bare symlink to
      // the primary install there is no farm to flip, so an attach re-run would
      // rebuild for ~2s and still resolve the primary's copy (PR #388 finding 3).
      if (!installConsumesLocalBuild(primaryRoot, worktreePath, pkg)) {
        deps.onStep?.("install-cannot-consume", pkg.name);
        continue;
      }
      // The exit is honored: a failed build falls back visibly even when it
      // emitted the declared entry (`tsc` without `noEmitOnError`), so the gate
      // never runs a kernel the package itself reported as failed.
      if (!runBuild(pkg.path)) {
        deps.onStep?.("build-failed", pkg.name);
        continue;
      }
      // A build that did not produce the declared entry leaves the primary's
      // copy in place: the gate keeps a loadable package and the report names
      // the shadowed one.
      if (!packageEntryExists(pkg.path)) {
        deps.onStep?.("build-no-entry", pkg.name);
        continue;
      }
      if (pointWorkspaceAtLocal(primaryRoot, worktreePath, pkg.name)) {
        deps.onStep?.("built", pkg.name);
        built.push(pkg.name);
      } else {
        deps.onStep?.("flip-failed", pkg.name);
      }
    } catch {
      // Best-effort: one broken package never fails the start (or the others).
      deps.onStep?.("errored", pkg.name);
    }
  }
  return built;
}

/**
 * Cap on the missing-dependency names a bounded report carries: enough to name
 * a stale install's usual one or two devDependencies without letting a large
 * manifest (or an attacker-shaped `package.json`) inflate the receipt.
 */
export const MAX_MISSING_DEPENDENCIES = 10;

/**
 * Whether the worktree's install actually provides what the worktree's own
 * `package.json` declares — the half of readiness a link farm cannot know,
 * because a farm mirrors the PRIMARY's entries: a dependency merged after that
 * install ran is simply absent, and every worktree stays broken until the
 * primary is re-installed (bug-worktree-readiness-misses-stale-primary-install).
 *
 * - `satisfied`: every declared top-level `dependencies`/`devDependencies`
 *   name resolves through the install on the worktree's resolution path — or
 *   the worktree declares none at all.
 * - `stale`: at least one does not; the report names them.
 * - `unknown`: nothing was compared — there is no install on the resolution
 *   path, or the manifest is not readable as a JSON object (what npm itself
 *   rejects with `EJSONPARSE`, plus a non-object root). Never reported as
 *   satisfied, and `ready` follows it to false.
 *
 * What `satisfied` does NOT claim. It is a **presence** check over the declared
 * top-level set, not an install verification: installed versions are never
 * compared against the declared ranges (an outdated-but-present package
 * counts as provided), and transitive, peer and bundled dependencies are never
 * inspected. `optionalDependencies` are excluded deliberately — being absent is
 * what that field allows. "Present" is a directory named after the dependency
 * on the resolution path, which is the same presence npm's own hoisting aims
 * for, not a simulated module resolution.
 */
export type ManifestCoverage = "satisfied" | "stale" | "unknown";

/** Bounded result of `inspectDeclaredDependencies`. */
export type DeclaredDependencyReport = {
  coverage: ManifestCoverage;
  /** Missing dependency names, sorted and capped at `MAX_MISSING_DEPENDENCIES`. */
  missing: string[];
  /** Full count of missing names — `missing` is capped below it when they differ. */
  missingTotal: number;
};

/**
 * Top-level `dependencies` + `devDependencies` names a manifest declares, or
 * null when `package.json` is present but not readable as a JSON object.
 *
 * The three outcomes map onto the receipt one-for-one: no `package.json` means
 * the tree declares NOTHING (an empty set, never a stale verdict — a
 * dependency-free project must keep its readiness); a manifest that is not
 * readable as an object means NOTHING WAS COMPARED (`unknown` — the verdict
 * never guesses, and `ready` follows it to false); a readable one yields its
 * declared names.
 *
 * npm's own tolerance is the bar, and the one place they differ is the UTF-8
 * BOM: `json-parse-even-better-errors` (behind `read-package-json`) strips it,
 * so a BOM-ed `package.json` installs fine and must not be called unreadable
 * here. Everything npm rejects with `EJSONPARSE` — comments, trailing commas,
 * truncation, an empty file, a non-object root — is rejected identically by
 * `JSON.parse`, so `unknown` there matches npm instead of out-strictifying it.
 * The shared `packageManifest` helper is deliberately left strict: it feeds the
 * link farm's entry detection, where silently accepting a workspace manifest
 * would change which copy resolves.
 */
function declaredDependencyNames(pkgDir: string): string[] | null {
  const path = join(pkgDir, "package.json");
  if (!existsSync(path)) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object") return null;
  const manifest = parsed as Record<string, unknown>;
  const names = new Set<string>();
  for (const field of ["dependencies", "devDependencies"]) {
    const section = manifest[field];
    if (section === null || typeof section !== "object" || Array.isArray(section)) continue;
    for (const name of Object.keys(section)) {
      if (name.length > 0) names.add(name);
    }
  }
  return [...names].sort();
}

/**
 * The `node_modules` directories Node consults for a bare specifier required
 * from `fromDir`: its own, then each parent's, up to the filesystem root. A
 * start-created link farm or a bare symlink to the primary install is found
 * here like any other install; empty when the path has no install at all.
 */
function installResolutionPath(fromDir: string): string[] {
  const roots: string[] = [];
  let dir = resolve(fromDir);
  for (;;) {
    const modules = join(dir, "node_modules");
    if (existsSync(modules)) roots.push(modules);
    const parent = dirname(dir);
    if (parent === dir) return roots;
    dir = parent;
  }
}

/** Where a gate binary was observed resolving from, relative to the worktree. */
export type GateBinSource =
  /** `<worktree>/node_modules/.bin/<name>` exists (any install state — the worktree's own path provides it). */
  | "worktree"
  /** Found on the parent-directory walk, above the worktree root. */
  | "external"
  /** Found on the invoking process's PATH (a sibling checkout, a global install). */
  | "path"
  /** Found nowhere: the gate cannot run unless a worktree-local install appears. */
  | "missing";

/** One gate binary's observed resolution. */
export type GateBinResolution = {
  /** Bin name as the gate invokes it (e.g. `tsx`). */
  name: string;
  /** Where the first resolution hit came from. */
  source: GateBinSource;
  /** Absolute path of the hit; absent when `source: "missing"`. */
  path?: string;
};

/**
 * Cap on the gate bins a bounded receipt carries: enough for a repo's usual
 * one or two runner binaries without letting a manifest with hundreds of
 * binned dependencies inflate the report.
 */
export const MAX_GATE_BINS = 8;

/**
 * Bin names a package exposes (`bin` as a string uses the package's own name;
 * a record maps bin name → entry path), or [] when it exposes none.
 */
function packageBinNames(pkgDir: string, packageName: string): string[] {
  const manifest = packageManifest(pkgDir);
  if (manifest === null) return [];
  const bin = manifest.bin;
  if (typeof bin === "string" && bin.length > 0) {
    const own = packageName.split("/").pop() ?? packageName;
    return own.length > 0 ? [own] : [];
  }
  if (bin !== null && typeof bin === "object" && !Array.isArray(bin)) {
    return Object.keys(bin).filter((name) => name.length > 0);
  }
  return [];
}

/** First install on `modules` that provides `name`, or null. */
function installedPackageDir(modules: string[], name: string): string | null {
  const segments = name.split("/");
  for (const root of modules) {
    const dir = join(root, ...segments);
    if (existsSync(join(dir, "package.json"))) return dir;
  }
  return null;
}

/**
 * First `.bin/<bin>` hit on the worktree's module resolution walk, classified
 * by where the hit sits relative to the worktree root: the walk continues
 * past the worktree (parent directories can carry an install too), and only
 * hits at or below `worktreePath` count as the worktree's own.
 */
function binOnResolutionPath(
  fromDir: string,
  worktreePath: string,
  bin: string,
): { path: string; source: "worktree" | "external" } | null {
  let dir = resolve(fromDir);
  for (;;) {
    const candidate = join(dir, "node_modules", ".bin", bin);
    if (existsSync(candidate)) {
      return {
        path: candidate,
        source: isInside(resolve(worktreePath), dir) ? "worktree" : "external",
      };
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** First PATH directory providing the bin file, or null. Deterministic given the env. */
function binOnPath(bin: string, env: NodeJS.ProcessEnv): string | null {
  const search = env.PATH ?? env.Path;
  if (typeof search !== "string" || search.length === 0) return null;
  for (const dir of search.split(delimiter)) {
    if (dir.length === 0) continue;
    const candidate = join(dir, bin);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Report which node_modules the gate binaries a worktree's project gate needs
 * actually resolve from (bug-start-worktree-npm-ci-claim): a fresh worktree
 * with no install used to fail its claim commit with a bare
 * `tsx: command not found`, and a sibling worktree's `.bin` on the invoking
 * PATH could silently run the gate against a foreign install. Readiness names
 * the source instead of letting the resolution stay invisible.
 *
 * The probed bins are the ones the worktree's own manifest declares that
 * expose a `bin` field, discovered from the worktree's resolution path first
 * and the primary's install second (a cold worktree discovers from the primary
 * exactly because it cannot resolve anything itself). Resolution order is the
 * gate's real lookup order: the worktree's module walk (own install before
 * parent directories), then PATH. Read-only and best-effort: an undeclared or
 * undiscoverable bin is simply not reported, and nothing here throws.
 */
export function inspectGateBinResolution(
  worktreePath: string,
  primaryRoot?: string,
  env: NodeJS.ProcessEnv = process.env,
): GateBinResolution[] {
  const declared = declaredDependencyNames(worktreePath);
  if (declared === null || declared.length === 0) return [];
  const discovery = installResolutionPath(worktreePath);
  if (primaryRoot !== undefined) discovery.push(...installResolutionPath(primaryRoot));
  const names = new Set<string>();
  for (const dep of declared) {
    if (names.size >= MAX_GATE_BINS) break;
    const dir = installedPackageDir(discovery, dep);
    if (dir !== null) {
      // Installed somewhere: probe the bins it really exposes.
      const bins = packageBinNames(dir, dep);
      if (bins.length === 0) continue; // installed, exposes no bin
      for (const bin of bins) {
        names.add(bin);
        if (names.size >= MAX_GATE_BINS) break;
      }
      continue;
    }
    // Not installed anywhere — the missing-install flavor itself: fall back to
    // the package's own name, npm's convention for a string `bin` (tsx, eslint,
    // vitest). Reporting `<dep>: not resolvable` is true then — neither the
    // module nor any bin of it resolves on this worktree — and a dep that is
    // present but exposes no bin is never probed under a guessed name.
    names.add(dep);
  }
  const resolveBin = (bin: string): GateBinResolution => {
    const onModules = binOnResolutionPath(worktreePath, worktreePath, bin);
    if (onModules !== null) return { name: bin, source: onModules.source, path: onModules.path };
    const onPath = binOnPath(bin, env);
    if (onPath !== null) return { name: bin, source: "path", path: onPath };
    return { name: bin, source: "missing" };
  };
  return [...names].sort().slice(0, MAX_GATE_BINS).map(resolveBin);
}

/**
 * The gate bins a strict start gate would refuse (task-start-gate-strict-mode):
 * every reported bin whose resolution sits OUTSIDE the worktree — `external`
 * (a parent-directory install), `path` (a sibling checkout's or global `.bin`
 * on the invoking PATH), and `missing` (resolves nowhere: the no-link-farm
 * flavor, bug-start-worktree-npm-ci-claim incident 4). A `worktree` source and
 * an empty report (nothing declared exposes a bin) are both passes — strict
 * mode never invents a violation the report-only probe did not observe.
 */
export function strictGateBinViolations(gateBins: GateBinResolution[]): GateBinResolution[] {
  return gateBins.filter((bin) => bin.source !== "worktree");
}

/**
 * The actionable refusal message for `x-tracker.strict-gate-bins: true`
 * (task-start-gate-strict-mode), or null when the gate passes. Named per bin
 * with its observed source, and remediated with the exact `npm ci` fix; the
 * caller (CLI or native start) wraps it with its own flow context and the
 * attach re-run guidance. The same violations feed the report-only receipt's
 * `ready` clause — strict mode changes the CONSEQUENCE, never the observation.
 */
export function strictGateBinFailure(
  gateBins: GateBinResolution[],
  worktreePath: string,
): string | null {
  const broken = strictGateBinViolations(gateBins);
  if (broken.length === 0) return null;
  const named = broken
    .map((bin) => {
      if (bin.source === "missing") return `${bin.name}: not resolvable from the worktree`;
      if (bin.source === "path") {
        return `${bin.name}: resolves only via PATH from ${bin.path} (outside the worktree)`;
      }
      return `${bin.name}: resolves from ${bin.path}, above the worktree`;
    })
    .join("; ");
  return (
    `x-tracker.strict-gate-bins is set: refusing the claim commit — gate binaries do not ` +
    `resolve inside the worktree: ${named}. ` +
    `Fix: run \`npm ci\` in ${worktreePath} for a worktree-local install.`
  );
}

/**
 * The refusal for a worktree this start CREATED (bug-start-install-ordering):
 * a fresh `start --worktree` must ALWAYS leave a gate-usable install — or fail
 * before any claim commit with the named cause. This is the root fix for the
 * eight-incident record: the preparation steps used to degrade silently (a
 * skipped farm, a mid-install primary, a PATH-masked resolution) and the claim
 * commit then died at the gate with a bare `tsx: command not found`, stranding
 * the worker. The refusal names the offending bins (same observation strict
 * mode uses — the flag changes the consequence, never the observation), the
 * preparation log that produced the state, and the exact fix.
 *
 * Default-on for fresh worktrees — no flag required: a start that created the
 * worktree vouches for its install, and must not hand the worker a broken one.
 * Attach re-runs are NOT covered here (their report-only receipt — or the
 * armed strict gate — governs them), so the documented `npm ci` then attach
 * remedy stays possible. Null when nothing declared exposes a bin (the
 * documented carve-out: a project with no dependency-needing gate may still
 * have no install and commit the claim).
 */
export function freshWorktreeInstallRefusal(
  gateBins: GateBinResolution[],
  worktreePath: string,
  steps: WorktreePrepStep[] = [],
): string | null {
  const broken = strictGateBinViolations(gateBins);
  if (broken.length === 0) return null;
  const named = broken
    .map((bin) => {
      if (bin.source === "missing") return `${bin.name}: not resolvable from the worktree`;
      if (bin.source === "path") {
        return `${bin.name}: resolves only via PATH from ${bin.path} (outside the worktree)`;
      }
      return `${bin.name}: resolves from ${bin.path}, above the worktree`;
    })
    .join("; ");
  const prep =
    steps.length > 0
      ? ` Preparation ran: ${steps
          .map((entry) => `${entry.step}:${entry.outcome}${entry.pkg ? ` (${entry.pkg})` : ""}`)
          .join(", ")}.`
      : "";
  return (
    `refusing the claim commit — a fresh worktree must leave a gate-usable install, and ` +
    `these gate binaries do not resolve inside it: ${named}.${prep} ` +
    `Fix: run \`npm ci\` in ${worktreePath} for a worktree-local install ` +
    `(or \`npm install\` in the primary checkout if its install is stale or missing), ` +
    `then re-run start --worktree to attach.`
  );
}

/**
 * Report whether the install a worktree resolves through provides what that
 * worktree's own manifest declares (bug-worktree-readiness-misses-stale-primary-install).
 *
 * Cheap and read-only: one `existsSync` per declared name per install on the
 * resolution path — top-level manifests declare tens of names, not thousands.
 * Never throws and never guesses: an unreadable manifest or an install-free
 * resolution path is `unknown`, not `satisfied`, so a caller can never read a
 * `satisfied` verdict as "the install is complete".
 */
export function inspectDeclaredDependencies(worktreePath: string): DeclaredDependencyReport {
  const declared = declaredDependencyNames(worktreePath);
  if (declared === null) return { coverage: "unknown", missing: [], missingTotal: 0 };
  if (declared.length === 0) return { coverage: "satisfied", missing: [], missingTotal: 0 };
  const roots = installResolutionPath(worktreePath);
  // Nothing to compare against: `install` already reports the absent install,
  // and naming every declared dependency here would only restate it.
  if (roots.length === 0) return { coverage: "unknown", missing: [], missingTotal: 0 };
  const missing = declared.filter((name) => {
    const segments = name.split("/");
    return !roots.some((root) => existsSync(join(root, ...segments)));
  });
  return {
    coverage: missing.length === 0 ? "satisfied" : "stale",
    missing: missing.slice(0, MAX_MISSING_DEPENDENCIES),
    missingTotal: missing.length,
  };
}

// ---------------------------------------------------------------------------
// Worktree env contract (spec worktree-env-contract-016)
// ---------------------------------------------------------------------------

/**
 * The six documented env keys (`docs/specs/spec-worktree-env-contract-016.md`),
 * in file and receipt order. `ARGON_ITEM` is the one deliberate non-`ARGGON_`
 * prefix: it is the exact name the OpenCode plugin already correlates sessions
 * with, kept for contract compatibility.
 */
export const WORKTREE_ENV_KEYS = [
  "ARGON_ITEM",
  "ARGGON_WORKTREE_ID",
  "ARGGON_WORKTREE_PATH",
  "ARGGON_WORKTREE_BRANCH",
  "ARGGON_STATE_DIR",
  "ARGGON_CACHE_DIR",
] as const;

/**
 * The additive `preparation.env` receipt fragment. `written: true` carries the
 * full shape; `written: false` guarantees only `warning` (the failure /
 * skipped reason — opt-out, write failure, unreadable state, or an existing
 * file left byte-identical), with `path`/`gitignored`/`seededDotenv` present
 * when they are knowable. The claim is never refused for any of these.
 */
export type WorktreeEnvReceipt = {
  /** True only when this run created `.arggon.env`; attach runs report false. */
  written: boolean;
  /** Absolute path of the env file, when known. */
  path?: string;
  /** The keys a fresh write contains, in order (only on a fresh write). */
  keys?: string[];
  /** Absolute path of the seeded worktree `.env`, when one was copied. */
  seededDotenv?: string;
  /** `git check-ignore .arggon.env` probe result, when the probe answered. */
  gitignored?: boolean;
  /** Why nothing was (re)written or what degraded — never blocks the claim. */
  warning?: string;
};

/** Item identity the env contract needs beyond the two roots. */
export type WorktreeEnvIdentity = {
  /** The claimed item id (`ARGON_ITEM`). */
  itemId: string;
  /** The recorded working branch (`ARGGON_WORKTREE_BRANCH`). */
  branch: string;
};

/**
 * Read-only `git check-ignore` probe (injectable for tests): true = ignored,
 * false = not ignored, undefined = the probe did not answer (no git, error).
 */
export type CheckIgnoreRunner = (cwd: string, relPath: string) => boolean | undefined;

/** Env-contract request passed to `prepareWorktreeDependencies`. */
export type WorktreeEnvRequest = {
  identity: WorktreeEnvIdentity;
  /** `false` = the `x-worktree.env: false` opt-out; absent/true = enabled. */
  enabled?: boolean;
  /** Environment for the per-OS base resolution (defaults to `process.env`). */
  env?: NodeJS.ProcessEnv;
  /** Home override for the per-OS base resolution (defaults to `os.homedir()`). */
  home?: string;
  /** Gitignore-probe override (tests); defaults to a real `git check-ignore`. */
  checkIgnore?: CheckIgnoreRunner;
};

/**
 * Per-OS state base (env-paths mapping, spec worktree-env-contract-016): XDG
 * `XDG_STATE_HOME` (else `~/.local/state`) on Linux, `~/Library/Application
 * Support` on macOS, `%LOCALAPPDATA%` on Windows. The kernel invents no new
 * scheme; `env`/`home` are injectable so tests stay hermetic.
 */
export function worktreeStateBase(env: NodeJS.ProcessEnv, home: string): string {
  switch (process.platform) {
    case "darwin":
      return join(home, "Library", "Application Support");
    case "win32":
      return env.LOCALAPPDATA ?? join(home, "AppData", "Local");
    default:
      return env.XDG_STATE_HOME ?? join(home, ".local", "state");
  }
}

/**
 * Per-OS cache base (env-paths mapping): `XDG_CACHE_HOME` (else `~/.cache`)
 * on Linux, `~/Library/Caches` on macOS, `%LOCALAPPDATA%` on Windows. On
 * Windows the two bases coincide by the spec's own mapping, so the state and
 * cache dirs share the `%LOCALAPPDATA%/<repo>-<item-id>` directory there.
 */
export function worktreeCacheBase(env: NodeJS.ProcessEnv, home: string): string {
  switch (process.platform) {
    case "darwin":
      return join(home, "Library", "Caches");
    case "win32":
      return env.LOCALAPPDATA ?? join(home, "AppData", "Local");
    default:
      return env.XDG_CACHE_HOME ?? join(home, ".cache");
  }
}

/** First line of an error, for bounded best-effort warnings. */
function envErrorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).split("\n")[0] ?? "unknown error";
}

/** The default read-only gitignore probe: `git check-ignore --quiet`. */
function defaultCheckIgnore(cwd: string, relPath: string): boolean | undefined {
  const result = spawnSync("git", ["check-ignore", "--quiet", relPath], {
    cwd,
    encoding: "utf8",
    timeout: 10_000,
  });
  if (result.error !== undefined) return undefined;
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  return undefined; // not a repo, git missing, or another probe error: no answer
}

/**
 * Write the per-worktree env contract (spec worktree-env-contract-016): a
 * dotenv-style `.arggon.env` at the worktree root carrying the worktree
 * identity (the six `WORKTREE_ENV_KEYS`), a `.env` seeded copy-if-absent from
 * the primary checkout, and the two per-OS suffixed state/cache directories
 * (`mkdir -p`). Filesystem-only — no Docker, no network, no shell beyond the
 * read-only `git check-ignore` probe — and best-effort by invariant: any
 * failure is a receipt warning while the claim proceeds.
 *
 * Never-overwrite is enforced at the filesystem level: the env file is opened
 * `wx` (the write fails if the file raced into existence) and the `.env` seed
 * copies with `COPYFILE_EXCL`, so an existing file is always left
 * byte-identical — the attach path never rewrites an adopter's copy.
 */
export function prepareWorktreeEnv(
  primaryRoot: string,
  worktreePath: string,
  request: WorktreeEnvRequest,
): WorktreeEnvReceipt {
  if (request.enabled === false) {
    return { written: false, warning: "disabled via x-worktree.env: false" };
  }
  const env = request.env ?? process.env;
  const home = request.home ?? osHomedir();
  const worktreeId = basename(worktreePath);
  const stateDir = join(worktreeStateBase(env, home), worktreeId);
  const cacheDir = join(worktreeCacheBase(env, home), worktreeId);
  const warnings: string[] = [];
  try {
    mkdirSync(stateDir, { recursive: true });
    mkdirSync(cacheDir, { recursive: true });
  } catch (error) {
    return {
      written: false,
      warning: `could not create the per-worktree state/cache dirs: ${envErrorMessage(error)}`,
    };
  }
  const checkIgnore = request.checkIgnore ?? defaultCheckIgnore;
  const ignored = checkIgnore(worktreePath, ".arggon.env");
  const gitignored = ignored === undefined ? undefined : ignored;
  // .env seeding: copy-if-absent, never read for interpretation, never
  // overwritten (COPYFILE_EXCL makes the guarantee race-safe). A failure is
  // collected as a receipt warning and NEVER dropped — the spec invariant is
  // "any failure is recorded in the receipt as a warning", on the attach and
  // success returns just as much as on the write-failure one.
  let seededDotenv: string | undefined;
  const dotenvSource = join(primaryRoot, ".env");
  const dotenvTarget = join(worktreePath, ".env");
  if (!existsSync(dotenvTarget) && existsSync(dotenvSource)) {
    try {
      copyFileSync(dotenvSource, dotenvTarget, fsConstants.COPYFILE_EXCL);
      seededDotenv = dotenvTarget;
    } catch (error) {
      warnings.push(`could not seed .env: ${envErrorMessage(error)}`);
    }
  }
  const attachWarning = (): string =>
    [...warnings, "already exists — left byte-identical (never overwritten)"].join("; ");
  const envPath = join(worktreePath, ".arggon.env");
  if (existsSync(envPath)) {
    return {
      written: false,
      path: envPath,
      ...(gitignored !== undefined ? { gitignored } : {}),
      ...(seededDotenv !== undefined ? { seededDotenv } : {}),
      warning: attachWarning(),
    };
  }
  // `KEY=value` lines, UTF-8, LF, no quoting; CR/LF is stripped from values so
  // a hostile id/branch cannot split the line-oriented format.
  const value = (raw: string): string => raw.replace(/[\r\n]+/g, " ");
  const body =
    [
      `ARGON_ITEM=${value(request.identity.itemId)}`,
      `ARGGON_WORKTREE_ID=${value(worktreeId)}`,
      `ARGGON_WORKTREE_PATH=${value(resolve(worktreePath))}`,
      `ARGGON_WORKTREE_BRANCH=${value(request.identity.branch)}`,
      `ARGGON_STATE_DIR=${value(stateDir)}`,
      `ARGGON_CACHE_DIR=${value(cacheDir)}`,
    ].join("\n") + "\n";
  try {
    // `wx` fails when the file exists: the never-overwrite invariant holds
    // even against a creator racing this write.
    const fd = openSync(envPath, "wx");
    try {
      writeSync(fd, body, 0, "utf8");
    } finally {
      closeSync(fd);
    }
  } catch (error) {
    if (existsSync(envPath)) {
      // Lost a creation race: the file is there, leave it byte-identical.
      return {
        written: false,
        path: envPath,
        ...(gitignored !== undefined ? { gitignored } : {}),
        ...(seededDotenv !== undefined ? { seededDotenv } : {}),
        warning: attachWarning(),
      };
    }
    warnings.push(`could not write .arggon.env: ${envErrorMessage(error)}`);
    return {
      written: false,
      ...(gitignored !== undefined ? { gitignored } : {}),
      warning: warnings.join("; "),
    };
  }
  return {
    written: true,
    path: envPath,
    keys: [...WORKTREE_ENV_KEYS],
    ...(seededDotenv !== undefined ? { seededDotenv } : {}),
    ...(gitignored !== undefined ? { gitignored } : {}),
    // A degraded-but-successful write (a failed .env seed) still names what
    // failed: the warning channel exists for exactly this, on every path.
    ...(warnings.length > 0 ? { warning: warnings.join("; ") } : {}),
  };
}

/** What dependency preparation found (or created) in a worktree. */
export type WorktreeInstallState = "linked" | "existing" | "missing" | "unavailable";

/**
 * One bounded entry of the preparation log (bug-start-install-ordering): WHICH
 * prep path ran, so an incident's worktree state can be correlated with the
 * exact decision that produced it — a created/reused/failed link farm, a
 * skipped-and-named build, and the final gate-bin verdict. Eight consolidated
 * incidents were all silent decisions here; the log makes every skip nameable.
 */
export type WorktreePrepStep = {
  /** Preparation phase that produced the entry: the link, a build, the probe. */
  step: "link" | "build" | "gate-bins";
  /** Bounded outcome token (e.g. `farm-created`, `primary-install-missing`). */
  outcome: string;
  /** Workspace package the outcome is about (build entries only). */
  pkg?: string;
};

/**
 * Cap on the preparation-log entries a bounded receipt carries: enough for the
 * link decision, every workspace build decision of a normal repo, and the
 * probe verdict, without letting a hundred-workspace monorepo inflate it.
 */
export const MAX_PREP_STEPS = 16;

/**
 * Bounded-shape receipt for the shared pre-claim dependency preparation.
 *
 * `ready` means all four of: an install is present, no worktree-owned
 * workspace package still resolves into the primary checkout, the install
 * provides what the worktree's own manifest declares (`manifestCoverage:
 * "satisfied"`), AND every reported gate binary resolves from the worktree
 * itself (`gateBins`, bug-start-worktree-npm-ci-claim). It grew the third clause deliberately
 * (bug-worktree-readiness-misses-stale-primary-install): a link farm mirrors the
 * primary's entries, so a devDependency merged since that install ran was
 * invisible here and the receipt claimed readiness a gate could not use. The
 * verdict is the conjunction; `manifestCoverage` + `missingDependencies` +
 * `gateBins` say
 * WHICH clause failed, so `ready: false` is always actionable without a diffing
 * script. A false receipt is informative, not a blanket start failure: the CLI
 * keeps its historical best-effort fallback, while native start surfaces it and
 * still makes the claim-commit result authoritative.
 */
export type WorktreeDependencyPreparation = {
  ready: boolean;
  install: WorktreeInstallState;
  linkedNodeModules: boolean;
  builtWorkspaces: string[];
  linkedWorkspaces: string[];
  /** Whether the install provides the worktree's declared dependencies. */
  manifestCoverage: ManifestCoverage;
  /** Declared dependency names the install does not provide (sorted, capped). */
  missingDependencies: string[];
  /** Full count behind `missingDependencies`; the two differ only when capped. */
  missingDependenciesTotal: number;
  /**
   * Which node_modules the project gate's binaries resolve from, relative to
   * the worktree (bug-start-worktree-npm-ci-claim), sorted by name and capped
   * at `MAX_GATE_BINS`. A `path` source is the silent-masking flavor: the gate
   * can pass on a sibling checkout's binary while the worktree's own install
   * is broken or absent. `ready` requires every reported bin to resolve from
   * the worktree; an empty report (nothing declared exposes a bin) leaves
   * `ready` unchanged.
   */
  gateBins: GateBinResolution[];
  /**
   * The bounded preparation log (bug-start-install-ordering): which prep path
   * ran — link farm created / reused / skipped-and-why, per-workspace build
   * decisions, and the gate-bin probe verdict — capped at `MAX_PREP_STEPS`.
   * This is the instrumentation the eight-incident record asked for: a
   * refusal, a failed gate, or a broken worktree can now be correlated with
   * the exact silent decision that used to produce it.
   */
  steps: WorktreePrepStep[];
  /** Present only when the log hit `MAX_PREP_STEPS` and entries were dropped. */
  stepsTruncated?: true;
  /**
   * The worktree env contract receipt (spec worktree-env-contract-016), when
   * the caller requested it (`deps.env`) — present on every `start --worktree`
   * run of both surfaces, absent from direct kernel callers that pass no
   * `deps.env` (legacy shape unchanged). Best-effort: a `written: false` here
   * never blocks the claim.
   */
  env?: WorktreeEnvReceipt;
  /**
   * The claim-stamp receipt (task-single-writer-worktree-enforcement), when
   * the caller requested it (`deps.claim`) — present on every `start
   * --worktree` run of both surfaces, absent from direct kernel callers that
   * pass no `deps.claim` (legacy shape unchanged). Best-effort: the stamp and
   * a fired `foreignWrites` detection never block the claim by themselves; the
   * surfaces decide the consequence via `x-tracker.strict-worktree-writes`.
   */
  claim?: WorktreeClaimReceipt;
};

/**
 * Remove the start-created env contract file from a worktree, if present
 * (spec worktree-env-contract-016): an untracked `.arggon.env` blocks
 * `git worktree remove` exactly like the start-created install link did
 * (review F2), and the lifecycle that creates must also delete (exploration
 * 017 F8). Ownership mirrors `unlinkNodeModulesLink`: only a file whose every
 * line is one of the six documented `KEY=value` pairs counts as start-created
 * shape — an adopter-customized env file (comments, extra keys, a symlink) is
 * adopter-owned and left for git to report. Returns true only when a matching
 * file was removed. Best-effort: never throws.
 */
export function unlinkWorktreeEnv(worktreePath: string): boolean {
  const envPath = join(worktreePath, ".arggon.env");
  let raw: string;
  try {
    if (lstatSync(envPath).isSymbolicLink()) return false; // never remove a link
    raw = readFileSync(envPath, "utf8");
  } catch {
    return false;
  }
  const lines = raw.split("\n");
  if (lines.pop() !== "") return false; // the contract file ends with a newline
  if (lines.length === 0) return false;
  const keys = new Set<string>(WORKTREE_ENV_KEYS);
  for (const line of lines) {
    const eq = line.indexOf("=");
    if (eq <= 0 || !keys.has(line.slice(0, eq))) return false;
  }
  try {
    rmSync(envPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Claim-stamp bookkeeping (task-single-writer-worktree-enforcement,
 * exploration 017 F12): single-writer ownership of a claimed worktree is
 * convention, not enforcement — this is the detection layer underneath it.
 *
 * Every `start --worktree` writes a small claim stamp recording WHICH identity
 * claimed the worktree and WHEN (the file lives inside the worktree's git dir,
 * so it never appears in `git status`, never blocks `git worktree remove`, and
 * needs no cleanup lifecycle — git owns that directory). On an ATTACH, the
 * previous stamp is read before it is replaced: a DIFFERENT identity plus
 * tracked files modified after the stamped claim is the F12 signature (a
 * concurrent writer active under someone else's claim), reported as a named,
 * bounded warning on both surfaces — or escalated to an attach refusal by
 * `x-tracker.strict-worktree-writes`, mirroring `strict-gate-bins`.
 *
 * Detection is deliberately bounded: one `git status --porcelain` of the
 * worktree plus one `stat` per dirty tracked path — no full-tree walks, no
 * filesystem watchers. It observes the UNCOMMITTED collision window; foreign
 * work that was already committed is history, not a live second writer, and an
 * unreadable or missing stamp degrades to no detection (pre-feature
 * worktrees), never to a false accusation.
 */

/** The stamp file, inside the worktree's git dir (never in the work tree). */
const CLAIM_STAMP_FILE = "arggon-claim.json";

/** One claim stamp as written at start and read back at attach. */
export type WorktreeClaimStamp = {
  /**
   * Owner identity: the calling session id on the native surface, the
   * resolved assignee on the CLI (which has no session id).
   */
  identity: string;
  /** The claimed item id. */
  item: string;
  /** The recorded working branch at claim time. */
  branch: string;
  /** ISO-8601 claim timestamp — the mtime anchor for attach-time detection. */
  claimedAt: string;
  /** Assignee at claim time, when known (named in reports). */
  assignee?: string;
  /** Writing surface (`cli`/`native`), diagnostic only. */
  surface?: string;
};

/**
 * Cap on the dirty tracked paths a detection report NAMES (the count stays
 * exact): the same bounded shape as `missingDependencies` — a trashed
 * worktree must not inflate the receipt, but must not hide how much is dirty.
 */
export const MAX_CLAIM_WRITE_NAMES = 10;

/**
 * Read-only `git rev-parse --absolute-git-dir` probe (injectable for tests):
 * the worktree's git dir, or undefined when the probe did not answer.
 */
export type GitDirRunner = (cwd: string) => string | undefined;

/** Read-only `git status --porcelain` probe (injectable for tests). */
export type WorktreeStatusRunner = (cwd: string) => string | undefined;

function defaultAbsoluteGitDir(cwd: string): string | undefined {
  const result = spawnSync("git", ["rev-parse", "--absolute-git-dir"], {
    cwd,
    encoding: "utf8",
    timeout: 10_000,
  });
  const out = String(result.stdout ?? "").trim();
  if (result.error !== undefined || result.status !== 0 || out.length === 0) return undefined;
  return out;
}

function defaultWorktreeStatus(cwd: string): string | undefined {
  const result = spawnSync("git", ["status", "--porcelain"], {
    cwd,
    encoding: "utf8",
    timeout: 10_000,
  });
  if (result.error !== undefined || result.status !== 0) return undefined;
  return String(result.stdout ?? "");
}

/** Absolute path of a worktree's claim stamp, or undefined without a git dir. */
function claimStampPath(worktreePath: string, deps: { gitDir?: GitDirRunner }): string | undefined {
  const gitDir = (deps.gitDir ?? defaultAbsoluteGitDir)(worktreePath);
  if (gitDir === undefined || gitDir.length === 0) return undefined;
  return join(gitDir, CLAIM_STAMP_FILE);
}

/**
 * Read a worktree's claim stamp (tolerantly: any absence, parse error, or
 * missing field is `null` — a corrupt stamp degrades to no detection, never
 * to a false accusation). Never throws.
 */
export function readWorktreeClaimStamp(
  worktreePath: string,
  deps: { gitDir?: GitDirRunner } = {},
): WorktreeClaimStamp | null {
  const path = claimStampPath(worktreePath, deps);
  if (path === undefined) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (parsed === null || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    const identity = typeof record.identity === "string" ? record.identity : undefined;
    const item = typeof record.item === "string" ? record.item : undefined;
    const branch = typeof record.branch === "string" ? record.branch : undefined;
    const claimedAt = typeof record.claimedAt === "string" ? record.claimedAt : undefined;
    if (
      identity === undefined ||
      item === undefined ||
      branch === undefined ||
      claimedAt === undefined
    ) {
      return null;
    }
    return {
      identity,
      item,
      branch,
      claimedAt,
      ...(typeof record.assignee === "string" && record.assignee.length > 0
        ? { assignee: record.assignee }
        : {}),
      ...(typeof record.surface === "string" && record.surface.length > 0
        ? { surface: record.surface }
        : {}),
    };
  } catch {
    return null;
  }
}

/**
 * Write a worktree's claim stamp (atomically: temp file + rename), best-effort
 * — a stamp that cannot be written only costs detection coverage on the next
 * attach, so the write never blocks the claim. Returns true when written.
 */
function writeWorktreeClaimStamp(
  worktreePath: string,
  stamp: WorktreeClaimStamp,
  deps: { gitDir?: GitDirRunner },
): boolean {
  const path = claimStampPath(worktreePath, deps);
  if (path === undefined) return false;
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(tmp, `${JSON.stringify(stamp, null, 2)}\n`, "utf8");
    renameSync(tmp, path);
    return true;
  } catch {
    try {
      rmSync(tmp, { force: true });
    } catch {
      // already gone
    }
    return false;
  }
}

/**
 * The tracked-modified paths of `git status --porcelain` output, in output
 * order: every line that is not untracked (`??`), ignored (`!!`), or blank;
 * rename lines (`R  old -> new`) contribute the post-rename path. Raw output
 * (not trimmed): the leading status columns matter to the parser.
 */
export function parseTrackedModifications(porcelain: string): string[] {
  const paths: string[] = [];
  for (const line of porcelain.split("\n")) {
    if (line.trim().length === 0) continue;
    const code = line.slice(0, 2);
    if (code === "??" || code === "!!") continue;
    let path = line.slice(3).trim();
    const arrow = path.indexOf(" -> ");
    if (arrow !== -1) path = path.slice(arrow + 4);
    path = path.replace(/^"|"$/g, "");
    if (path.length > 0) paths.push(path);
  }
  return paths;
}

/** A fired attach-time detection: who owned the window and what moved. */
export type WorktreeForeignWriteReport = {
  /** Identity the worktree was stamped with (the previous owner). */
  owner: string;
  /** That owner's claim timestamp (the mtime anchor), ISO-8601. */
  claimedAt: string;
  /** Tracked paths modified after the claim, capped at `MAX_CLAIM_WRITE_NAMES`. */
  files: string[];
  /** Full count of tracked paths modified after the claim. */
  total: number;
};

/**
 * Compare a worktree's dirty tracked files against a previous owner's claim
 * stamp (attach-time detection, F12): a tracked path whose mtime is NEWER than
 * the stamped claim was written during that owner's window — by the owner
 * (uncommitted work) or by a concurrent writer — and the attacher cannot tell
 * which. Bounded: one porcelain read plus one `stat` per dirty path, no
 * full-tree walks. Best-effort: a status probe that does not answer, an
 * unparsable stamp timestamp, or an unreadable path degrades toward no fire.
 */
export function detectWorktreeForeignWrites(
  worktreePath: string,
  stamp: WorktreeClaimStamp,
  deps: { status?: WorktreeStatusRunner } = {},
): WorktreeForeignWriteReport | null {
  const claimedMs = Date.parse(stamp.claimedAt);
  if (!Number.isFinite(claimedMs)) return null;
  const porcelain = (deps.status ?? defaultWorktreeStatus)(worktreePath);
  if (porcelain === undefined) return null;
  const files: string[] = [];
  let total = 0;
  for (const rel of parseTrackedModifications(porcelain)) {
    let mtimeMs: number;
    try {
      mtimeMs = statSync(resolve(worktreePath, rel)).mtimeMs;
    } catch {
      continue; // raced or unreadable: nothing to compare for this path
    }
    if (mtimeMs > claimedMs) {
      total++;
      if (files.length < MAX_CLAIM_WRITE_NAMES) files.push(rel);
    }
  }
  if (total === 0) return null;
  return { owner: stamp.identity, claimedAt: stamp.claimedAt, files, total };
}

/**
 * The bounded warning sentence for a fired detection (report-only default):
 * names the stamped owner, the claim time, and the newer tracked files. The
 * same observation feeds `strictWorktreeWriteFailure` when the flag is armed —
 * the flag changes the consequence, never the observation.
 */
export function worktreeForeignWriteWarning(report: WorktreeForeignWriteReport): string {
  const extra = report.total - report.files.length;
  const named = report.files.join(", ");
  return (
    `the worktree is stamped by session ${report.owner} (claimed ${report.claimedAt}) and ` +
    `${report.total} tracked file${report.total === 1 ? " was" : "s were"} modified after that ` +
    `claim: ${named}${extra > 0 ? ` (and ${extra} more)` : ""} — that session's uncommitted ` +
    "work or a concurrent writer; check before writing here"
  );
}

/**
 * The actionable refusal for `x-tracker.strict-worktree-writes: true`
 * (task-single-writer-worktree-enforcement), or null when nothing fired. Same
 * observation as the warning, stronger consequence: the caller (CLI or native
 * start) refuses the claim before any item mutation. The remedy names the
 * coordination step, not a destructive one — the stamped session may simply be
 * mid-task (that is the F12 incident, seen from outside).
 */
export function strictWorktreeWriteFailure(report: WorktreeForeignWriteReport): string | null {
  if (report.total === 0) return null;
  const extra = report.total - report.files.length;
  const named = report.files.join(", ");
  return (
    `x-tracker.strict-worktree-writes is set: refusing the claim — the worktree is stamped by ` +
    `session ${report.owner} (claimed ${report.claimedAt}) and ${report.total} tracked ` +
    `file${report.total === 1 ? " was" : "s were"} modified after that claim: ` +
    `${named}${extra > 0 ? ` (and ${extra} more)` : ""}. ` +
    "Another session may be writing here; coordinate with the stamped session (or have it " +
    "re-attach to refresh the stamp), then re-run start --worktree to attach. This refusal " +
    "never re-stamps the worktree, so a retry re-detects the same evidence; if the stamped " +
    "session is gone, confirm no live writer and remove the stamp by hand " +
    '(rm "$(git -C <worktree> rev-parse --absolute-git-dir)/arggon-claim.json").'
  );
}

/** Claim-stamp request passed to `prepareWorktreeDependencies` (`deps.claim`). */
export type WorktreeClaimRequest = {
  /** Owner identity to stamp (session id on native, assignee on CLI). */
  identity: string;
  /** The claimed item id. */
  itemId: string;
  /** The recorded working branch. */
  branch: string;
  /** Assignee at claim time, when known (named in reports). */
  assignee?: string;
  /** Writing surface (`cli`/`native`), diagnostic only. */
  surface?: "cli" | "native";
  /** Claim timestamp; a Date or ISO string, defaulting to the current time. */
  now?: string | Date;
  /** Porcelain-probe override (tests); defaults to a real `git status`. */
  status?: WorktreeStatusRunner;
  /** Git-dir-probe override (tests); defaults to a real `git rev-parse`. */
  gitDir?: GitDirRunner;
};

/** The additive claim-stamp receipt fragment (`preparation.claim`). */
export type WorktreeClaimReceipt = {
  /**
   * True when the worktree carries a claim stamp after the run — this run's
   * stamp, or the PREVIOUS owner's when a fired detection suppressed the
   * replacement (a refusal must never refresh the stamp it refused against).
   */
  stamped: boolean;
  /**
   * A fired attach-time detection (present only when the previous stamp named
   * a DIFFERENT identity and tracked files moved after that claim). Never
   * blocks the claim by itself — `x-tracker.strict-worktree-writes` decides
   * the consequence on the surfaces.
   */
  foreignWrites?: WorktreeForeignWriteReport;
  /** Degradation note (e.g. the stamp could not be written) — never blocking. */
  warning?: string;
};

/**
 * Stamp-or-detect one worktree for a start run: read the previous stamp, fire
 * the detection when a DIFFERENT identity owned the window, then write this
 * run's stamp (the rolling ownership record). One deliberate exception — the
 * anti-unlock rule (review on task-single-writer-worktree-enforcement): when
 * the detection FIRES, the replacement is suppressed and the previous stamp
 * stands. Writing the new stamp anyway would let a STRICT-refused attach
 * re-stamp the worktree with the refused caller's identity, so the retry
 * would see a matching stamp, skip detection, and claim silently over the
 * foreign window — the gate would unlock itself. With the previous stamp
 * kept, every retry re-detects against the SAME evidence until the stamped
 * owner re-attaches (refreshing it legitimately) or the documented manual
 * recovery (`rm <git-dir>/arggon-claim.json`) is used. Best-effort by
 * invariant — every degradation lands in the receipt as a warning, never as a
 * throw.
 */
function prepareWorktreeClaim(
  worktreePath: string,
  request: WorktreeClaimRequest,
): WorktreeClaimReceipt {
  const previous = readWorktreeClaimStamp(worktreePath, request);
  let foreignWrites: WorktreeForeignWriteReport | undefined;
  if (previous !== null && previous.identity !== request.identity) {
    foreignWrites = detectWorktreeForeignWrites(worktreePath, previous, request) ?? undefined;
    if (foreignWrites !== undefined) {
      // Anti-unlock: keep the previous stamp (see above); nothing is written.
      return {
        stamped: true,
        foreignWrites,
      };
    }
  }
  const claimedDate =
    request.now === undefined
      ? new Date()
      : request.now instanceof Date
        ? request.now
        : new Date(request.now);
  const claimedAt = (Number.isNaN(claimedDate.getTime()) ? new Date() : claimedDate).toISOString();
  const stamped = writeWorktreeClaimStamp(
    worktreePath,
    {
      identity: request.identity,
      item: request.itemId,
      branch: request.branch,
      claimedAt,
      ...(request.assignee !== undefined && request.assignee.length > 0
        ? { assignee: request.assignee }
        : {}),
      ...(request.surface !== undefined ? { surface: request.surface } : {}),
    },
    request,
  );
  return {
    stamped,
    ...(stamped ? {} : { warning: "could not write the claim stamp" }),
  };
}

/**
 * Prepare a worktree's project dependencies before its claim commit.
 *
 * This is the one kernel-level orchestration point shared by CLI and native
 * `start`: it links the primary install (or reuses an existing one), builds
 * worktree-owned workspace packages, and reports the final resolution. Git
 * worktree creation, claim records, push and domain operations stay with their
 * owning callers; the helper only touches dependency state in the two roots.
 * All low-level steps remain best-effort, so a missing install or an
 * unbuildable workspace is reported for the caller to act on rather than
 * thrown from the kernel.
 */
export function prepareWorktreeDependencies(
  primaryRoot: string,
  worktreePath: string,
  deps: {
    runBuild?: WorkspaceBuildRunner;
    env?: WorktreeEnvRequest;
    claim?: WorktreeClaimRequest;
  } = {},
): WorktreeDependencyPreparation {
  // Claim stamp (task-single-writer-worktree-enforcement): runs FIRST, before
  // any write of this run, so the detection observes exactly the writes that
  // happened between the previous owner's stamp and this attach. Absent
  // `deps.claim` = the caller did not request stamping: the receipt keeps its
  // legacy shape.
  const claimReceipt =
    deps.claim === undefined ? undefined : prepareWorktreeClaim(worktreePath, deps.claim);
  // Worktree env contract (spec worktree-env-contract-016): runs first and
  // best-effort, so even a later install-gate refusal leaves the kept
  // worktree with its env contract in place. Absent `deps.env` = the caller
  // did not request env preparation: the receipt keeps its legacy shape.
  const envReceipt =
    deps.env === undefined ? undefined : prepareWorktreeEnv(primaryRoot, worktreePath, deps.env);
  const worktreeModules = join(worktreePath, "node_modules");
  // Bounded preparation log (bug-start-install-ordering): every decision is
  // recorded, never silent — the link outcome, each workspace build decision
  // and the probe verdict. A skip states WHY in its outcome token.
  const steps: WorktreePrepStep[] = [];
  let stepsTruncated = false;
  const record = (step: WorktreePrepStep["step"], outcome: string, pkg?: string): void => {
    if (steps.length >= MAX_PREP_STEPS) {
      stepsTruncated = true;
      return;
    }
    steps.push(pkg === undefined ? { step, outcome } : { step, outcome, pkg });
  };
  const link = linkNodeModulesDetailed(primaryRoot, worktreePath);
  record("link", link.outcome);
  const builtWorkspaces = buildLocalWorkspaces(primaryRoot, worktreePath, {
    runBuild: deps.runBuild,
    onStep: (outcome, pkg) => record("build", outcome, pkg),
  });
  const linkedWorkspaces = linkedWorkspacePackages(primaryRoot, worktreePath);
  const hasInstall = existsSync(worktreeModules);
  const primaryHasInstall = existsSync(join(primaryRoot, "node_modules"));
  // A symlink can be created successfully even when its target is already
  // gone (or becomes unreadable during the handoff). Do not call that a ready
  // linked install: the receipt must distinguish a usable link from a link
  // whose dependency tree cannot actually be resolved.
  const install: WorktreeInstallState = link.linked
    ? hasInstall
      ? "linked"
      : "unavailable"
    : hasInstall
      ? "existing"
      : primaryHasInstall
        ? "unavailable"
        : "missing";
  // Staleness of the install the worktree will actually resolve through
  // (bug-worktree-readiness-misses-stale-primary-install): a link farm can only
  // mirror what the primary has, so a declared-but-uninstalled dependency is
  // reported by name instead of being read as a ready worktree.
  const declared = inspectDeclaredDependencies(worktreePath);
  // Which node_modules the gate binaries resolve from
  // (bug-start-worktree-npm-ci-claim): a sibling checkout's `.bin` on the
  // invoking PATH can run the claim commit's gate against a foreign install
  // while the worktree itself resolves nothing — readiness names it and
  // withholds `ready` instead of letting the resolution stay invisible.
  const gateBins = inspectGateBinResolution(worktreePath, primaryRoot);
  const foreignBins = gateBins.filter((bin) => bin.source !== "worktree");
  record("gate-bins", foreignBins.length === 0 ? "all-worktree" : "foreign-resolution");
  return {
    ready:
      hasInstall &&
      linkedWorkspaces.length === 0 &&
      declared.coverage === "satisfied" &&
      gateBins.every((bin) => bin.source === "worktree"),
    install,
    linkedNodeModules: link.linked,
    builtWorkspaces,
    linkedWorkspaces,
    manifestCoverage: declared.coverage,
    missingDependencies: declared.missing,
    missingDependenciesTotal: declared.missingTotal,
    gateBins,
    steps,
    ...(stepsTruncated ? { stepsTruncated: true as const } : {}),
    ...(envReceipt !== undefined ? { env: envReceipt } : {}),
    ...(claimReceipt !== undefined ? { claim: claimReceipt } : {}),
  };
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
