/**
 * `arggon stack explore` + `arggon playbook` — technology playbooks with
 * version-freshness tracking (story-tech-playbooks).
 *
 * Exploration records (docs/explorations/) are the spike notes that precede a
 * stack ADR. Playbooks (docs/playbooks/<tech>.md) pin the chosen version and
 * the current best practices; `playbook status` flags stale ones and can file
 * a re-research task into the tracker through the same kernel as create.
 * The research itself (candidates, comparisons, dated sources) is the
 * caller's job at creation time — the CLI records and tracks freshness.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { readConventionConfig, readConventionVersion, type PlaybooksConfig } from "./convention.js";
import { formatDate } from "./dates.js";
import { itemsById, loadItems } from "./items.js";
import { slugify } from "./ids.js";
import { bundledTemplatesDir, findTasksDir, repoRootFromTasks } from "./paths.js";
import { runCreate } from "./create.js";

/** Default stale threshold for `arggon playbook status` (docs/convention.md x-playbooks). */
export const PLAYBOOK_MAX_AGE_DAYS_DEFAULT = 90;

const KEBAB_CASE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

function posixRel(root: string, abs: string): string {
  return relative(root, abs).split(sep).join("/");
}

function todayUtc(now?: Date): string {
  return formatDate(now ?? new Date());
}

/** Whole days from `fromDate` to `toDate` (both YYYY-MM-DD, UTC); null when unparseable. */
function daysBetween(fromDate: string, toDate: string): number | null {
  if (!DATE_PATTERN.test(fromDate) || !DATE_PATTERN.test(toDate)) return null;
  const fromMs = Date.parse(`${fromDate}T00:00:00Z`);
  const toMs = Date.parse(`${toDate}T00:00:00Z`);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return null;
  return Math.round((toMs - fromMs) / DAY_MS);
}

/**
 * Lenient frontmatter reader for playbook documents: top-level `key: value`
 * lines only; missing frontmatter or nested structures yield partial data
 * (playbooks are prose records, so status reporting never hard-fails on one
 * hand-edited file — an unreadable playbook simply reports as stale).
 */
function parsePlaybookFrontmatter(raw: string): Record<string, string> {
  const normalized = raw.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---\n") && !normalized.startsWith("---\r\n")) return {};
  const rest = normalized.slice(normalized.indexOf("\n") + 1);
  const endMatch = rest.match(/\r?\n---\r?\n?/);
  if (!endMatch || endMatch.index === undefined) return {};
  const data: Record<string, string> = {};
  for (const line of rest.slice(0, endMatch.index).split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!key) continue;
    data[key] = value;
  }
  return data;
}

function assertKebabCase(value: string, what: string): void {
  if (!KEBAB_CASE_PATTERN.test(value)) {
    throw new Error(
      `invalid ${what} ${JSON.stringify(value)} (must be kebab-case ASCII: ^[a-z0-9]+(-[a-z0-9]+)*$)`,
    );
  }
}

// ---------------------------------------------------------------------------
// stack explore — exploration records
// ---------------------------------------------------------------------------

export type StackExploreOptions = {
  cwd: string;
  /** Topic to explore; slugified for the filename (e.g. "Vector Database" -> vector-database). */
  topic: string;
  /** Doc title (defaults to the topic as given). */
  title?: string;
  now?: Date;
};

export type StackExploreResult = {
  root: string;
  /** Created paths, posix, relative to the repo root. */
  files: string[];
};

const EXPLORATION_TEMPLATE_FALLBACK = `---
exploration_id: {{ID}}
title: {{TITLE}}
status: open
created: {{DATE}}
---

# Exploration: {{TITLE}} ({{ID}})

Spike record: compare the candidates below, cite dated sources, and record a
recommendation. The decision itself lands in an ADR (\`docs/adr/\`) — link it
under Decision. A technology playbook (\`arggon playbook new\`) is generated
after the decision.

## Candidates

<!-- One option per candidate: libraries, frameworks, or approaches worth comparing. -->

## Criteria

<!-- What "better" means for this decision: maintenance risk, license, performance,
     ergonomics, ecosystem health, ... Keep the list short and weighted. -->

## Findings

<!-- Facts learned while comparing candidates. Every claim needs a source link
     with the access date, e.g. \`- <claim> (source: <url>, {{DATE}})\`. -->

## Recommendation

<!-- Which candidate wins under the criteria above, and why the others lose. -->

## Decision

<!-- ADR reference placeholder: docs/adr/0000-<slug>.md once the ADR lands. -->
`;

