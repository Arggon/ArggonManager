/**
 * MCP tool-surface doc contract (bug-agents-md-says-nine-mcp-tools).
 *
 * The `arggon mcp` surface is a registry — the `TOOLS` array in
 * `cli/src/mcp-server.ts` — and four documents enumerate it:
 * `ArggonManager/docs/agents.md` §MCP server, the JSON contract
 * `ArggonManager/docs/json-output.md`, the user-facing `README.md`, and the CLI
 * skill's `references/json-contract.md`. Nothing connected them, so ADR 0014
 * could ship six more tools (`priority`, `sync`, `import_issues`, `start`,
 * `branch`, `cleanup`) and three of those four documents would still describe
 * nine — while `agents.md` itself said BOTH nine (§MCP server) and fifteen
 * (§ZCode, and §OpenCode V2 for the native namespace) in the same file. That is
 * the defect class this suite closes: a carrier restates a fact that changed
 * elsewhere and the restatement is never updated.
 *
 * Every assertion is pinned to the REAL corpus — the MCP registry and the
 * plugin's own tool specs, imported from their source, never a fixture or a
 * hand-typed list (the posture `adr-index-parity.test.ts` takes over the ADR
 * directory). The rules:
 *
 *   1. MEMBERSHIP of each documented enumeration, BOTH directions. A shipped
 *      tool no document names fails; a documented tool no registry entry backs
 *      fails. The message names the offending tools, never a bare count, so the
 *      fix is "add arggon_sync to the list", not "recompute something".
 *   2. COUNT AGREEMENT — the number word an enumeration prints next to "tools"
 *      must be the registry size. A set can be complete while the headline
 *      number lies, which is exactly how this shipped: the nine-tool list had
 *      nine names and the count matched, in three documents at once.
 *   3. No agent-facing document may NAME a tool the registry does not ship —
 *      the other drift direction, an invented or renamed tool.
 *
 * The native (OpenCode V2 Code Mode) surface had the same shape one sentence
 * away, so it is pinned too: §OpenCode V2 read "the core nine also
 * `options.pinned`" while the plugin pinned a DIFFERENT nine (W4 moved `start`
 * into the pinned set and left `report` out of it, and `report` was never named
 * as unpinned in the carrier):
 *
 *   4. the tools the carrier enumerates next to `options.pinned` are exactly
 *      the plugin's pinned tools, and its "fifteen Code Mode tools" count is the
 *      plugin's own tool count;
 *   5. every name in `PINNED_TOOL_NAMES` is a real native tool, so a renamed
 *      tool cannot leave a dead pin behind.
 *
 * Scope: the documents that describe the surface. ADRs, plans, specs,
 * explorations and tracker items are deliberately NOT pinned — they are dated
 * records of what was true when written, and this repo supersedes rather than
 * rewrites them (ADR 0006/0007/0014 say "nine" in exactly that sense). The
 * byte-equal `.agents/skills/` copy of the skill needs no rule of its own:
 * `cli/src/skill-copy.test.ts` already pins it to `skills/arggon-cli/`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { nativeToolSchemas, PINNED_TOOL_NAMES } from "../../opencode/plugins/arggon/index.js";
import { MCP_TOOL_NAMES } from "./mcp-server.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function read(relative: string): string {
  return readFileSync(join(repoRoot, relative), "utf8");
}

/** The registry: every tool name `arggon mcp` advertises, in `tools/list` order. */
const REGISTRY: string[] = [...MCP_TOOL_NAMES];
const REGISTERED = new Set(REGISTRY);

/** The native Code Mode namespace, from the plugin's own tool specs. */
const NATIVE = nativeToolSchemas();
const NATIVE_NAMES = new Set(NATIVE.map((tool) => tool.name));
const NATIVE_PINNED = NATIVE.filter((tool) => tool.pinned).map((tool) => tool.name);

/**
 * `arggon_*` tool names mentioned in `text`, order-preserved and de-duplicated.
 * Two client-side spellings of the same registry are normalised first: the ZCode
 * seam exposes it as `mcp__arggon__<tool>`, and the OpenCode permission
 * deny-lists as the MCP-qualified `<server>_<tool>` form `arggon_arggon_create`.
 * Both are transport prefixes over one surface, not different tools.
 */
