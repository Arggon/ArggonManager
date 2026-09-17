/**
 * task-skill-generated-command-reference: the SKILL command reference is
 * GENERATED from the live CLI so drift is impossible by construction.
 *
 * The commander definitions in cli/src/cli.ts are introspected by parsing the
 * source (the same approach the mcp-parity harness uses — cli.ts calls
 * `program.parse()` at module load, so importing it is not an option): every
 * `.command("...")` contributes its name, `.argument(...)` usage specs and its
 * `.description(...)` string. renderGeneratedCommands splices those lines into
 * the marker regions of skills/arggon-cli/SKILL.md; cli/src/skill-generated-commands.test.ts
 * fails when a command changes without re-running `npm run skills:sync`.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface CliCommandInfo {
  /** Command path, e.g. ["spec", "new"] for the nested `arggon spec new`. */
  path: string[];
  /** Usage spec from .argument() calls, e.g. "<slug> --title". */
  args: string;
  /** The .description() string. */
  description: string;
}

/** cli/src/cli.ts path (source of truth for the introspection). */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const cliSourcePath = join(repoRoot, "cli/src/cli.ts");

/**
 * Commands with NO generated SKILL reference line (maintained exclusion list —
 * every entry needs a reason; adding an undocumented user-facing command
 * without excluding or documenting it fails the cross-check test).
 */
export const COMMAND_EXCLUSIONS: Record<string, string> = {
  hello: "scaffold-era sanity check (README smoke test only), not part of any agent workflow",
  mcp: "internal stdio server — agents reach it via MCP client registration (.mcp.json), never by typing `arggon mcp`",
  spec: "grouping command (no action of its own) — its subcommands are documented instead",
  stack: "grouping command (no action of its own) — its subcommands are documented instead",
  playbook: "grouping command (no action of its own) — its subcommands are documented instead",
  priority: "grouping command (no action of its own) — its subcommands are documented instead",
};

/** Extract the CLI command surface from the cli.ts source. */
export function extractCliCommands(source: string): CliCommandInfo[] {
  const infos: CliCommandInfo[] = [];
  const commandRe = /\.command\("([^"]+)"\)/g;
  const matches = [...source.matchAll(commandRe)];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]!;
    const name = match[1]!;
    const blockEnd = i + 1 < matches.length ? matches[i + 1]!.index : source.length;
    const block = source.slice(match.index!, blockEnd);

    // Nesting: cli.ts chains top-level commands off `program` and nested
    // subcommands off the grouping variables (`spec`, `stack`, `playbook`):
    //   const spec = program.command("spec")...; spec.command("validate")...
    // The token immediately before `.command(` names the owner, so a match
    // preceded by `program` is top-level and anything else nests under the
    // single-segment command with that name.
    const ownerMatch = source.slice(0, match.index).match(/([A-Za-z_$][\w$]*)\s*$/);
    const owner = ownerMatch?.[1] ?? "program";
    const parentInfo =
      owner === "program"
        ? undefined
        : [...infos].reverse().find((info) => info.path.length === 1 && info.path[0] === owner);
    if (owner !== "program" && !parentInfo) {
      throw new Error(`skill-commands: cannot resolve parent group "${owner}" for .command("${name}")`);
    }
    const path = parentInfo ? [...parentInfo.path, name] : [name];

    infos.push({
      path,
      args: extractArguments(block),
      description: extractDescription(name, block),
    });
  }
  return infos;
}

/** Join the `.argument("<spec>", ...)` usage tokens of a command block. */
function extractArguments(block: string): string {
  const actionAt = block.indexOf(".action(");
  const definitions = actionAt < 0 ? block : block.slice(0, actionAt);
  const specs: string[] = [];
  const argumentRe = /\.argument\(/g;
  for (const match of definitions.matchAll(argumentRe)) {
    const literal = parseStringLiteral(definitions, match.index! + match[0].length);
    if (!literal) throw new Error(`skill-commands: cannot parse an .argument() spec`);
    specs.push(literal);
  }
  return specs.join(" ");
}

/** Parse the first `.description(...)` string literal in a command block. */
function extractDescription(name: string, block: string): string {
  const at = block.indexOf(".description(");
  if (at < 0) throw new Error(`skill-commands: .command("${name}") has no .description()`);
  const literal = parseStringLiteral(block, at + ".description(".length);
  if (!literal) throw new Error(`skill-commands: cannot parse .description() of "${name}"`);
  return literal;
}

/**
 * Read a double-quoted string literal starting at `from` (whitespace skipped).
 * Adjacent literals (implicit TS concatenation across lines) are joined.
 */
function parseStringLiteral(source: string, from: number): string | undefined {
  let i = from;
  let result = "";
  for (;;) {
    while (i < source.length && /\s/.test(source[i]!)) i++;
    if (source[i] !== '"') return result.length > 0 ? result : undefined;
    i++;
    let literal = "";
    while (i < source.length && source[i] !== '"') {
      if (source[i] === "\\") {
        literal += source[i] + source[i + 1];
        i += 2;
        continue;
      }
      literal += source[i];
      i++;
    }
    if (i >= source.length) return undefined;
    i++; // closing quote
    result += literal;
    // Keep consuming only if the very next non-space char is another quote.
    let j = i;
    while (j < source.length && /\s/.test(source[j]!)) j++;
    if (source[j] !== '"') return result;
  }
}

/** Full usage of a command, e.g. "spec new <slug>". */
export function commandUsage(info: CliCommandInfo): string {
  return [...info.path, info.args].filter(Boolean).join(" ");
}

export const GENERATED_START = (filter: string) =>
  `<!-- arggon:generated-commands start: ${filter} -->`;
export const GENERATED_END = "<!-- arggon:generated-commands end -->";
const REGION_RE =
  /<!-- arggon:generated-commands start: (.+?) -->\n([\s\S]*?)<!-- arggon:generated-commands end -->/g;

/** Render one region: `arggon <usage>  # <description>` lines for the filter. */
export function renderRegion(infos: CliCommandInfo[], filter: string): string {
  // Filter keys are command paths ("spec new"), not usage strings — the
  // rendered line still carries the full usage with .argument() specs.
  const byPath = new Map(infos.map((info) => [info.path.join(" "), info]));
  const keys = filter.split(",").map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) throw new Error("skill-commands: empty generated-commands filter");
  return (
    keys
      .map((key) => {
        const info = byPath.get(key);
        if (!info) throw new Error(`skill-commands: filter key "${key}" matches no CLI command`);
        return `arggon ${commandUsage(info)}  # ${info.description}`;
      })
      .join("\n") + "\n"
  );
}

/**
 * Splice every generated region of the SKILL source with freshly rendered
 * content. Throws on a command/argument change that invalidated a filter key.
 */
export function spliceGeneratedCommands(source: string, infos: CliCommandInfo[]): string {
  return source.replace(REGION_RE, (_m, filter: string) => {
    return `${GENERATED_START(filter.trim())}\n${renderRegion(infos, filter.trim())}${GENERATED_END}`;
  });
}

/** Load the CLI source and extract the command surface (shared entry point). */
export function loadCliCommands(): CliCommandInfo[] {
  return extractCliCommands(readFileSync(cliSourcePath, "utf8"));
}
