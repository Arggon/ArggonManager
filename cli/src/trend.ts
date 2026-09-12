/**
 * Git-history trend mining (story-report-trend): every status transition of a
 * work item is a frontmatter diff in some commit under `tasks/`, so a single
 * `git log -p` pass over the tree is a free analytics database.
 *
 * Pure read — `git log` only, never writes, never touches the tree.
 * The git executor is injectable so tests can run against real temp repos or
 * canned output (same pattern as get-open-prs).
 */
import { execFileSync, ExecFileSyncOptions } from "node:child_process";
import { relative, sep } from "node:path";
import { loadItems } from "./items.js";
import { findTasksDir, repoRootFromTasks } from "./paths.js";

/** Signature for git executors used in trend mining (injectable for tests). */
export type GitExecutor = (file: string, args: string[], options?: ExecFileSyncOptions) => string;

const defaultExecGit: GitExecutor = (file, args, options) =>
  execFileSync(file, args, options) as string;

/** One weekly completions bucket: ISO week key like "2026-W37". */
export type TrendWeek = { week: string; completions: number };

/** Average cycle time (claim → terminal) for one leaf type, in days. */
export type TrendCycleTime = { type: "task" | "bug"; avgDays: number; count: number };

export type TrendResult = {
  /** ISO weeks with at least one leaf completion, ascending. */
  weeks: TrendWeek[];
  /** One entry per leaf type with at least one measurable item, alphabetical. */
  cycleTime: TrendCycleTime[];
};

/** One `+status:` occurrence seen in a commit diff. */
type StatusEvent = {
  /** Commit sequence (0 = oldest) for ordering across renames. */
  seq: number;
  /** Committer date (%cI) of the commit carrying the transition. */
  date: string;
  /** Repo-relative posix path of the file the diff belongs to. */
  path: string;
  /** New frontmatter status value (unquoted). */
  status: string;
};

export type RunTrendOptions = {
  cwd: string;
  /** Window start "YYYY-MM-DD" (UTC): transitions before it are not considered. */
  since?: string;
  execGit?: GitExecutor;
};

/**
 * Mine `git log -p` over `tasks/` for status transitions and aggregate:
 * weekly leaf completions (ISO week of the first terminal transition) and
 * average cycle time per leaf type (first claim → terminal, in days).
 * Leaves are task/bug items; open items count as not-completed.
 */
export function runTrend(opts: RunTrendOptions): TrendResult {
  const sinceMs = parseSince(opts.since);
  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);
  const relTasks = "tasks";

  const execGit = opts.execGit ?? defaultExecGit;
  let out: string;
  try {
    out = execGit(
      "git",
      [
        "log",
        "-p",
        "--no-color",
        "--no-ext-diff",
        "--format=%x1e%H%x1f%cI",
        "--",
        relTasks,
      ],
      { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
  } catch (err) {
    const stderr = err instanceof Error && "stderr" in err ? String(err.stderr) : "";
    // A repo where tasks/ was never committed has no history to mine — not a failure.
    if (stderr.includes("does not have any commits yet")) {
      return { weeks: [], cycleTime: [] };
    }
    throw new Error(
      `git log over ${relTasks}/ failed (is ${root} a git repository?): ${stderr.trim() || err}`,
    );
  }

  const parsed = parseLog(out);
  // Current tree types by repo-relative posix path (git path space).
  const currentTypes = new Map<string, string>();
  for (const item of loadItems(tasksDir)) {
    currentTypes.set(relative(root, item.filePath).split(sep).join("/"), item.type);
  }

  // Canonicalize paths through renames so a renamed file keeps one history.
  const resolvePath = (path: string): string => {
    let cur = path;
    for (;;) {
      const next = parsed.renames.get(cur);
      if (!next) return cur;
      cur = next;
    }
  };

  const histories = new Map<string, StatusEvent[]>();
  const typeOf = new Map<string, string>();
  for (const event of parsed.events) {
    const key = resolvePath(event.path);
    const list = histories.get(key) ?? [];
    list.push(event);
    histories.set(key, list);
  }
  for (const [path, type] of parsed.types) {
    typeOf.set(resolvePath(path), type);
  }

  const weekCounts = new Map<string, number>();
  const cycleByType = new Map<"task" | "bug", number[]>();

  for (const [path, events] of histories) {
    // Chronological order: git log emits the newest commit first, so the
    // highest seq is the oldest commit. Ties within one commit keep diff order.
    events.sort((a, b) => b.seq - a.seq);
    const type = currentTypes.get(path) ?? typeOf.get(path);
    const inWindow = (iso: string): boolean => Date.parse(iso) >= sinceMs;

    let claimedMs: number | null = null;
    let terminalMs: number | null = null;
    for (const event of events) {
      if (!inWindow(event.date)) continue;
      if (claimedMs === null && event.status === "in_progress") {
        claimedMs = Date.parse(event.date);
      }
      if (terminalMs === null && (event.status === "done" || event.status === "cancelled")) {
        terminalMs = Date.parse(event.date);
      }
    }
    if (terminalMs === null) continue; // still open (or terminal before the window)

    const isLeaf = type === "task" || type === "bug";
    if (!isLeaf) continue;
    const leafType = type as "task" | "bug";

    const week = isoWeekKey(new Date(terminalMs));
    weekCounts.set(week, (weekCounts.get(week) ?? 0) + 1);

    if (claimedMs !== null) {
      const days = (terminalMs - claimedMs) / 86_400_000;
      const list = cycleByType.get(leafType) ?? [];
      list.push(days);
      cycleByType.set(leafType, list);
    }
  }

  const weeks = [...weekCounts.entries()]
    .map(([week, completions]) => ({ week, completions }))
    .sort((a, b) => (a.week < b.week ? -1 : a.week > b.week ? 1 : 0));

  const cycleTime = [...cycleByType.entries()]
    .map(([type, days]) => ({
      type,
      avgDays: Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10,
      count: days.length,
    }))
    .sort((a, b) => (a.type < b.type ? -1 : a.type > b.type ? 1 : 0));

  return { weeks, cycleTime };
}

/** Validate `--since` ("YYYY-MM-DD") and return its UTC start in epoch ms. */
export function parseSince(since: string | undefined): number {
  if (since === undefined) return -Infinity;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || Number.isNaN(Date.parse(`${since}T00:00:00Z`))) {
    throw new Error(`invalid --since '${since}' (expected YYYY-MM-DD)`);
  }
  return Date.parse(`${since}T00:00:00Z`);
}