function namedTools(text: string): string[] {
  const normalised = text.replace(/mcp__arggon__/g, "").replace(/\barggon_arggon_/g, "arggon_");
  return [...new Set(normalised.match(/\barggon_[a-z][a-z_]*/g) ?? [])];
}

/** The one paragraph in `file` that contains `anchor` (an empty result fails). */
function paragraphWith(file: string, anchor: string): string {
  const found = read(file)
    .split(/\n[ \t]*\n/)
    .filter((paragraph) => paragraph.includes(anchor));
  expect(
    found.length,
    `${file}: expected exactly one paragraph containing "${anchor}", found ${found.length} — ` +
      "update this suite's anchor together with the sentence it pins",
  ).toBe(1);
  return found[0]!;
}

/** English number words, so "fifteen tools" is read as a count, not as prose. */
const COUNT_WORDS: Readonly<Record<string, number>> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};

/**
 * A number stated as a tool count: a number word (or digit) followed by up to
 * two words and then "tool"/"tools", so both `**fifteen** tools` and `fifteen
 * Code Mode tools` are read as claims. Markdown emphasis may sit between the
 * parts, hence `[\s*]`. Only known number words and digits match, and the gap
 * words must be plain words, so ordinary prose is never read as a count (the
 * gap cannot cross a sentence end).
 */
const COUNT_NEXT_TO_TOOLS = new RegExp(
  `\\b(\\d+|${Object.keys(COUNT_WORDS).join("|")})[\\s*]+(?:[A-Za-z][\\w'-]*[\\s*]+){0,2}tools?\\b`,
  "gi",
);

function countsNextToTools(paragraph: string): number[] {
  return [...paragraph.matchAll(COUNT_NEXT_TO_TOOLS)].map((match) => {
    const raw = match[1]!.toLowerCase();
    return /^\d+$/.test(raw) ? Number(raw) : (COUNT_WORDS[raw] ?? Number.NaN);
  });
}

/**
 * Every document that enumerates the whole `arggon mcp` surface, with the
 * count-neutral anchor that opens its enumeration (an anchor must not contain
 * the number, or the assertion would restate the thing it checks). Add a file
 * here when one starts listing the surface — the rule then covers it for free.
 */
const ENUMERATIONS: ReadonlyArray<{ file: string; anchor: string }> = [
  { file: "ArggonManager/docs/agents.md", anchor: "the bounded read surface as" },
  { file: "ArggonManager/docs/json-output.md", anchor: "tool-result text content for its" },
  { file: "README.md", anchor: "Starts a stdio MCP server (JSON-RPC 2.0) exposing" },
  {
    file: "skills/arggon-cli/references/json-contract.md",
    anchor: "is the optional stdio MCP server",
  },
];

/** Agent-facing markdown: carriers, the JSON contract, the README, the shipped seams. */
const CORPUS_FILES: readonly string[] = [
  "README.md",
  "ArggonManager/docs/agents.md",
  "ArggonManager/docs/convention.md",
  "ArggonManager/docs/engineering.md",
  "ArggonManager/docs/json-output.md",
];
const CORPUS_DIRS: readonly string[] = [
  "skills/arggon-cli",
  "templates/docs",
  ".zcode-marketplace",
  ".opencode/agents",
  ".opencode/commands",
];

function* markdownFiles(relative: string): Generator<string> {
  for (const entry of readdirSync(join(repoRoot, relative), { withFileTypes: true })) {
    const child = `${relative}/${entry.name}`;
    if (entry.isDirectory()) yield* markdownFiles(child);
    else if (entry.name.endsWith(".md")) yield child;
  }
}

/**
 * The sentence carrying the carrier's `options.pinned` claim: the text from the
 * phrase to the first closing parenthesis or sentence end, whichever comes
 * first. The pinned tools are enumerated inside that parenthetical.
 */
function pinnedWindow(paragraph: string): string {
  const tail = paragraph.slice(paragraph.indexOf("options.pinned"));
  const stops = [")", ". "].map((stop) => tail.indexOf(stop)).filter((at) => at >= 0);
  return tail.slice(0, stops.length > 0 ? Math.min(...stops) : undefined);
}

