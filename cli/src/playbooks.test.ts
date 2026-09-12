import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCreate } from "./create.js";
import { itemsById, loadItems } from "./items.js";
import {
  PLAYBOOK_MAX_AGE_DAYS_DEFAULT,
  runPlaybookNew,
  runPlaybookRefresh,
  runPlaybookStatus,
  runStackExplore,
} from "./playbooks.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = resolve(repoRoot, "cli/src/cli.ts");
const tsx = resolve(repoRoot, "node_modules/tsx/dist/cli.mjs");

/** Fixed clock for staleness math: 2026-09-12 UTC. */
const NOW = new Date("2026-09-12T12:00:00Z");
const TODAY = "2026-09-12";

/** Temp repo skeleton: only what findTasksDir needs (tasks/.convention.yml). */
function makeRepo(convention = "version: 0\n"): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-playbooks-"));
  mkdirSync(join(dir, "tasks"), { recursive: true });
  writeFileSync(join(dir, "tasks", ".convention.yml"), convention, "utf8");
  return dir;
}

function writePlaybook(dir: string, tech: string, fm: Record<string, string>): string {
  const dirPath = join(dir, "docs", "playbooks");
  mkdirSync(dirPath, { recursive: true });
  const path = join(dirPath, `${tech}.md`);
  const lines = Object.entries(fm)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  writeFileSync(path, `---\n${lines}\n---\n\n# ${tech} playbook\n\nbody\n`, "utf8");
  return path;
}

/** initiative -> epic -> story chain for --file-task parent resolution. */
function makeStory(dir: string): string {
  runCreate({ cwd: dir, type: "initiative", title: "Demo", id: "demo" });
  runCreate({ cwd: dir, type: "epic", title: "Demo epic", id: "demo-e", parent: "demo" });
  runCreate({
    cwd: dir,
    type: "story",
    title: "Demo story",
    id: "demo-s",
    parent: "demo-e",
  });
  return "demo-s";
}

function runCli(args: string[], cwd: string) {
  return spawnSync(process.execPath, [tsx, cli, ...args], { encoding: "utf8", cwd });
}

describe("stack explore", () => {
  it("scaffolds the next numbered exploration with all sections", () => {
    const dir = makeRepo();
    const result = runStackExplore({ cwd: dir, topic: "Vector Database", now: NOW });
    expect(result.files).toEqual(["docs/explorations/exploration-vector-database-001.md"]);
    const content = readFileSync(join(dir, result.files[0]!), "utf8");
    expect(content).toContain("# Exploration: Vector Database (vector-database-001)");
    expect(content).toContain("exploration_id: vector-database-001");
    expect(content).toContain(`created: ${TODAY}`);
    for (const section of ["## Candidates", "## Criteria", "## Findings", "## Recommendation", "## Decision"]) {
      expect(content).toContain(section);
    }
    expect(content).toMatch(/source: <url>/); // dated-sources guidance
    expect(content).toContain("docs/adr/"); // ADR placeholder
  });

  it("numbers up across slugs and never overwrites an existing file", () => {
    const dir = makeRepo();
    mkdirSync(join(dir, "docs", "explorations"), { recursive: true });
    writeFileSync(join(dir, "docs", "explorations", "exploration-seed-004.md"), "SEED", "utf8");
    const first = runStackExplore({ cwd: dir, topic: "cache-layer", now: NOW });
    expect(first.files).toEqual(["docs/explorations/exploration-cache-layer-005.md"]);
    expect(readFileSync(join(dir, "docs", "explorations", "exploration-seed-004.md"), "utf8")).toBe(
      "SEED",
    );
    // Same topic again: numbered up, first record byte-identical.
    const before = readFileSync(join(dir, first.files[0]!), "utf8");
    const second = runStackExplore({ cwd: dir, topic: "cache-layer", title: "Cache layer", now: NOW });
    expect(second.files).toEqual(["docs/explorations/exploration-cache-layer-006.md"]);
    expect(readFileSync(join(dir, first.files[0]!), "utf8")).toBe(before);
  });

  it("honors --title and rejects topics that cannot slugify", () => {
    const dir = makeRepo();
    const result = runStackExplore({ cwd: dir, topic: "queue tech", title: "Queues!", now: NOW });
    const content = readFileSync(join(dir, result.files[0]!), "utf8");
    expect(content).toContain("# Exploration: Queues! (queue-tech-001)");
    expect(() => runStackExplore({ cwd: dir, topic: "!!!" })).toThrow(/Cannot derive id/);
  });

  it("fails on a non-repo with an actionable error", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-explore-bare-"));
    expect(() => runStackExplore({ cwd: dir, topic: "anything" })).toThrow(
      /No tasks\/ convention found\. Run `arggon init` first\./,
    );
  });
});