/** Human-readable trend block, appended after the report table (table format). */
export function formatTrendTable(trend: TrendResult): string {
  const lines: string[] = ["trend (from git history):"];
  lines.push("  completions by ISO week:");
  if (trend.weeks.length === 0) lines.push("    (none)");
  for (const w of trend.weeks) lines.push(`    ${w.week}: ${w.completions}`);
  lines.push("  average cycle time (claim -> terminal, days):");
  if (trend.cycleTime.length === 0) lines.push("    (none)");
  for (const c of trend.cycleTime) {
    lines.push(`    ${c.type}: ${c.avgDays.toFixed(1)}d (${c.count} completed)`);
  }
  return `${lines.join("\n")}\n`;
}

/** Markdown trend section, appended to the standup report (--format markdown). */
export function formatTrendMarkdown(trend: TrendResult): string {
  const lines: string[] = ["## Trend", ""];
  lines.push("_Weekly completions (from git history):_", "");
  if (trend.weeks.length === 0) {
    lines.push("_None._", "");
  } else {
    for (const w of trend.weeks) lines.push(`- ${w.week}: ${w.completions}`);
    lines.push("");
  }
  lines.push("_Average cycle time (claim → terminal):_", "");
  if (trend.cycleTime.length === 0) {
    lines.push("_None._", "");
  } else {
    for (const c of trend.cycleTime) {
      lines.push(`- **${c.type}**: ${c.avgDays.toFixed(1)} days (${c.count} completed)`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

/** ISO-8601 week key (e.g. "2026-W37") for a date, in UTC. */
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // Mon=1 .. Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - day); // jump to the week's Thursday
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Strip surrounding quotes the way frontmatter string scalars are written. */
function unquote(raw: string): string {
  const value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    return value.slice(1, -1);
  }
  return value;
}

type ParsedLog = {
  /** Ordered status events (seq 0 = oldest commit). */
  events: StatusEvent[];
  /** rename-from → rename-to, as detected by git. */
  renames: Map<string, string>;
  /** Path → item type, captured from any `+type:` diff line. */
  types: Map<string, string>;
};

const RECORD_SEP = "\u001e"; // %x1e — starts each commit header line
const UNIT_SEP = "\u001f"; // %x1f — separates hash and committer date

/**
 * Split `git log -p --format=%x1e%H%x1f%cI` output into commits and collect
 * `+status:` / `+type:` frontmatter lines per diffed file. Diff attribution
 * follows the b-side path of each `diff --git` header.
 */
export function parseLog(out: string): ParsedLog {
  const events: StatusEvent[] = [];
  const renames = new Map<string, string>();
  const types = new Map<string, string>();
  const commitDates: string[] = [];

  let currentPath: string | null = null;
  for (const line of out.split("\n")) {
    if (line.startsWith(RECORD_SEP)) {
      // Commit header: <RS><hash><US><committer ISO date>.
      const idx = line.indexOf(UNIT_SEP);
      commitDates.push(idx === -1 ? "" : line.slice(idx + 1));
      currentPath = null;
      continue;
    }
    const seq = commitDates.length - 1;
    if (seq < 0) continue; // stray output before the first commit header
    if (line.startsWith("diff --git ")) {
      const match = line.match(/^diff --git a\/(.*) b\/(.*)$/);
      currentPath = match ? match[2] : null;
      continue;
    }
    if (currentPath === null) continue;
    if (line.startsWith("rename from ")) {
      renames.set(line.slice("rename from ".length), currentPath);
      continue;
    }
    if (line.startsWith("rename to ")) continue; // b-side path is already tracked
    if (!line.startsWith("+") && !line.startsWith("-")) continue;
    const content = line.slice(1);
    if (line.startsWith("+") && content.startsWith("type:")) {
      const type = unquote(content.slice("type:".length));
      if (type) types.set(currentPath, type);
      continue;
    }
    if (!content.startsWith("status:")) continue;
    if (line.startsWith("-")) continue; // old value; the + line carries the transition
    const status = unquote(content.slice("status:".length));
    if (status) events.push({ seq, date: commitDates[seq], path: currentPath, status });
  }
  return { events, renames, types };
}
