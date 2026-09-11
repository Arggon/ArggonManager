import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findTasksDir, repoRootFromTasks } from "./paths.js";

/**
 * `arggon instructions` (task-instructions-command): print the agent wiring
 * (install, pre-commit hook, CI gate, AGENTS.md snippet) on demand, exactly
 * like Backlog.md's `instructions` command. The snippets are extracted from
 * the playbook source (`docs/agents.md`, §Reference integrations) at runtime
 * — this module never duplicates their text, so doc and command cannot drift.
 */

export type Snippet = {
  /** Fenced-block language tag (`sh`, `yaml`, `markdown`); empty when unknown. */
  language: string;
  /** Snippet source text (unindented fence content). */
  body: string;
};

export type InstructionsResult = {
  /** Repo root (parent of tasks/). */
  root: string;
  /** Playbook doc the snippets were extracted from, relative to root. */
  source: string;
  snippets: {
    /** Prerequisite shell commands (one per line, from the bullet list). */
    install: Snippet;
    /** `.git/hooks/pre-commit` gate. */
    precommit: Snippet;
    /** CI validate job. */
    ci: Snippet;
    /** AGENTS.md wiring snippet. */
    agent: Snippet;
  };
};

const PLAYBOOK_PATH = "docs/agents.md";

export function runInstructions(opts: { cwd: string }): InstructionsResult {
  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);
  const docPath = join(root, PLAYBOOK_PATH);
  if (!existsSync(docPath)) {
    throw new Error(`playbook not found at ${PLAYBOOK_PATH} (this command mirrors docs/agents.md)`);
  }
  const md = readFileSync(docPath, "utf8");

  return {
    root,
    source: PLAYBOOK_PATH,
    snippets: {
      install: installSnippet(md),
      precommit: fencedAfterHeading(md, "### Pre-commit gate", "sh"),
      ci: fencedAfterHeading(md, "### CI gate", "yaml"),
      agent: fencedAfterHeading(md, "### Agent instructions snippet", "markdown"),
    },
  };
}

/** Text following `heading` up to the next heading line outside any fence. */
function sectionAfter(md: string, heading: string): string {
  const start = md.indexOf(`\n${heading}\n`);
  if (start === -1) {
    throw new Error(`playbook section '${heading}' not found in ${PLAYBOOK_PATH}`);
  }
  const lines = md.slice(start + 1 + heading.length + 1).split("\n");
  const out: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line)) inFence = !inFence;
    if (!inFence && /^#{1,6} /.test(line)) break;
    out.push(line);
  }
  return out.join("\n");
}

/** First fenced code block in `text`. */
function firstFence(text: string, fallbackLang: string): Snippet {
  const match = /```([A-Za-z0-9_-]*)\n([\s\S]*?)\n```/.exec(text);
  if (!match) {
    throw new Error(`no fenced snippet found in the expected playbook section`);
  }
  return { language: match[1] || fallbackLang, body: match[2] };
}

function fencedAfterHeading(md: string, heading: string, fallbackLang: string): Snippet {
  return firstFence(sectionAfter(md, heading), fallbackLang);
}

/**
 * Install commands: bullets in §Prerequisites that are bare inline-code
 * items (`- \`npm install\``), in document order, as shell lines.
 */
function installSnippet(md: string): Snippet {
  const section = sectionAfter(md, "## Prerequisites");
  const lines = [...section.matchAll(/^- `([^`]+)`$/gm)].map((m) => m[1]!);
  if (lines.length === 0) {
    throw new Error("no install commands found in the playbook prerequisites section");
  }
  return { language: "sh", body: lines.join("\n") };
}