function renderExplorationTemplate(vars: Record<string, string>): string {
  let raw: string;
  const bundled = join(bundledTemplatesDir(), "exploration.md");
  try {
    raw = readFileSync(bundled, "utf8");
  } catch {
    raw = EXPLORATION_TEMPLATE_FALLBACK;
  }
  return raw.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

/** Max existing NNN across docs/explorations (any exploration-<slug>-NNN.md counts). */
function nextExplorationNumber(root: string): number {
  const dir = join(root, "docs", "explorations");
  if (!existsSync(dir)) return 1;
  let max = 0;
  for (const name of readdirSync(dir)) {
    const match = name.match(/-(\d{3,})\.md$/);
    if (match) max = Math.max(max, Number.parseInt(match[1]!, 10));
  }
  return max + 1;
}

export function runStackExplore(opts: StackExploreOptions): StackExploreResult {
  const topic = opts.topic.trim();
  if (!topic) throw new Error("topic is required");
  const slug = slugify(topic);
  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);
  const nnn = nextExplorationNumber(root);
  const padded = String(nnn).padStart(3, "0");
  const title = opts.title && opts.title.trim() !== "" ? opts.title.trim() : topic;

  const dir = join(root, "docs", "explorations");
  const path = join(dir, `exploration-${slug}-${padded}.md`);
  if (existsSync(path)) {
    throw new Error(`refusing to overwrite existing file ${posixRel(root, path)}`);
  }

  const content = renderExplorationTemplate({
    SLUG: slug,
    NNN: padded,
    ID: `${slug}-${padded}`,
    TITLE: title,
    DATE: todayUtc(opts.now),
  });

  mkdirSync(dir, { recursive: true });
  writeFileSync(path, content, "utf8");
  return { root, files: [posixRel(root, path)] };
}

// ---------------------------------------------------------------------------
// playbook new — versioned playbooks
// ---------------------------------------------------------------------------

export type PlaybookNewOptions = {
  cwd: string;
  /** Technology slug (kebab-case); one playbook per tech. */
  tech: string;
  /** Chosen version to pin (default: "unpinned" — research is the caller's job). */
  version?: string;
  /** Display title (defaults to the tech slug, hyphens as spaces). */
  title?: string;
  now?: Date;
};

export type PlaybookNewResult = {
  root: string;
  /** Created paths, posix, relative to the repo root. */
  files: string[];
};

function playbookPath(root: string, tech: string): string {
  return join(root, "docs", "playbooks", `${tech}.md`);
}

function renderPlaybook(tech: string, title: string, version: string, researched: string): string {
  return `---
playbook_id: ${tech}
version: ${version}
researched: ${researched}
status: current
---

# ${title} playbook (${tech})

Technology playbook: the chosen version and the current best practices for
${tech}. The version/best-practices research happened when this file was
created — cite dated sources (URL + access date) in every section so the next
reader can re-verify, and keep this file current via
\`arggon playbook status\`.

## Setup

<!-- fill me: install/setup commands for version ${version}, verified against
     current upstream docs — research current best practices with dated sources
     before writing. -->

## Conventions

<!-- fill me: the patterns this repo follows with ${tech} (naming, structure,
     error handling), grounded in current best practices with dated sources. -->

## Testing

<!-- fill me: how to test ${tech} code here (tools, coverage, fixtures) per the
     currently recommended tooling — research with dated sources. -->

## Security

<!-- fill me: safe defaults, known pitfalls, and advisories affecting version
     ${version}; cite advisories with their dates. -->

## Upgrade policy

<!-- fill me: when to re-research (see \`arggon playbook status\`, stale after
     the configured max-age-days), how to pick the next version, and which
     sections to update. After re-researching, refresh this file with
     \`arggon playbook refresh ${tech} --version <v>\`. -->
`;
}

export function runPlaybookNew(opts: PlaybookNewOptions): PlaybookNewResult {
  const tech = opts.tech.trim();
  assertKebabCase(tech, "tech slug");
  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);

  const path = playbookPath(root, tech);
  if (existsSync(path)) {
    throw new Error(
      `refusing to overwrite existing playbook ${posixRel(root, path)} (one playbook per tech; ` +
        `use \`arggon playbook refresh ${tech} --version <v>\` after re-research)`,
    );
  }

  const version = opts.version && opts.version.trim() !== "" ? opts.version.trim() : "unpinned";
  const title = opts.title && opts.title.trim() !== "" ? opts.title.trim() : tech.replace(/-/g, " ");
  const researched = todayUtc(opts.now);

  mkdirSync(join(root, "docs", "playbooks"), { recursive: true });
  writeFileSync(path, renderPlaybook(tech, title, version, researched), "utf8");
  return { root, files: [posixRel(root, path)] };
}

// ---------------------------------------------------------------------------
// playbook status — freshness tracking
// ---------------------------------------------------------------------------

