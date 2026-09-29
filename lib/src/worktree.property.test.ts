/**
 * Property: worktree cleanup / ownership classification is safe and idempotent
 * for generated link and link-farm shapes, including foreign installs that must
 * never be removed.
 *
 * Two kernel seams, both pure over injected facts, so the properties need no
 * git process and no real repository:
 *
 *   - `unlinkNodeModulesLink` (worktree.ts) — the OWNERSHIP decision: only a
 *     symlink that resolves to THIS primary's `node_modules`, or a start-created
 *     link farm (real directory + marker naming this primary's install), may be
 *     removed. Anything else — an npm-reified install, a link or directory
 *     pointing anywhere else, a dangling link — is left alone.
 *   - `classifyCleanupEntry` (cleanup.ts) — the PRUNABILITY decision shared by
 *     `arggon cleanup` and the native `cleanup` tool: terminal status → recorded
 *     branch → integration (ancestry or a squash-merged PR) → remote-tip safety →
 *     filesystem state, with a reason for every skip.
 *
 * INVARIANTS — ownership:
 *   1. `unlinkNodeModulesLink` returns true exactly for the shapes this primary
 *      owns, and removes only those.
 *   2. It is IDEMPOTENT: the second call always returns false.
 *   3. The primary's own install is never touched — the farm holds symlinks
 *      INTO it, so a recursive remove must unlink, never follow.
 *   4. A FOREIGN install (link, farm or reified directory this primary does not
 *      own) is byte-for-byte unchanged after any number of calls.
 *
 * INVARIANTS — classification:
 *   5. SOUNDNESS: `removable` implies every safety predicate (terminal status,
 *      recorded branch, proven integration, safe remote tip, and a recorded path
 *      that is either absent or a worktree of THIS repo).
 *   6. A path that exists but is not a worktree of this repo is never removable,
 *      carries the manual-removal reason, and is still on disk afterwards.
 *   7. Every skip carries a reason and no action; every removable entry carries
 *      one of the documented actions.
 *   8. IDEMPOTENCE / PURITY: classifying the same item twice yields the same
 *      entry, and the classifier never mutates the item it is given.
 */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { classifyCleanupEntry, CLEANUP_TERMINAL_STATUSES, type CleanupGit } from "./cleanup.js";
import type { WorkItem } from "./items.js";
import { unlinkNodeModulesLink } from "./worktree.js";
import { STATUSES, type Status } from "./status.js";
import { fc, checkProperty } from "../../test/property-runner.js";

const LINK_FARM_MARKER = ".arggon-link-farm";

const tmpDirs: string[] = [];
let runCounter = 0;

afterAll(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tmpDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

/**
 * A comparable snapshot of one path: symlink targets are recorded, never
 * followed, so "the primary install survived" cannot be faked by a link.
 */
function snapshot(path: string): string {
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    return "absent";
  }
  if (stat.isSymbolicLink()) return `link:${readlinkSync(path)}`;
  if (stat.isDirectory()) {
    const entries = readdirSync(path).sort();
    return `dir:[${entries.map((name) => `${name}=${snapshot(join(path, name))}`).join(",")}]`;
  }
  return `file:${readFileSync(path, "utf8")}`;
}

/** The install shapes `unlinkNodeModulesLink` can meet. */
type Shape =
  | "absent"
  | "link-primary-abs"
  | "link-primary-rel"
  | "link-primary-dotted-rel"
  | "link-primary-trailing-slash"
  | "link-foreign"
  | "link-foreign-rel"
  | "link-dangling"
  | "farm-owned"
  | "farm-owned-extra-file"
  | "farm-foreign-marker"
  | "farm-empty-marker"
  | "farm-no-marker"
  | "regular-file"
  | "reified";

/** Shapes this primary created and may therefore remove. */
const OWNED: ReadonlySet<Shape> = new Set<Shape>([
  "link-primary-abs",
  "link-primary-rel",
  "link-primary-dotted-rel",
  "link-primary-trailing-slash",
  "farm-owned",
  "farm-owned-extra-file",
]);

const shapeArb = fc.constantFrom<Shape>(
  "absent",
  "link-primary-abs",
  "link-primary-rel",
  "link-primary-dotted-rel",
  "link-primary-trailing-slash",
  "link-foreign",
  "link-foreign-rel",
  "link-dangling",
  "farm-owned",
  "farm-owned-extra-file",
  "farm-foreign-marker",
  "farm-empty-marker",
  "farm-no-marker",
  "regular-file",
  "reified",
);

type Fixture = { primary: string; worktree: string; link: string; foreign: string; base: string };

