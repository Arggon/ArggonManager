import { existsSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { docsDirForRoot, findTasksDir, repoRootFromTasks } from "@arggondev/lib";
import { canonicalContract } from "./workflow-docs.js";

/**
 * `arggon instructions` (task-instructions-command): print the agent wiring
 * (install, pre-commit hook, CI gate, AGENTS.md snippet) on demand, exactly
 * like Backlog.md's `instructions` command. The snippets are extracted from
 * the playbook source (`ArggonManager/docs/agents.md` on the v5 layout,
 * `docs/agents.md` on legacy trees; §Reference integrations) at runtime
 * — this module never duplicates their text, so doc and command cannot drift.
 *
 * The AGENTS.md snippet is the playbook's marked copy region plus the canonical
 * workflow contract (§2). The doc carries only the pointer because the
 * start-here page is byte-budgeted; composing here keeps the printed
 * copy-paste instructions complete without a second copy in the doc (issue
 * #869).
 */

export type Snippet = {
  /** Fenced-block language tag (`sh`, `yaml`, `markdown`); empty when unknown. */
  language: string;
  /** Snippet source text (unindented fence content). */
  body: string;
};

export type InstructionsResult = {
  /** Repo root (parent of the tracker dir). */
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

/** Playbook file name inside the product-docs dir. */
const PLAYBOOK_FILE = "agents.md";

export function runInstructions(opts: { cwd: string }): InstructionsResult {
  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);
  const docPath = join(docsDirForRoot(root), PLAYBOOK_FILE);
  const source = relative(root, docPath).split(sep).join("/");
  if (!existsSync(docPath)) {
    throw new Error(`playbook not found at ${source} (this command mirrors the agent playbook)`);
  }
  const md = readFileSync(docPath, "utf8");

  return {
    root,
    source,
    snippets: {
      install: installSnippet(md, source),
      precommit: fencedAfterHeading(md, "### Pre-commit gate", "sh", source),
      ci: fencedAfterHeading(md, "### CI gate", "yaml", source),
      agent: agentSnippet(md, source),
    },
  };
}

/**
 * The agent snippet: the playbook's marked copy region, then the canonical
 * workflow contract when the playbook publishes one. A legacy/custom playbook
 * without the markers keeps its fenced block verbatim (the pre-#869 contract).
 */
function agentSnippet(md: string, source: string): Snippet {
  const snippet = fencedAfterHeading(md, "### Agent instructions snippet", "markdown", source);
  if (!md.includes("<!-- arggon:workflow-source:start -->")) return snippet;
  return {
    language: snippet.language,
    body: `${snippet.body.trimEnd()}\n\n${canonicalContract(md).trimEnd()}`,
  };
}

/** Text following `heading` up to the next heading line outside any fence. */
function sectionAfter(md: string, heading: string, source: string): string {
  const start = md.indexOf(`\n${heading}\n`);
  if (start === -1) {
    throw new Error(`playbook section '${heading}' not found in ${source}`);
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

function fencedAfterHeading(
  md: string,
  heading: string,
  fallbackLang: string,
  source: string,
): Snippet {
  return firstFence(sectionAfter(md, heading, source), fallbackLang);
}

/**
 * Install commands: bullets in §Prerequisites that are bare inline-code
 * items (`- \`npm install\``), in document order, as shell lines.
 */
function installSnippet(md: string, source: string): Snippet {
  const section = sectionAfter(md, "## Prerequisites", source);
  const lines = [...section.matchAll(/^- `([^`]+)`$/gm)].map((m) => m[1]!);
  if (lines.length === 0) {
    throw new Error("no install commands found in the playbook prerequisites section");
  }
  return { language: "sh", body: lines.join("\n") };
}