export type PlaybookStatusOptions = {
  cwd: string;
  /** Stale threshold override (wins over x-playbooks.max-age-days and the 90-day default). */
  maxAgeDays?: number;
  /** File one re-research task per stale playbook under this story id. */
  fileTask?: string;
  now?: Date;
};

export type PlaybookStatusEntry = {
  /** Playbook id (frontmatter playbook_id, else the filename stem). */
  id: string;
  version: string;
  /** Research date as recorded (YYYY-MM-DD), or null when missing/unparseable. */
  researched: string | null;
  /** Whole days since `researched` (null when the date is missing/unparseable). */
  ageDays: number | null;
  /** True when the playbook needs re-research (unknown age counts as stale). */
  stale: boolean;
  /** Path, posix, relative to the repo root. */
  path: string;
};

export type PlaybookStatusResult = {
  root: string;
  conventionVersion: number;
  maxAgeDays: number;
  /** One entry per playbook in docs/playbooks/, sorted by id. */
  playbooks: PlaybookStatusEntry[];
  staleCount: number;
  /** With --file-task: ids of re-research tasks created this run. */
  created: string[];
  /** With --file-task: ids whose re-research task already existed (skipped). */
  skipped: string[];
};

function listPlaybooks(root: string): string[] {
  const dir = join(root, "docs", "playbooks");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => join(dir, name));
}

function resolveMaxAgeDays(
  opts: PlaybookStatusOptions,
  config: PlaybooksConfig,
): number {
  if (opts.maxAgeDays !== undefined) return opts.maxAgeDays;
  if (config.maxAgeDays !== null) return config.maxAgeDays;
  return PLAYBOOK_MAX_AGE_DAYS_DEFAULT;
}

export function runPlaybookStatus(opts: PlaybookStatusOptions): PlaybookStatusResult {
  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);
  const config = readConventionConfig(root);
  const maxAgeDays = resolveMaxAgeDays(opts, config.playbooks);
  const today = todayUtc(opts.now);

  const playbooks: PlaybookStatusEntry[] = listPlaybooks(root).map((abs) => {
    const rel = posixRel(root, abs);
    const data = parsePlaybookFrontmatter(readFileSync(abs, "utf8"));
    const id = data["playbook_id"]?.trim() || basenameStem(rel);
    const version = data["version"]?.trim() || "unknown";
    const researchedRaw = data["researched"]?.trim() ?? "";
    const researched = DATE_PATTERN.test(researchedRaw) ? researchedRaw : null;
    const ageDays = researched === null ? null : daysBetween(researched, today);
    const stale = ageDays === null || ageDays > maxAgeDays;
    return { id, version, researched, ageDays, stale, path: rel };
  });
  playbooks.sort((a, b) => a.id.localeCompare(b.id) || a.path.localeCompare(b.path));

  const result: PlaybookStatusResult = {
    root,
    conventionVersion: readConventionVersion(root),
    maxAgeDays,
    playbooks,
    staleCount: playbooks.filter((p) => p.stale).length,
    created: [],
    skipped: [],
  };

  if (opts.fileTask !== undefined) {
    const story = opts.fileTask.trim();
    if (!story) throw new Error("--file-task requires a story id");
    const byId = itemsById(loadItems(tasksDir));
    for (const playbook of playbooks) {
      if (!playbook.stale) continue;
      const stem = `re-research-${playbook.id}`;
      assertKebabCase(playbook.id, "playbook id");
      if (byId.has(`task-${stem}`)) {
        result.skipped.push(`task-${stem}`);
        continue;
      }
      const age = playbook.ageDays === null ? "age unknown" : `${playbook.ageDays} days old`;
      runCreate({
        cwd: opts.cwd,
        type: "task",
        id: stem,
        title: `Re-research ${playbook.id} playbook (v${playbook.version}, ${age})`,
        parent: story,
        status: "todo",
        body: [
          "## Context",
          "",
          `Playbook \`${playbook.path}\` (version ${playbook.version}) is ${age} and past the`,
          `${maxAgeDays}-day freshness threshold. Re-research the current best practices`,
          "with dated sources, then refresh the playbook:",
          "",
          "```bash",
          `arggon playbook refresh ${playbook.id} --version <v>`,
          "```",
          "",
          "## Acceptance",
          "",
          "- [ ] Current best practices re-researched with dated sources",
          `- [ ] Playbook refreshed via \`arggon playbook refresh ${playbook.id} --version <v>\``,
          "",
        ].join("\n"),
        now: opts.now,
      });
      result.created.push(`task-${stem}`);
    }
  }

  return result;
}

function basenameStem(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.md$/, "");
}