/** Symmetric difference as readable lines, naming the tool that drifted. */
function drift(label: string, documented: string[], shipped: string[], verb: string): string[] {
  const named = new Set(documented);
  const provided = new Set(shipped);
  return [
    ...[...provided]
      .filter((name) => !named.has(name))
      .map((name) => `${label}: ${name} is ${verb} but never named`),
    ...[...named]
      .filter((name) => !provided.has(name))
      .map((name) => `${label}: ${name} is named but not ${verb}`),
  ];
}

describe("the documented arggon mcp surface matches the tool registry", () => {
  it("reads a non-empty registry with no duplicate tool names", () => {
    // An empty or duplicated registry would make every membership assertion
    // below pass vacuously, so the premise is asserted first.
    expect(REGISTRY.length).toBeGreaterThan(0);
    expect([...REGISTERED]).toHaveLength(REGISTRY.length);
    expect(REGISTRY.every((name) => name.startsWith("arggon_"))).toBe(true);
  });

  it.each(ENUMERATIONS.map((entry) => [entry.file, entry.anchor] as const))(
    "%s enumerates exactly the registered tools",
    (file, anchor) => {
      const paragraph = paragraphWith(file, anchor);
      expect(drift(file, namedTools(paragraph), REGISTRY, "shipped")).toEqual([]);
    },
  );

  it.each(ENUMERATIONS.map((entry) => [entry.file, entry.anchor] as const))(
    "%s states the registry's size, not a stale count",
    (file, anchor) => {
      const counts = countsNextToTools(paragraphWith(file, anchor));
      expect(
        counts.length,
        `${file}: no number word next to "tools" — the enumeration must state its size`,
      ).toBeGreaterThan(0);
      expect(
        counts
          .filter((count) => count !== REGISTRY.length)
          .map((count) => `${file}: says "${count} tools", registry has ${REGISTRY.length}`),
      ).toEqual([]);
    },
  );

  it("never names a tool the registry does not ship", () => {
    const files = [...CORPUS_FILES, ...CORPUS_DIRS.flatMap((dir) => [...markdownFiles(dir)])];
    expect(files.length).toBeGreaterThan(CORPUS_FILES.length);
    const problems: string[] = [];
    for (const file of files) {
      for (const name of namedTools(read(file))) {
        if (!REGISTERED.has(name)) problems.push(`${file}: ${name} is named but not shipped`);
      }
    }
    expect(problems).toEqual([]);
  });
});

describe("the documented native (Code Mode) surface matches the plugin", () => {
  it("reads a non-empty native registry with no duplicate names", () => {
    expect(NATIVE.length).toBeGreaterThan(0);
    expect(NATIVE_NAMES.size).toBe(NATIVE.length);
  });

  it("pins every name the carrier lists next to options.pinned", () => {
    const file = "ArggonManager/docs/agents.md";
    // The pinned tools are enumerated inside the parenthetical that carries the
    // claim — `codemode: true`; nine of them also `options.pinned` — `list`, …,
    // W4's `start`, the claim → worktree entry `/arggon-start` drives)`. The
    // bare-identifier match drops `/arggon-start` (a command path, not a tool)
    // and keeps only names the plugin really registers.
    const window = pinnedWindow(paragraphWith(file, "options.pinned"));
    const documented = (window.match(/`([a-z][a-z_]*)`/g) ?? [])
      .map((token) => token.slice(1, -1))
      .filter((name) => NATIVE_NAMES.has(name));
    expect(drift(`${file} (options.pinned)`, documented, NATIVE_PINNED, "pinned")).toEqual([]);
  });

  it("states the native tool count the plugin registers", () => {
    const file = "ArggonManager/docs/agents.md";
    const counts = countsNextToTools(paragraphWith(file, "options.pinned"));
    expect(
      counts.length,
      `${file}: no number word next to "tools" — §OpenCode V2 must state the native count`,
    ).toBeGreaterThan(0);
    expect(
      counts
        .filter((count) => count !== NATIVE.length)
        .map((count) => `${file}: says "${count} tools", plugin registers ${NATIVE.length}`),
    ).toEqual([]);
  });

  it("pins no name that is not a native tool", () => {
    expect(PINNED_TOOL_NAMES.filter((name) => !NATIVE_NAMES.has(name))).toEqual([]);
  });
});