describe("playbook new", () => {
  it("scaffolds frontmatter and fill-me sections for the caller to research", () => {
    const dir = makeRepo();
    const result = runPlaybookNew({
      cwd: dir,
      tech: "vector-db",
      version: "1.5.0",
      now: NOW,
    });
    expect(result.files).toEqual(["docs/playbooks/vector-db.md"]);
    const content = readFileSync(join(dir, result.files[0]!), "utf8");
    expect(content).toContain("playbook_id: vector-db");
    expect(content).toContain("version: 1.5.0");
    expect(content).toContain(`researched: ${TODAY}`);
    expect(content).toContain("status: current");
    expect(content).toContain("# vector db playbook (vector-db)");
    for (const section of ["## Setup", "## Conventions", "## Testing", "## Security", "## Upgrade policy"]) {
      expect(content).toContain(section);
    }
    expect(content).toMatch(/dated sources/);
    expect(content.match(/<!-- fill me/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it("defaults the version to unpinned and the title to the humanized slug", () => {
    const dir = makeRepo();
    runPlaybookNew({ cwd: dir, tech: "bun", now: NOW });
    const content = readFileSync(join(dir, "docs", "playbooks", "bun.md"), "utf8");
    expect(content).toContain("version: unpinned");
    expect(content).toContain("# bun playbook (bun)");
  });

  it("refuses to overwrite an existing playbook (one per tech)", () => {
    const dir = makeRepo();
    runPlaybookNew({ cwd: dir, tech: "postgres", now: NOW });
    const before = readFileSync(join(dir, "docs", "playbooks", "postgres.md"), "utf8");
    expect(() => runPlaybookNew({ cwd: dir, tech: "postgres", version: "17", now: NOW })).toThrow(
      /refusing to overwrite existing playbook docs\/playbooks\/postgres\.md.*playbook refresh/,
    );
    expect(readFileSync(join(dir, "docs", "playbooks", "postgres.md"), "utf8")).toBe(before);
  });

  it("rejects a non-kebab-case tech slug", () => {
    const dir = makeRepo();
    expect(() => runPlaybookNew({ cwd: dir, tech: "Bad Slug" })).toThrow(/kebab-case/);
    expect(existsSync(join(dir, "docs", "playbooks"))).toBe(false);
  });
});

describe("playbook status", () => {
  it("applies the 90-day default with the > threshold rule on a fixed clock", () => {
    const dir = makeRepo();
    writePlaybook(dir, "fresh", { playbook_id: "fresh", version: "1", researched: TODAY });
    writePlaybook(dir, "boundary", { playbook_id: "boundary", version: "2", researched: "2026-06-14" });
    writePlaybook(dir, "stale", { playbook_id: "stale", version: "3", researched: "2026-06-01" });
    const result = runPlaybookStatus({ cwd: dir, now: NOW });
    expect(result.maxAgeDays).toBe(PLAYBOOK_MAX_AGE_DAYS_DEFAULT);
    expect(result.playbooks.map((p) => [p.id, p.ageDays, p.stale])).toEqual([
      ["boundary", 90, false],
      ["fresh", 0, false],
      ["stale", 103, true],
    ]);
    expect(result.staleCount).toBe(1);
  });

  it("--max-age-days wins over the config and the default", () => {
    const dir = makeRepo();
    writePlaybook(dir, "mid", { playbook_id: "mid", version: "1", researched: "2026-06-14" });
    writeFileSync(join(dir, "tasks", ".convention.yml"), "version: 3\n", "utf8");
    expect(runPlaybookStatus({ cwd: dir, maxAgeDays: 100, now: NOW }).staleCount).toBe(0);
    expect(runPlaybookStatus({ cwd: dir, maxAgeDays: 50, now: NOW }).staleCount).toBe(1);
  });

  it("reads the threshold from x-playbooks.max-age-days (flag still wins)", () => {
    const dir = makeRepo("version: 3\nx-playbooks:\n  max-age-days: 30\n  future-option: 7\n");
    writePlaybook(dir, "old", { playbook_id: "old", version: "1", researched: "2026-08-13" }); // 30d
    writePlaybook(dir, "older", { playbook_id: "older", version: "1", researched: "2026-07-29" }); // 45d
    const configRun = runPlaybookStatus({ cwd: dir, now: NOW });
    expect(configRun.maxAgeDays).toBe(30);
    expect(configRun.playbooks.map((p) => [p.id, p.stale])).toEqual([
      ["old", false],
      ["older", true],
    ]);
    const flagRun = runPlaybookStatus({ cwd: dir, maxAgeDays: 100, now: NOW });
    expect(flagRun.maxAgeDays).toBe(100);
    expect(flagRun.staleCount).toBe(0);
  });

  it("reports an empty set cleanly and treats unknown research dates as stale", () => {
    const empty = makeRepo();
    const nothing = runPlaybookStatus({ cwd: empty, now: NOW });
    expect(nothing.playbooks).toEqual([]);
    expect(nothing.staleCount).toBe(0);

    const dir = makeRepo();
    writePlaybook(dir, "handmade", { playbook_id: "handmade" });
    const result = runPlaybookStatus({ cwd: dir, now: NOW });
    expect(result.playbooks).toEqual([
      { id: "handmade", version: "unknown", researched: null, ageDays: null, stale: true, path: "docs/playbooks/handmade.md" },
    ]);
    expect(result.staleCount).toBe(1);
  });

  it("--file-task files one re-research task per stale playbook through the kernel", () => {
    const dir = makeRepo();
    const story = makeStory(dir);
    writePlaybook(dir, "stale-tech", { playbook_id: "stale-tech", version: "2.1", researched: "2026-06-01" });
    writePlaybook(dir, "fresh-tech", { playbook_id: "fresh-tech", version: "9", researched: TODAY });

    const result = runPlaybookStatus({ cwd: dir, fileTask: story, now: NOW });
    expect(result.created).toEqual(["task-re-research-stale-tech"]);
    expect(result.skipped).toEqual([]);

    const byId = itemsById(loadItems(join(dir, "tasks")));
    const filed = byId.get("task-re-research-stale-tech");
    expect(filed).toBeDefined();
    expect(filed?.status).toBe("todo");
    expect(filed?.parent).toBe(story);
    expect(filed?.title).toBe("Re-research stale-tech playbook (v2.1, 103 days old)");
    expect(filed?.body).toContain("docs/playbooks/stale-tech.md");
    expect(filed?.body).toContain("arggon playbook refresh stale-tech --version <v>");
    expect(byId.has("task-re-research-fresh-tech")).toBe(false);
  });

  it("--file-task is idempotent: an existing re-research task is skipped", () => {
    const dir = makeRepo();
    const story = makeStory(dir);
    writePlaybook(dir, "stale-tech", { playbook_id: "stale-tech", version: "2.1", researched: "2026-06-01" });
    const first = runPlaybookStatus({ cwd: dir, fileTask: story, now: NOW });
    expect(first.created).toEqual(["task-re-research-stale-tech"]);

    const before = readFileSync(
      join(dir, "tasks", "demo", "demo-e", "demo-s", "task-re-research-stale-tech.md"),
      "utf8",
    );
    const second = runPlaybookStatus({ cwd: dir, fileTask: story, now: NOW });
    expect(second.created).toEqual([]);
    expect(second.skipped).toEqual(["task-re-research-stale-tech"]);
    expect(
      readFileSync(
        join(dir, "tasks", "demo", "demo-e", "demo-s", "task-re-research-stale-tech.md"),
        "utf8",
      ),
    ).toBe(before);
  });

  it("--file-task errors when the story does not exist", () => {
    const dir = makeRepo();
    writePlaybook(dir, "stale-tech", { playbook_id: "stale-tech", version: "2.1", researched: "2026-06-01" });
    expect(() => runPlaybookStatus({ cwd: dir, fileTask: "story-nope", now: NOW })).toThrow(
      /parent 'story-nope' not found under tasks\//,
    );
  });
});

describe("playbook refresh", () => {
  it("rewrites only the freshness frontmatter and leaves the body untouched", () => {
    const dir = makeRepo();
    runPlaybookNew({ cwd: dir, tech: "postgres", version: "16.3", now: NOW });
    const path = join(dir, "docs", "playbooks", "postgres.md");
    const handAdded = readFileSync(path, "utf8").replace(
      "status: current",
      "status: current\nowner: alice", // an unknown key that must survive the rewrite
    );
    writeFileSync(path, handAdded, "utf8");
    const bodyBefore = handAdded.slice(handAdded.indexOf("\n---", 3) + 4);

    const later = new Date("2026-12-01T00:00:00Z");
    const result = runPlaybookRefresh({ cwd: dir, tech: "postgres", version: "17.0", now: later });
    expect(result).toEqual({
      root: dir,
      path: "docs/playbooks/postgres.md",
      version: "17.0",
      researched: "2026-12-01",
    });

    const after = readFileSync(path, "utf8");
    expect(after).toContain("version: 17.0");
    expect(after).toContain("researched: 2026-12-01");
    expect(after).toContain("status: current");
    expect(after).toContain("owner: alice");
    expect(after).toContain("playbook_id: postgres");
    expect(after.slice(after.indexOf("\n---", 3) + 4)).toBe(bodyBefore);
    expect(after).toContain("version 16.3"); // body text is intentionally untouched
  });

  it("requires a version and an existing playbook", () => {
    const dir = makeRepo();
    expect(() => runPlaybookRefresh({ cwd: dir, tech: "postgres", version: "  ", now: NOW })).toThrow(
      /requires --version <v>/,
    );
    expect(() => runPlaybookRefresh({ cwd: dir, tech: "postgres", version: "17", now: NOW })).toThrow(
      /no playbook for 'postgres'.*playbook new postgres/,
    );
    expect(() => runPlaybookRefresh({ cwd: dir, tech: "Bad Slug", version: "17", now: NOW })).toThrow(
      /kebab-case/,
    );
  });
});

describe("playbook CLI --json parity", () => {
  it("stack explore emits the explore envelope", () => {
    const dir = makeRepo();
    const proc = runCli(["stack", "explore", "cache layer", "--json"], dir);
    expect(proc.status).toBe(0);
    const body = JSON.parse(proc.stdout) as { ok: boolean; command: string; files: string[] };
    expect(body.ok).toBe(true);
    expect(body.command).toBe("explore");
    expect(body.files).toEqual(["docs/explorations/exploration-cache-layer-001.md"]);
  });

  it("playbook new/status/refresh emit playbook envelopes", () => {
    const dir = makeRepo();
    const created = runCli(["playbook", "new", "redis", "--version", "7.2", "--json"], dir);
    expect(created.status).toBe(0);
    const createdBody = JSON.parse(created.stdout) as { ok: boolean; command: string; files: string[] };
    expect(createdBody).toMatchObject({ ok: true, command: "playbook", files: ["docs/playbooks/redis.md"] });

    const status = runCli(["playbook", "status", "--json"], dir);
    expect(status.status).toBe(0);
    const statusBody = JSON.parse(status.stdout) as {
      ok: boolean;
      command: string;
      playbooks: Array<{ id: string; version: string; ageDays: number; stale: boolean }>;
      staleCount: number;
      maxAgeDays: number;
    };
    expect(statusBody.ok).toBe(true);
    expect(statusBody.command).toBe("playbook");
    expect(statusBody.playbooks).toEqual([
      { id: "redis", version: "7.2", researched: TODAY, ageDays: 0, stale: false, path: "docs/playbooks/redis.md" },
    ]);
    expect(statusBody.staleCount).toBe(0);
    expect(statusBody.maxAgeDays).toBe(90);

    const refreshed = runCli(["playbook", "refresh", "redis", "--version", "8.0", "--json"], dir);
    expect(refreshed.status).toBe(0);
    const refreshedBody = JSON.parse(refreshed.stdout) as {
      ok: boolean;
      command: string;
      path: string;
      version: string;
    };
    expect(refreshedBody).toMatchObject({
      ok: true,
      command: "playbook",
      path: "docs/playbooks/redis.md",
      version: "8.0",
    });
  });

  it("human output renders the freshness table and filed-task lines", () => {
    const dir = makeRepo();
    const story = makeStory(dir);
    writePlaybook(dir, "stale-tech", { playbook_id: "stale-tech", version: "2.1", researched: "2026-06-01" });
    const table = runCli(["playbook", "status"], dir);
    expect(table.status).toBe(0);
    expect(table.stdout).toContain("tech        version  researched  age-days  status");
    expect(table.stdout).toContain("stale-tech  2.1      2026-06-01  103       STALE");
    expect(table.stdout).toContain("--file-task <story-id>");

    const filed = runCli(["playbook", "status", "--file-task", story], dir);
    expect(filed.status).toBe(0);
    expect(filed.stdout).toContain("filed:   task-re-research-stale-tech");
    const again = runCli(["playbook", "status", "--file-task", story], dir);
    expect(again.stdout).toContain("skipped: task-re-research-stale-tech (re-research task already exists)");
  });

  it("failures carry PLAYBOOK_FAILED / EXPLORE_FAILED codes and exit non-zero", () => {
    const dir = makeRepo();
    const badSlug = runCli(["playbook", "new", "Bad Slug", "--json"], dir);
    expect(badSlug.status).not.toBe(0);
    const badSlugBody = JSON.parse(badSlug.stdout) as {
      ok: boolean;
      error?: { code?: string };
    };
    expect(badSlugBody.ok).toBe(false);
    expect(badSlugBody.error?.code).toBe("PLAYBOOK_FAILED");

    const bare = mkdtempSync(join(tmpdir(), "arggon-playbooks-bare-"));
    const explore = runCli(["stack", "explore", "anything", "--json"], bare);
    expect(explore.status).not.toBe(0);
    const exploreBody = JSON.parse(explore.stdout) as {
      ok: boolean;
      error?: { message?: string; code?: string };
    };
    expect(exploreBody.ok).toBe(false);
    expect(exploreBody.error?.code).toBe("EXPLORE_FAILED");
    expect(exploreBody.error?.message).toMatch(/arggon init/);
  });
});