// ---------------------------------------------------------------------------
// playbook refresh — frontmatter-only freshness update
// ---------------------------------------------------------------------------

export type PlaybookRefreshOptions = {
  cwd: string;
  tech: string;
  /** The re-researched version (required — a refresh records a version decision). */
  version: string;
  now?: Date;
};

export type PlaybookRefreshResult = {
  root: string;
  /** Updated playbook path, posix, relative to the repo root. */
  path: string;
  version: string;
  researched: string;
};

/**
 * Frontmatter-only rewrite: replaces `version`, `researched`, and `status`
 * in the frontmatter block (appending any missing keys) and leaves every
 * other frontmatter line and the entire body byte-identical.
 */
export function runPlaybookRefresh(opts: PlaybookRefreshOptions): PlaybookRefreshResult {
  const tech = opts.tech.trim();
  assertKebabCase(tech, "tech slug");
  const version = opts.version?.trim() ?? "";
  if (!version) {
    throw new Error(
      "playbook refresh requires --version <v> (the version decided by the re-research)",
    );
  }
  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);
  const path = playbookPath(root, tech);
  if (!existsSync(path)) {
    throw new Error(
      `no playbook for '${tech}' at ${posixRel(root, path)} (create one with \`arggon playbook new ${tech}\`)`,
    );
  }

  const raw = readFileSync(path, "utf8");
  const researched = todayUtc(opts.now);
  const updates: Record<string, string> = {
    version,
    researched,
    status: "current",
  };

  const normalized = raw.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---\n") && !normalized.startsWith("---\r\n")) {
    // No frontmatter block: prepend one; the former content stays untouched below it.
    const block = ["---", ...Object.entries(updates).map(([k, v]) => `${k}: ${v}`), "---", ""].join(
      "\n",
    );
    writeFileSync(path, `${block}\n${raw}`, "utf8");
    return { root, path: posixRel(root, path), version, researched };
  }

  const lines = normalized.split(/\r?\n/);
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---" || lines[i] === "---\r") {
      close = i;
      break;
    }
  }
  if (close === -1) {
    throw new Error(`${posixRel(root, path)}: unterminated YAML frontmatter`);
  }
  for (let i = 1; i < close; i++) {
    const idx = lines[i]!.indexOf(":");
    if (idx === -1) continue;
    const key = lines[i]!.slice(0, idx).trim();
    if (key in updates) {
      lines[i] = `${key}: ${updates[key]}`;
      delete updates[key];
    }
  }
  const missing = Object.entries(updates);
  if (missing.length > 0) {
    lines.splice(close, 0, ...missing.map(([k, v]) => `${k}: ${v}`));
  }
  writeFileSync(path, `${lines.join("\n")}`, "utf8");
  return { root, path: posixRel(root, path), version, researched };
}

// ---------------------------------------------------------------------------
// human formatting
// ---------------------------------------------------------------------------

export function formatPlaybookStatusTable(result: {
  maxAgeDays: number;
  playbooks: PlaybookStatusEntry[];
  staleCount: number;
}): string {
  const lines: string[] = [];
  const techWidth = Math.max("tech".length, ...result.playbooks.map((p) => p.id.length));
  const versionWidth = Math.max("version".length, ...result.playbooks.map((p) => p.version.length));
  const researchedWidth = Math.max(
    "researched".length,
    ...result.playbooks.map((p) => p.researched?.length ?? "unknown".length),
  );
  lines.push(
    `${"tech".padEnd(techWidth)}  ${"version".padEnd(versionWidth)}  ${"researched".padEnd(researchedWidth)}  ${"age-days".padEnd(8)}  status`,
  );
  for (const p of result.playbooks) {
    const researched = p.researched ?? "unknown";
    const age = p.ageDays === null ? "unknown" : String(p.ageDays);
    const status = p.stale ? "STALE" : "current";
    lines.push(
      `${p.id.padEnd(techWidth)}  ${p.version.padEnd(versionWidth)}  ${researched.padEnd(researchedWidth)}  ${age.padEnd(8)}  ${status}`,
    );
  }
  if (result.playbooks.length === 0) {
    lines.push("(no playbooks in docs/playbooks/ — create one with `arggon playbook new <tech>`)");
  } else if (result.staleCount > 0) {
    lines.push(
      `${result.staleCount} stale playbook(s) (threshold: ${result.maxAgeDays} days) — ` +
        "re-research and `arggon playbook refresh <tech> --version <v>`, or file tasks with --file-task <story-id>",
    );
  } else {
    lines.push(`${result.playbooks.length} playbook(s), none stale (threshold: ${result.maxAgeDays} days)`);
  }
  return `${lines.join("\n")}\n`;
}