function buildShape(shape: Shape, index: number): Fixture {
  const base = join(tmpDir("arggon-prop-install-"), `run-${index}`);
  const primary = join(base, "primary");
  const worktree = join(base, "worktree");
  const foreign = join(base, "foreign-install");
  const link = join(worktree, "node_modules");
  mkdirSync(join(primary, "node_modules", "left-pad"), { recursive: true });
  writeFileSync(join(primary, "node_modules", "left-pad", "index.js"), "// primary\n", "utf8");
  writeFileSync(join(primary, "node_modules", "canary.txt"), "primary install\n", "utf8");
  mkdirSync(join(worktree, ".git"), { recursive: true });
  writeFileSync(join(worktree, ".git", "HEAD"), "ref: refs/heads/feat/x\n", "utf8");
  mkdirSync(foreign, { recursive: true });
  writeFileSync(join(foreign, "canary.txt"), "foreign install\n", "utf8");

  const dirLink = (target: string): void => symlinkSync(target, link, "dir");
  switch (shape) {
    case "absent":
      break;
    case "link-primary-abs":
      dirLink(join(primary, "node_modules"));
      break;
    case "link-primary-rel":
      dirLink(join("..", "primary", "node_modules"));
      break;
    case "link-primary-dotted-rel":
      dirLink(join("..", "primary", "node_modules", "..", "node_modules"));
      break;
    case "link-primary-trailing-slash":
      dirLink(`${join(primary, "node_modules")}/`);
      break;
    case "link-foreign":
      dirLink(foreign);
      break;
    case "link-foreign-rel":
      dirLink(join("..", "foreign-install"));
      break;
    case "link-dangling":
      dirLink(join(base, "never-created"));
      break;
    case "farm-owned":
    case "farm-owned-extra-file":
    case "farm-foreign-marker":
    case "farm-empty-marker":
    case "farm-no-marker": {
      mkdirSync(link, { recursive: true });
      symlinkSync(join(primary, "node_modules", "left-pad"), join(link, "left-pad"), "dir");
      if (shape === "farm-owned") {
        writeFileSync(join(link, LINK_FARM_MARKER), `${join(primary, "node_modules")}\n`, "utf8");
      }
      if (shape === "farm-foreign-marker") {
        writeFileSync(join(link, LINK_FARM_MARKER), `${foreign}\n`, "utf8");
      }
      if (shape === "farm-empty-marker") {
        writeFileSync(join(link, LINK_FARM_MARKER), "\n", "utf8");
      }
      if (shape === "farm-owned-extra-file") {
        writeFileSync(join(link, LINK_FARM_MARKER), `${join(primary, "node_modules")}\n`, "utf8");
        writeFileSync(join(link, "unmanaged.txt"), "created by the user\n", "utf8");
      }
      break;
    }
    case "regular-file":
      writeFileSync(link, "not a directory\n", "utf8");
      break;
    case "reified":
      mkdirSync(join(link, "typescript"), { recursive: true });
      writeFileSync(join(link, "typescript", "package.json"), '{"name":"typescript"}\n', "utf8");
      break;
  }
  return { primary, worktree, link, foreign, base };
}

describe("worktree install ownership (property)", () => {
  it("removes only its own install, idempotently", () => {
    checkProperty(
      "worktree install ownership",
      fc.property(shapeArb, (shape) => {
        const fixture = buildShape(shape, runCounter++);
        const primaryBefore = snapshot(join(fixture.primary, "node_modules"));
        const foreignBefore = snapshot(fixture.foreign);
        const shapeBefore = snapshot(fixture.link);

        const first = unlinkNodeModulesLink(fixture.primary, fixture.worktree);
        const afterFirst = snapshot(fixture.link);
        const second = unlinkNodeModulesLink(fixture.primary, fixture.worktree);
        const afterSecond = snapshot(fixture.link);

        // (1) Ownership: exactly the shapes this primary created are removed.
        expect(first).toBe(OWNED.has(shape));
        if (OWNED.has(shape)) {
          expect(afterFirst).toBe("absent");
        } else {
          // (4) A foreign install is byte-for-byte unchanged.
          expect(afterFirst).toBe(shapeBefore);
        }
        // (2) Idempotence: nothing is left to remove on the second call.
        expect(second).toBe(false);
        expect(afterSecond).toBe(afterFirst);
        // (3) The primary's own install and the foreign install survive intact
        // (a farm's entries are symlinks INTO the primary: never followed).
        expect(snapshot(join(fixture.primary, "node_modules"))).toBe(primaryBefore);
        expect(snapshot(fixture.foreign)).toBe(foreignBefore);
        // The worktree itself is never touched beyond the install.
        expect(existsSync(join(fixture.worktree, ".git", "HEAD"))).toBe(true);
      }),
    );
  });
});

// --- cleanup classification -------------------------------------------------

type GitFacts = {
  status: Status;
  hasBranch: boolean;
  ancestor: boolean;
  remoteExists: boolean;
  remoteMerged: boolean;
  mergedPr: number | null;
  pathExists: boolean;
  registered: boolean;
};

const factsArb = fc.record({
  status: fc.constantFrom(...STATUSES),
  hasBranch: fc.boolean(),
  ancestor: fc.boolean(),
  remoteExists: fc.boolean(),
  remoteMerged: fc.boolean(),
  mergedPr: fc.option(fc.integer({ min: 1, max: 9999 }), { nil: null }),
  pathExists: fc.boolean(),
  registered: fc.boolean(),
});

function itemFor(facts: GitFacts, worktreePath: string | null): WorkItem {
  return {
    type: "task",
    status: facts.status,
    id: "task-cleanup",
    branch: facts.hasBranch ? "feat/task-cleanup" : undefined,
    worktreePath,
    labels: [],
    dependsOn: [],
    extras: {},
    filePath: "/tracker/task-cleanup.md",
    containerDir: "/tracker",
    data: {},
    body: "",
  };
}

describe("worktree cleanup classification (property)", () => {
  it("prunes only when every safety predicate holds, and never touches a foreign path", () => {
    checkProperty(
      "worktree cleanup classification",
      fc.property(factsArb, (facts) => {
        const base = tmpDir("arggon-prop-cleanup-");
        const root = join(base, "repo");
        const worktree = join(base, "wt");
        mkdirSync(root, { recursive: true });
        if (facts.pathExists) mkdirSync(worktree, { recursive: true });
        const before = facts.pathExists ? snapshot(worktree) : "absent";

        const gitRunner: CleanupGit = {
          isRepo: () => true,
          worktreeList: () => (facts.registered ? [worktree] : []),
          defaultBranch: () => "main",
          isAncestor: (_cwd, branch) =>
            branch.startsWith("origin/") ? facts.remoteMerged : facts.ancestor,
          remoteBranchExists: () => facts.remoteExists,
          removeWorktree: () => {
            throw new Error("the classifier must never remove anything itself");
          },
          deleteBranch: () => {
            throw new Error("the classifier must never delete branches itself");
          },
          deleteBranchForce: () => {
            throw new Error("the classifier must never delete branches itself");
          },
          branchExists: () => true,
        };
        const gh = (): string =>
          JSON.stringify(
            facts.mergedPr === null
              ? []
              : [{ number: facts.mergedPr, url: "https://x/1", mergedAt: null }],
          );

        const item = itemFor(facts, facts.pathExists || facts.registered ? worktree : null);
        const itemBefore = JSON.stringify(item);
        const entry = classifyCleanupEntry(item, root, "main", gitRunner, { gh });
        const again = classifyCleanupEntry(item, root, "main", gitRunner, { gh });

        const terminal = CLEANUP_TERMINAL_STATUSES.has(facts.status);
        const integrationProven = facts.ancestor || facts.mergedPr !== null;
        // The remote gate is skipped ONLY on the squash-merge path, i.e. when
        // the ancestry check failed and a merged PR proved integration instead
        // (such a PR already proves the remote tip was integrated).
        const squashPath = !facts.ancestor && facts.mergedPr !== null;
        const remoteSafe = squashPath || !facts.remoteExists || facts.remoteMerged;
        const pathSafe = !facts.pathExists || facts.registered;

        if (entry.removable) {
          // (5) Soundness: every safety predicate held.
          expect(terminal).toBe(true);
          expect(facts.hasBranch).toBe(true);
          expect(integrationProven).toBe(true);
          expect(remoteSafe).toBe(true);
          expect(pathSafe).toBe(true);
          // (7) A removable entry names the action and carries no reason.
          expect(entry.reason).toBeNull();
          expect(entry.action).not.toBeNull();
          expect(entry.via === `squash-merged PR #${facts.mergedPr}`).toBe(squashPath);
        } else {
          // (7) Every skip carries a reason and no action.
          expect(entry.reason).not.toBeNull();
          expect(entry.action).toBeNull();
        }
        // (5) The converse direction: all predicates holding means removable.
        if (terminal && facts.hasBranch && integrationProven && remoteSafe && pathSafe) {
          expect(entry.removable).toBe(true);
        }
        // (6) When the earlier gates let the entry reach the filesystem check,
        // a path that exists but is not a worktree of this repo is never
        // removable and says so. The classifier removes nothing itself in any
        // case: the path is still on disk afterwards and the git doubles above
        // throw if a removal were ever attempted.
        if (facts.pathExists && !facts.registered && terminal && facts.hasBranch && integrationProven && remoteSafe) {
          expect(entry.removable).toBe(false);
          expect(entry.reason).toContain("not a git worktree of this repo");
        }
        expect(snapshot(worktree)).toBe(before);
        // (8) Idempotence and purity.
        expect(again).toEqual(entry);
        expect(JSON.stringify(item)).toBe(itemBefore);
      }),
    );
  });
});
