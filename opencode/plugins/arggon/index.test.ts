import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADMISSION_STAMP_KEY,
  ADMISSION_STAMP_MAX_BYTES,
  CACHE_MAX_ENTRIES,
  ITEM_BLOCK_MAX_BYTES,
  MAX_SUBSTITUTION_DEPTH,
  admissionStampFromResolution,
  applyAdmissionStamp,
  boundText,
  buildAdmissionStamp,
  buildItemBlock,
  compactionRetentionPart,
  isArggonItemId,
  itemCacheKey,
  itemIdFromBranch,
  looksLikeCommitCommand,
  needsCompactionRetention,
  onCompaction,
  onPromptAdmission,
  onToolAfter,
  parseArggonItemFromCode,
  parseArggonItemFromCommand,
  parseArggonItemFromTool,
  parseValidateFailure,
  sessionDirectoryResolver,
  setBounded,
  worktreeOptions,
} from "./index.js";

// plan-opencode2-009 W3 (T9-T10): the plugin's correlation/formatting logic is
// pure and lives in the single plugin source (opencode/plugins/arggon/index.ts),
// which is copied verbatim into adopter trees. These tests exercise it without
// an OpenCode runtime; the hook plumbing and injected bytes are covered by
// `npm run smoke:opencode` (real headless sessions).
//
// The test lives next to the plugin source, OUTSIDE cli/src: `tsc -p
// tsconfig.json` has rootDir cli/src and must not compile a file imported from
// outside it (TS6059), and the plugin deliberately imports no types from
// @opencode/plugin. vitest.config.ts includes `opencode/**/*.test.ts` so the
// suite still runs it; eslint covers the whole tree.

const byteLength = (text: string): number => new TextEncoder().encode(text).length;

describe("plugin-context: arggon invocation parsing", () => {
  it("parses CLI subcommands that reference one item", () => {
    expect(parseArggonItemFromCommand("arggon show task-smoke-item --json")).toBe("task-smoke-item");
    expect(parseArggonItemFromCommand("npm run arggon -- update task-x --status in_progress")).toBe("task-x");
    expect(parseArggonItemFromCommand("cd repo && /usr/local/bin/arggon comment bug-login-500 'note'")).toBe(
      "bug-login-500",
    );
    expect(parseArggonItemFromCommand('arggon handoff "task-x" --next "go"')).toBe("task-x");
    expect(parseArggonItemFromCommand("arggon -q start task-x --worktree")).toBe("task-x");
  });

  it("ignores commands without an item reference", () => {
    expect(parseArggonItemFromCommand("arggon next --json")).toBeUndefined();
    expect(parseArggonItemFromCommand("arggon validate --json")).toBeUndefined();
    expect(parseArggonItemFromCommand("arggon create task 'New' --parent story-x")).toBeUndefined();
    expect(parseArggonItemFromCommand("arggon show --json")).toBeUndefined();
    expect(parseArggonItemFromCommand("argonite show task-x")).toBeUndefined();
    expect(parseArggonItemFromCommand("node cli/src/cli.ts show task-x")).toBeUndefined();
    expect(parseArggonItemFromCommand(undefined)).toBeUndefined();
  });

  it("anchors item correlation to command position (F2)", () => {
    expect(parseArggonItemFromCommand('grep -rn "arggon show task-x" .')).toBeUndefined();
    expect(parseArggonItemFromCommand('echo "arggon update task-fake"')).toBeUndefined();
    expect(parseArggonItemFromCommand('git commit -m "arggon handoff task-x"')).toBeUndefined();
    expect(parseArggonItemFromCommand("echo arggon show task-x")).toBeUndefined();
    expect(parseArggonItemFromCommand("cd repo && grep arggon show task-x")).toBeUndefined();
    expect(parseArggonItemFromCode('const cmd = "grep -rn \'arggon show task-x\' ."')).toBeUndefined();
    expect(
      parseArggonItemFromCode('await tools.shell({ command: \'echo "arggon update task-fake"\' })'),
    ).toBeUndefined();
  });

  it("still correlates command-position invocations (F2)", () => {
    expect(parseArggonItemFromCommand("ARGON_QUIET=1 arggon show task-x")).toBe("task-x");
    expect(parseArggonItemFromCommand("git status && arggon comment task-x 'note'")).toBe("task-x");
    expect(parseArggonItemFromCommand("pnpm run arggon -- show task-x")).toBe("task-x");
    expect(parseArggonItemFromCommand("yarn run arggon start task-x")).toBe("task-x");
    expect(
      parseArggonItemFromCode('await tools.shell({ command: "cd repo && arggon show task-x" })'),
    ).toBe("task-x");
  });

  it("keeps multi-word quoted spans one token (F1)", () => {
    // A quoted span is ONE word: bash runs a command named `arggon show
    // task-x` (127), `command`/`npm run` look that name up, and the bare
    // assignment executes nothing.
    expect(parseArggonItemFromCommand('"arggon show task-x"')).toBeUndefined();
    expect(parseArggonItemFromCommand('command "arggon show task-x"')).toBeUndefined();
    expect(parseArggonItemFromCommand('npm run "arggon show task-x"')).toBeUndefined();
    expect(parseArggonItemFromCommand('x="line1\narggon show task-x"')).toBeUndefined();
    // The miss side: the quotes close before the command word, so bash runs
    // arggon; splitting the assignment value used to hide it.
    expect(parseArggonItemFromCommand('x="a b" arggon show task-x')).toBe("task-x");
  });

  it("never reduces a whitespace-bearing span to its last segment (F1)", () => {
    // Bash runs a command literally named `echo /usr/bin/arggon` (127): the
    // fused span must stay one word, not collapse to `arggon` through the
    // last-path-segment rule.
    expect(parseArggonItemFromCommand('"echo /usr/bin/arggon" show task-x')).toBeUndefined();
    expect(parseArggonItemFromCommand('"cat /usr/bin/arggon" show task-x')).toBeUndefined();
    expect(parseArggonItemFromCommand('"vscode /home/u/bin/arggon" show task-x')).toBeUndefined();
    // A path-like span is one word too, but names the binary: bash execs
    // `/opt/my tools/arggon`.
    expect(parseArggonItemFromCommand('"/opt/my tools/arggon" show task-x')).toBe("task-x");
    // Same rule when the quoted span fuses after an unquoted prefix.
    expect(parseArggonItemFromCommand('my" tools/arggon" show task-x')).toBeUndefined();
    expect(parseArggonItemFromCommand('x" /usr/bin/arggon" show task-x')).toBeUndefined();
  });

  it("sees through wrapper prefixes and package runners (F1)", () => {
    expect(parseArggonItemFromCommand("npx arggon show task-x")).toBe("task-x");
    expect(parseArggonItemFromCommand("bunx arggon show task-x")).toBe("task-x");
    expect(parseArggonItemFromCommand("sudo arggon show task-x")).toBe("task-x");
    expect(parseArggonItemFromCommand("sudo -u root arggon update task-x --status in_progress")).toBe(
      "task-x",
    );
    expect(parseArggonItemFromCommand("env ARGON_QUIET=1 arggon show task-x")).toBe("task-x");
    expect(parseArggonItemFromCommand("env -i arggon show task-x")).toBe("task-x");
    expect(parseArggonItemFromCommand("command arggon show task-x")).toBe("task-x");
    expect(parseArggonItemFromCommand("time arggon show task-x")).toBe("task-x");
    expect(parseArggonItemFromCommand("time -p arggon show task-x")).toBe("task-x");
    expect(parseArggonItemFromCommand("npx --yes npm run arggon -- show task-x")).toBe("task-x");
    expect(parseArggonItemFromCommand("pnpm exec arggon show task-x")).toBe("task-x");
    expect(parseArggonItemFromCommand("yarn dlx arggon show task-x")).toBe("task-x");
  });

  it("follows command substitutions, subshells and newlines (F1)", () => {
    expect(parseArggonItemFromCommand("x=$(arggon show task-x)")).toBe("task-x");
    expect(parseArggonItemFromCommand('echo "$(arggon show task-x)"')).toBe("task-x");
    expect(parseArggonItemFromCommand("(arggon show task-x)")).toBe("task-x");
    expect(parseArggonItemFromCommand("(cd repo; arggon show task-x)")).toBe("task-x");
    expect(parseArggonItemFromCommand("echo $(echo $(arggon show task-x))")).toBe("task-x");
    expect(parseArggonItemFromCommand("cd repo\narggon show task-x")).toBe("task-x");
    expect(parseArggonItemFromCommand("arggon show task-x\narggon update task-y")).toBe("task-x");
  });

  it("keeps quoted separators and single-quoted substitutions inert (F2)", () => {
    expect(parseArggonItemFromCommand('echo "&& arggon show task-x"')).toBeUndefined();
    expect(parseArggonItemFromCommand("echo '; arggon show task-x'")).toBeUndefined();
    expect(parseArggonItemFromCommand('echo "(arggon show task-x)"')).toBeUndefined();
    expect(parseArggonItemFromCommand("echo '$(arggon show task-x)'")).toBeUndefined();
    expect(
      parseArggonItemFromCommand('echo "&& arggon show task-fake" && arggon show task-x'),
    ).toBe("task-x");
  });

  it("keeps escaped $() openers literal (F-A)", () => {
    // bash: `echo \$(arggon show task-x)` is a syntax error — nothing executes.
    expect(parseArggonItemFromCommand("echo \\$(arggon show task-x)")).toBeUndefined();
    expect(parseArggonItemFromCommand("\\$(arggon show task-x)")).toBeUndefined();
    expect(parseArggonItemFromCommand('echo "\\$(arggon show task-x)"')).toBeUndefined();
    // A literal backslash before the substitution leaves `$(` real, so it runs.
    expect(parseArggonItemFromCommand("echo \\\\$(arggon show task-x)")).toBe("task-x");
    expect(parseArggonItemFromCommand("echo $(arggon show task-x)")).toBe("task-x");
  });

  it("keeps a token starting with an escaped \\( a word (F2)", () => {
    // bash: an escaped `\(` is a literal `(` and the line syntax-errors on
    // the trailing `)` — nothing executes; the token is a word, not an opener.
    expect(parseArggonItemFromCommand("\\(arggon show task-x)")).toBeUndefined();
    expect(parseArggonItemFromCommand("X=1 \\(arggon show task-x)")).toBeUndefined();
    // A mid-token escaped `\(` is not a word: bash parses `X=a(b` as the
    // assignment and runs arggon.
    expect(parseArggonItemFromCommand("X=a\\(b arggon show task-x")).toBe("task-x");
    // Unescaped, the same form is a real subshell and runs arggon.
    expect(parseArggonItemFromCommand("(arggon show task-x)")).toBe("task-x");
  });

  it("keeps an escaped backslash before ( a syntax-error word (F3)", () => {
    // bash: `\\(arggon …` ends a word on the escaped backslash and
    // syntax-errors at the adjacent `(` (exit 2, nothing executes).
    expect(parseArggonItemFromCommand("\\\\(arggon show task-x)")).toBeUndefined();
    expect(parseArggonItemFromCommand("sudo \\\\(arggon show task-x)")).toBeUndefined();
    expect(parseArggonItemFromCommand("X=1 \\\\(arggon show task-x)")).toBeUndefined();
    expect(parseArggonItemFromCommand("echo \\\\(arggon show task-x)")).toBeUndefined();
    // The escaped backslash no longer hides a real `$(` substitution behind it.
    expect(parseArggonItemFromCommand("echo \\\\$(arggon show task-x)")).toBe("task-x");
  });

  it("marks escaped-backslash word starts and long backslash runs (review F2)", () => {
    // bash: a backslash at a word start is literal, so the word is a command
    // name, never arggon (`\\arggon` lookups exit 127), and any run before an
    // unescaped `(` syntax-errors (exit 2, nothing executes). The trailing `)`
    // is what makes the 3+ forms syntax errors; the head must not reduce.
    expect(parseArggonItemFromCommand("\\\\arggon show task-x")).toBeUndefined();
    expect(parseArggonItemFromCommand("\\\\\\arggon show task-x")).toBeUndefined();
    expect(parseArggonItemFromCommand("sudo \\\\arggon show task-x")).toBeUndefined();
    expect(parseArggonItemFromCommand("X=1 \\\\arggon show task-x")).toBeUndefined();
    expect(parseArggonItemFromCommand("\\\\\\(arggon show task-x)")).toBeUndefined();
    expect(parseArggonItemFromCommand("\\\\\\\\\\(arggon show task-x)")).toBeUndefined();
    expect(parseArggonItemFromCommand("\\\\\\\\\\\\\\(arggon show task-x)")).toBeUndefined();
    // Mid-token escaped backslashes stay assignment text: bash runs arggon.
    expect(parseArggonItemFromCommand("X=a\\\\b arggon show task-x")).toBe("task-x");
  });

  it("correlates literal #, !, glob chars and // in path words (review F1)", () => {
    // bash execs each of these paths (stub exit 0): `#`/`!` are literal inside
    // a word, a glob expansion still ends in the pattern's `/arggon` component,
    // and `//` collapses. Only word-level syntax — quotes, expansions,
    // grouping, redirection or whitespace — keeps a slash-bearing word from
    // being a path (F1 review of PR #358).
    expect(parseArggonItemFromCommand("dir#x/arggon show task-x")).toBe("task-x");
    expect(parseArggonItemFromCommand("'dir*x/arggon' show task-x")).toBe("task-x");
    expect(parseArggonItemFromCommand("dir!x/arggon show task-x")).toBe("task-x");
    expect(parseArggonItemFromCommand("a//b/arggon show task-x")).toBe("task-x");
    expect(parseArggonItemFromCommand("dir\\*x/arggon show task-x")).toBe("task-x");
    expect(parseArggonItemFromCommand("dir\\#x/arggon show task-x")).toBe("task-x");
    // Guards on the retained class: `x>arggon` redirects to a file named
    // arggon and runs `x`, escaped `;`/`|`/`&` form one literal command word,
    // escaped whitespace stays ambiguous and a trailing `/` cannot exec.
    expect(parseArggonItemFromCommand("x>arggon show task-x")).toBeUndefined();
    expect(parseArggonItemFromCommand("x<arggon show task-x")).toBeUndefined();
    expect(parseArggonItemFromCommand("x\\;arggon show task-x")).toBeUndefined();
    expect(parseArggonItemFromCommand("x\\|arggon show task-x")).toBeUndefined();
    expect(parseArggonItemFromCommand("x\\&arggon show task-x")).toBeUndefined();
    expect(parseArggonItemFromCommand("dir\\ x/arggon show task-x")).toBeUndefined();
    expect(parseArggonItemFromCommand("a/arggon/ show task-x")).toBeUndefined();
  });

  it("pins the documented group-following residual (review F3)", () => {
    // A bare `(` in argument position is a bash syntax error (exit 2, nothing
    // executes), but the parser still follows the `(…)` as a group. Known
    // miss-side residual, pinned so behavior and the docstring wording cannot
    // drift silently; a full command-position grammar is out of scope.
    expect(parseArggonItemFromCommand("\\\\( (arggon show task-x)")).toBe("task-x");
    expect(parseArggonItemFromCommand("echo (arggon show task-x)")).toBe("task-x");
    expect(parseArggonItemFromCommand("\\\\((arggon show task-x))")).toBe("task-x");
  });

  it("keeps quoted words that begin with shell syntax out of the path rule (F3)", () => {
    // bash: the quoted word IS the command name `(/usr/local/bin/arggon`
    // (exit 127), not a path that resolves to the binary.
    expect(parseArggonItemFromCommand("'(/usr/local/bin/arggon' show task-x")).toBeUndefined();
    expect(parseArggonItemFromCommand('"(/usr/local/bin/arggon" show task-x')).toBeUndefined();
    expect(parseArggonItemFromCommand("my'(/usr/bin/arggon' show task-x")).toBeUndefined();
    // Plain quoted paths and relative paths still name the binary.
    expect(parseArggonItemFromCommand("'/usr/local/bin/arggon' show task-x")).toBe("task-x");
    expect(parseArggonItemFromCommand("node_modules/.bin/arggon show task-x")).toBe("task-x");
  });

  it("does not read quoted or query forms as executions (F-B)", () => {
    expect(parseArggonItemFromCommand("command -v arggon show task-x")).toBeUndefined();
    expect(parseArggonItemFromCommand("command -V arggon show task-x")).toBeUndefined();
    expect(parseArggonItemFromCommand("command -pv arggon show task-x")).toBeUndefined();
    expect(parseArggonItemFromCommand('"(" arggon show task-x')).toBeUndefined();
    expect(parseArggonItemFromCommand("'(' arggon show task-x")).toBeUndefined();
    expect(parseArggonItemFromCommand('"$(" arggon show task-x')).toBeUndefined();
    expect(parseArggonItemFromCommand('"x=1" arggon show task-x')).toBeUndefined();
    // The executable neighbours of those forms stay recognized.
    expect(parseArggonItemFromCommand("command arggon show task-x")).toBe("task-x");
    expect(parseArggonItemFromCommand("command -p arggon show task-x")).toBe("task-x");
    expect(parseArggonItemFromCommand("command -- arggon show task-x")).toBe("task-x");
    expect(parseArggonItemFromCommand("( arggon show task-x)")).toBe("task-x");
    expect(parseArggonItemFromCommand("time ( arggon show task-x)")).toBe("task-x");
    expect(parseArggonItemFromCommand('"/usr/local/bin/arggon" show task-x')).toBe("task-x");
  });

  it("keeps token quote state like the segment splitter (F-C)", () => {
    // A `'` inside an open double quote is literal text: the assignment prefix
    // and the command after it still correlate (bash runs arggon).
    expect(parseArggonItemFromCommand(`x="it's" arggon show task-x`)).toBe("task-x");
    expect(parseArggonItemFromCommand(`VAR='say "hi"' arggon show task-x`)).toBe("task-x");
    // Mentions stay inert with either quote style.
    expect(parseArggonItemFromCommand(`echo "it's" arggon show task-x`)).toBeUndefined();
    expect(parseArggonItemFromCommand(`echo 'say "hi"' arggon show task-x`)).toBeUndefined();
  });

  it("caps substitution depth at MAX_SUBSTITUTION_DEPTH (F-D)", () => {
    const nested = (levels: number): string =>
      `${"echo $(".repeat(levels)}arggon show task-x${")".repeat(levels)}`;
    expect(parseArggonItemFromCommand(nested(1))).toBe("task-x");
    expect(parseArggonItemFromCommand(nested(MAX_SUBSTITUTION_DEPTH))).toBe("task-x");
    expect(parseArggonItemFromCommand(nested(MAX_SUBSTITUTION_DEPTH + 1))).toBeUndefined();
  });

  it("drops # comments outside quotes (F-D)", () => {
    expect(parseArggonItemFromCommand("# note && arggon show task-x")).toBeUndefined();
    expect(parseArggonItemFromCommand("arggon show task-x # arggon update task-y")).toBe("task-x");
    expect(parseArggonItemFromCommand("# arggon show task-x\narggon show task-y")).toBe("task-y");
    expect(parseArggonItemFromCommand("arggon show task-x#frag")).toBeUndefined();
    expect(parseArggonItemFromCommand('echo "text # more" && arggon show task-x')).toBe("task-x");
  });

  it("keeps a newline-bearing quoted span one inert token (F1/F-D)", () => {
    // The span (newline included) is a single word, so none of these can split
    // into a command-position `arggon`. Before F1 this test passed because the
    // newline split the span, not because the span stayed intact.
    expect(parseArggonItemFromCommand('echo "line1\narggon show task-x"')).toBeUndefined();
    expect(parseArggonItemFromCommand('"line1\narggon show task-x"')).toBeUndefined();
    expect(parseArggonItemFromCommand('x="line1\narggon show task-x"')).toBeUndefined();
    expect(parseArggonItemFromCommand('arggon comment task-x "line1\nline2"')).toBe("task-x");
  });

  it("eats wrapper value options (F-D)", () => {
    expect(parseArggonItemFromCommand("env -u FOO arggon show task-x")).toBe("task-x");
    expect(parseArggonItemFromCommand("env --unset FOO arggon show task-x")).toBe("task-x");
    expect(parseArggonItemFromCommand("time -o /tmp/time.txt arggon show task-x")).toBe("task-x");
    expect(parseArggonItemFromCommand("time -f %e arggon show task-x")).toBe("task-x");
  });

  it("does not confuse wrapper-prefixed non-arggon commands (F1)", () => {
    expect(parseArggonItemFromCommand('sudo echo "arggon show task-x"')).toBeUndefined();
    expect(parseArggonItemFromCommand("time grep arggon show task-x")).toBeUndefined();
    expect(parseArggonItemFromCommand('npx grep -rn "arggon show task-x" .')).toBeUndefined();
  });

  it("parses Code Mode MCP calls and embedded shell commands", () => {
    expect(
      parseArggonItemFromCode('return await tools.arggon.arggon_update({ id: "task-x", status: "in_progress" })'),
    ).toBe("task-x");
    expect(parseArggonItemFromCode("return await tools.arggon.arggon_show({ id: 'bug-y' })")).toBe("bug-y");
    expect(parseArggonItemFromCode("await tools.arggon.arggon_comment({id: `task-z`, text: 'hi'})")).toBe("task-z");
    expect(parseArggonItemFromCode('return await tools.shell({ command: "arggon show task-cli" })')).toBe(
      "task-cli",
    );
    expect(
      parseArggonItemFromCode('return await tools.shell({ command: "npx arggon show task-wrapped" })'),
    ).toBe("task-wrapped");
  });

  it("parses native Code Mode tool calls (W3: tools.arggon.<name>)", () => {
    expect(
      parseArggonItemFromCode(
        'return await tools.arggon.update({ id: "task-native", status: "in_progress" })',
      ),
    ).toBe("task-native");
    expect(parseArggonItemFromCode("await tools.arggon.show({ id: 'bug-native' })")).toBe("bug-native");
    expect(parseArggonItemFromCode("tools.arggon.comment({ id: `task-native-z`, text: 'hi' })")).toBe(
      "task-native-z",
    );
    expect(
      parseArggonItemFromCode('await tools.arggon.handoff({ id: "task-native-h", next: "keep going" })'),
    ).toBe("task-native-h");
    expect(parseArggonItemFromCode('await tools.arggon.start({ id: "task-native-s" })')).toBe(
      "task-native-s",
    );
    // Reads without an item argument never correlate.
    expect(parseArggonItemFromCode("return await tools.arggon.next({})")).toBeUndefined();
    expect(parseArggonItemFromCode("return await tools.arggon.report({ trend: true })")).toBeUndefined();
    expect(parseArggonItemFromCode("return await tools.arggon.update({ status: 'todo' })")).toBeUndefined();
    // MCP and native spellings coexist while the conditional adapter exists.
    expect(parseArggonItemFromCode('tools.arggon.arggon_show({ id: "task-mcp" })')).toBe("task-mcp");
  });

  it("does not invent an item for unrelated Code Mode calls", () => {
    expect(parseArggonItemFromCode("return await tools.arggon.arggon_next({})")).toBeUndefined();
    expect(parseArggonItemFromCode('return await tools.arggon.arggon_update({ status: "in_progress" })')).toBeUndefined();
    expect(parseArggonItemFromCode("return await tools.read({ path: 'README.md' })")).toBeUndefined();
    expect(parseArggonItemFromCode("const cmd = 'echo \"&& arggon show task-x\"';")).toBeUndefined();
  });

  it("parses observed tool executions by tool name", () => {
    expect(parseArggonItemFromTool("shell", { command: "arggon show task-x --json" })).toBe("task-x");
    expect(parseArggonItemFromTool("arggon_update", { id: "task-x", status: "in_progress" })).toBe("task-x");
    expect(parseArggonItemFromTool("arggon.arggon_handoff", { id: "task-x" })).toBe("task-x");
    // Native tool names as the runtime may report them (W3).
    expect(parseArggonItemFromTool("arggon.update", { id: "task-native" })).toBe("task-native");
    expect(parseArggonItemFromTool("tools.arggon.show", { id: "task-native" })).toBe("task-native");
    expect(parseArggonItemFromTool("execute", { code: 'await tools.arggon.arggon_start({ id: "task-x" })' })).toBe(
      "task-x",
    );
    expect(parseArggonItemFromTool("read", { path: "tasks/task-x.md" })).toBeUndefined();
    expect(parseArggonItemFromTool(undefined, { id: "task-x" })).toBeUndefined();
  });

  it("accepts path-safe ids only", () => {
    expect(isArggonItemId("task-x")).toBe(true);
    expect(isArggonItemId("bug-login-500")).toBe(true);
    expect(isArggonItemId("--json")).toBe(false);
    expect(isArggonItemId("-q")).toBe(false);
    expect(isArggonItemId("")).toBe(false);
    expect(isArggonItemId("../etc/passwd")).toBe(false);
    expect(isArggonItemId(42)).toBe(false);
  });
});

describe("plugin-context: branch fallback", () => {
  it("maps feat/<id> and fix/<id> only", () => {
    expect(itemIdFromBranch("feat/task-x")).toBe("task-x");
    expect(itemIdFromBranch("fix/bug-login-500")).toBe("bug-login-500");
    expect(itemIdFromBranch("master")).toBeUndefined();
    expect(itemIdFromBranch("feature/task-x")).toBeUndefined();
    expect(itemIdFromBranch("docs/task-x")).toBeUndefined();
    expect(itemIdFromBranch("feat/")).toBeUndefined();
    expect(itemIdFromBranch(undefined)).toBeUndefined();
  });
});

describe("plugin-context: commit hygiene detection", () => {
  it("detects git commit invocations", () => {
    expect(looksLikeCommitCommand('git commit -m "x"')).toBe(true);
    expect(looksLikeCommitCommand("git add -A && git commit --amend --no-edit")).toBe(true);
    expect(looksLikeCommitCommand("git -c user.name=x commit -m y")).toBe(true);
    expect(looksLikeCommitCommand("cd repo; /usr/bin/git commit")).toBe(true);
    expect(looksLikeCommitCommand("git status")).toBe(false);
    expect(looksLikeCommitCommand("npm test")).toBe(false);
    expect(looksLikeCommitCommand(undefined)).toBe(false);
  });

  it("formats validate failures without inventing success", () => {
    expect(parseValidateFailure('{"ok":true,"errors":[]}')).toBeUndefined();
    expect(parseValidateFailure("not json")).toBeUndefined();
    expect(
      parseValidateFailure(
        '{"ok":false,"errors":[{"message":"unknown status \'nope\'"},{"message":"second"}]}',
      ),
    ).toBe("2 error(s); first: unknown status 'nope'");
    expect(parseValidateFailure('{"ok":false}')).toBe("0 error(s)");
  });
});

describe("plugin-context: bounded item block", () => {
  const item = {
    id: "task-smoke-item",
    type: "task",
    status: "in_progress",
    title: "Smoke item",
    parent: "smoke-story",
    branch: "feat/task-smoke-item",
    assignee: "smoke",
    priority: "p3",
    labels: ["smoke"],
    worktree_path: "/tmp/worktrees/task-smoke-item",
  };

  it("renders the compact show shape as an advisory block", () => {
    const block = buildItemBlock(item, { currentDirectory: "/tmp/elsewhere" });
    expect(block.text.startsWith("<arggon-item>\n")).toBe(true);
    expect(block.text).toContain("id: task-smoke-item");
    expect(block.text).toContain("status: in_progress");
    expect(block.text).toContain("title: Smoke item");
    expect(block.text).toContain("parent: smoke-story");
    expect(block.text).toContain("branch: feat/task-smoke-item");
    expect(block.text).toContain("worktree: /tmp/worktrees/task-smoke-item (session_move available)");
    expect(block.text.trimEnd().endsWith("</arggon-item>")).toBe(true);
    expect(block.bytes).toBe(byteLength(block.text));
    expect(block.truncated).toBe(false);
    expect(block.bytes).toBeLessThanOrEqual(ITEM_BLOCK_MAX_BYTES);
  });

  it("omits the worktree hint when the session is already there", () => {
    const block = buildItemBlock(item, { currentDirectory: "/tmp/worktrees/task-smoke-item" });
    expect(block.text).not.toContain("worktree:");
    expect(block.text).not.toContain("session_move");
  });

  it("clips per-field values and stays within the byte bound for a long title", () => {
    const clipped = buildItemBlock({ ...item, title: "x".repeat(5000), labels: Array.from({ length: 50 }, (_, i) => `label-${i}`) });
    expect(clipped.truncated).toBe(false);
    expect(clipped.bytes).toBeLessThanOrEqual(ITEM_BLOCK_MAX_BYTES);
    expect(clipped.text).toContain("…");
    expect(clipped.text.length).toBeLessThan(5000);
  });

  it("truncates a block built from many long fields", () => {
    const long = "y".repeat(400);
    const huge = {
      id: long,
      type: long,
      status: long,
      title: long,
      parent: long,
      branch: long,
      assignee: long,
      priority: long,
      labels: [long],
      worktree_path: long,
    };
    const block = buildItemBlock(huge);
    expect(block.truncated).toBe(true);
    expect(block.bytes).toBeLessThanOrEqual(ITEM_BLOCK_MAX_BYTES);
  });

  it("bounds arbitrary text on a line boundary", () => {
    const bounded = boundText(["<arggon-item>", "a".repeat(2000), "</arggon-item>"].join("\n"), 128);
    expect(bounded.truncated).toBe(true);
    expect(bounded.bytes).toBeLessThanOrEqual(128);
    expect(bounded.text.endsWith("… (truncated)")).toBe(true);
    expect(boundText("short", 128).truncated).toBe(false);
  });

  it("never overshoots the byte bound when cutting a multibyte line (F3)", () => {
    const bounded = boundText("あ".repeat(100), 20);
    expect(bounded.truncated).toBe(true);
    expect(bounded.bytes).toBe(byteLength(bounded.text));
    expect(bounded.bytes).toBeLessThanOrEqual(20);
    expect(bounded.text.startsWith("あ")).toBe(true);
    expect(bounded.text.endsWith("… (truncated)")).toBe(true);
  });

  it("returns an empty truncated block when the bound cannot fit the marker (F3)", () => {
    const bounded = boundText("anything", 4);
    expect(bounded.truncated).toBe(true);
    expect(bounded.bytes).toBe(0);
    expect(bounded.text).toBe("");
  });
});

describe("plugin-context: bounded caches", () => {
  it("keys cached item views by project directory and id (F5)", () => {
    expect(itemCacheKey("/p/a", "task-x")).not.toBe(itemCacheKey("/p/b", "task-x"));
    expect(itemCacheKey("/p/a", "task-x")).toBe(itemCacheKey("/p/a", "task-x"));
  });

  it("evicts the oldest entries beyond the bound (F5)", () => {
    const map = new Map<string, number>();
    setBounded(map, "a", 1, 2);
    setBounded(map, "b", 2, 2);
    setBounded(map, "c", 3, 2);
    expect([...map.keys()]).toEqual(["b", "c"]);
    setBounded(map, "b", 22, 2); // re-insert refreshes recency
    setBounded(map, "d", 4, 2);
    expect([...map.entries()]).toEqual([
      ["b", 22],
      ["d", 4],
    ]);
  });

  it("keeps the default bound finite for long-lived servers (F5)", () => {
    const map = new Map<string, number>();
    for (let i = 0; i < CACHE_MAX_ENTRIES + 10; i += 1) setBounded(map, `k${i}`, i);
    expect(map.size).toBe(CACHE_MAX_ENTRIES);
    expect(map.has("k0")).toBe(false);
  });
});

describe("plugin-context: storage guard order", () => {
  function fakeContext(directory: string): {
    writes: Array<[string, unknown]>;
    ctx: Parameters<typeof onToolAfter>[0];
  } {
    const writes: Array<[string, unknown]> = [];
    const ctx: Parameters<typeof onToolAfter>[0] = {
      location: { directory },
      storage: {
        get: async () => undefined,
        set: async (key, value) => {
          writes.push([key, value]);
        },
        remove: async () => undefined,
      },
    };
    return { writes, ctx };
  }

  it("writes nothing when the tree has no tracker root (F4)", async () => {
    const directory = mkdtempSync(join(tmpdir(), "arggon-guard-outside-"));
    try {
      const { writes, ctx } = fakeContext(directory);
      await onToolAfter(ctx, {
        status: "completed",
        sessionID: "ses-guard",
        tool: "shell",
        input: { command: "arggon show task-x" },
      });
      expect(writes).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("correlates an observed invocation once the v5 ArggonManager/ root exists (F4)", async () => {
    const directory = mkdtempSync(join(tmpdir(), "arggon-guard-inside-v5-"));
    try {
      mkdirSync(join(directory, "ArggonManager"));
      const { writes, ctx } = fakeContext(directory);
      await onToolAfter(ctx, {
        status: "completed",
        sessionID: "ses-guard",
        tool: "shell",
        input: { command: "arggon show task-x" },
      });
      expect(writes).toEqual([["arggon/session/ses-guard", "task-x"]]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("correlates an observed invocation on a legacy tasks/ tree too (F4)", async () => {
    const directory = mkdtempSync(join(tmpdir(), "arggon-guard-inside-legacy-"));
    try {
      mkdirSync(join(directory, "tasks"));
      const { writes, ctx } = fakeContext(directory);
      await onToolAfter(ctx, {
        status: "completed",
        sessionID: "ses-guard",
        tool: "shell",
        input: { command: "arggon show task-x" },
      });
      expect(writes).toEqual([["arggon/session/ses-guard", "task-x"]]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("plugin-context: worktree wiring (W4)", () => {
  it("resolves the project id, canonical checkout and domain from the context", () => {
    const domain = { create: async () => ({ directory: "/tmp/wt" }) };
    expect(
      worktreeOptions({
        location: { project: { id: "project-id", canonical: "/repo" } },
        worktree: domain,
      }),
    ).toEqual({ projectID: "project-id", canonical: "/repo", domain });
  });

  it("stays empty without the V2 surfaces (the worktree tools fail typed)", () => {
    expect(worktreeOptions({})).toEqual({});
    expect(worktreeOptions({ location: { project: { id: "  ", canonical: null } } })).toEqual({});
    // A domain without a project id is not usable: every domain op requires it.
    expect(worktreeOptions({ worktree: { create: async () => ({}) } })).toEqual({
      domain: { create: expect.any(Function) },
    });
  });
});

describe("plugin-context: session directory wiring (bug-native-tools-commit-to-primary-checkout)", () => {
  it("reads the calling session's own location directory", async () => {
    const resolve = sessionDirectoryResolver({
      session: { get: async () => ({ location: { directory: "/worktrees/repo-task-x" } }) },
    } as never);
    expect(resolve).toBeDefined();
    expect(await (resolve as (id: string) => Promise<string | undefined>)("ses_a")).toBe(
      "/worktrees/repo-task-x",
    );
  });

  it("falls back to a bare directory field and ignores a non-string one", async () => {
    const bare = sessionDirectoryResolver({
      session: { get: async () => ({ directory: "/plain/checkout" }) },
    } as never);
    expect(await (bare as (id: string) => Promise<string | undefined>)("ses_a")).toBe(
      "/plain/checkout",
    );
    const blank = sessionDirectoryResolver({
      session: { get: async () => ({ location: { directory: "  " }, directory: 7 }) },
    } as never);
    expect(await (blank as (id: string) => Promise<string | undefined>)("ses_a")).toBeUndefined();
  });

  it("stays feature-detected: no ctx.session.get means no resolver (the pre-fix behavior)", () => {
    expect(sessionDirectoryResolver({})).toBeUndefined();
    expect(sessionDirectoryResolver({ session: {} } as never)).toBeUndefined();
    expect(
      sessionDirectoryResolver({ session: { get: "not a function" } } as never),
    ).toBeUndefined();
  });

  it("passes the requested session id through and propagates a lookup failure", async () => {
    const seen: string[] = [];
    const resolve = sessionDirectoryResolver({
      session: {
        get: async (input: { sessionID: string }) => {
          seen.push(input.sessionID);
          if (input.sessionID === "ses_boom") throw new Error("session store unavailable");
          return { location: { directory: "/plain/checkout" } };
        },
      },
    } as never) as (id: string) => Promise<string | undefined>;
    expect(await resolve("ses_ok")).toBe("/plain/checkout");
    expect(seen).toEqual(["ses_ok"]);
    // The throw reaches resolveToolCwd, which turns it into a refusal rather
    // than a silent fallback to the plugin location.
    await expect(resolve("ses_boom")).rejects.toThrow("session store unavailable");
  });
});

// ---------------------------------------------------------------------------
// T4 (plan-methodology-adapters-017, spec S4): the prompt-admission stamp and
// the compaction retention. The rewrite contract is what these tests pin: the
// `prompt` hook may write admission metadata and nothing else, the `compaction`
// hook may re-inject the item block and never record the compaction itself.
// The runtime load (a real hook firing on a real host) is the model-free
// `npm run smoke:opencode-prompt-stamp` evidence.
// ---------------------------------------------------------------------------

/** A worktree identity as `arggon start --worktree` declares it in `.arggon.env`. */
const IDENTITY = {
  worktreePath: "/w/repo-task-stamp",
  worktreeId: "repo-task-stamp",
  item: "task-stamp",
  branch: "feat/task-stamp",
  stateDir: "/state/repo-task-stamp",
  cacheDir: "/cache/repo-task-stamp",
  source: "/w/repo-task-stamp/.arggon.env",
};

describe("plugin-context: admission stamp construction", () => {
  it("carries the env contract's declared values and names the file as its source", () => {
    expect(buildAdmissionStamp(IDENTITY)).toEqual({
      item: "task-stamp",
      branch: "feat/task-stamp",
      worktreePath: "/w/repo-task-stamp",
      worktreeId: "repo-task-stamp",
      source: "/w/repo-task-stamp/.arggon.env",
    });
  });

  it("stays silent when nothing declares an item or a branch", () => {
    expect(buildAdmissionStamp(undefined)).toBeUndefined();
    // State/cache dirs alone are not an identity: that is a plain checkout.
    expect(
      buildAdmissionStamp({
        stateDir: "/state/x",
        cacheDir: "/cache/x",
        source: "process.env",
      }),
    ).toBeUndefined();
  });

  it("keeps a partial declaration and drops nothing it was given", () => {
    expect(buildAdmissionStamp({ item: "task-only", source: "process.env" })).toEqual({
      item: "task-only",
      source: "process.env",
    });
    expect(buildAdmissionStamp({ branch: "fix/task-b", source: "/w/.arggon.env" })).toEqual({
      branch: "fix/task-b",
      source: "/w/.arggon.env",
    });
  });

  it("clips values and drops the least load-bearing fields to respect the byte bound", () => {
    const long = "z".repeat(400);
    const stamp = buildAdmissionStamp({
      ...IDENTITY,
      item: long,
      branch: long,
      worktreePath: long,
      worktreeId: long,
      source: long,
    });
    expect(stamp).toBeDefined();
    for (const value of Object.values(stamp ?? {})) {
      expect(typeof value).toBe("string");
    }
    // The bound is the contract, not an aspiration.
    expect(JSON.stringify(stamp).length).toBeLessThanOrEqual(ADMISSION_STAMP_MAX_BYTES);
    // The identity survives: a stamp without an item or a branch is not a stamp.
    expect(stamp?.item ?? stamp?.branch).toBeDefined();
    expect(stamp?.source).toBeDefined();
    // The worktree coordinates are the first thing dropped.
    expect(stamp?.worktreeId).toBeUndefined();
  });

  it("maps the correlation chain onto the same stamp shape", () => {
    expect(admissionStampFromResolution({ id: "task-branch", source: "branch" })).toEqual({
      item: "task-branch",
      source: "branch",
    });
    expect(admissionStampFromResolution({ id: "task-env", source: "env" })).toEqual({
      item: "task-env",
      source: "env",
    });
    expect(admissionStampFromResolution({ id: "task-storage", source: "storage" })).toEqual({
      item: "task-storage",
      source: "storage",
    });
    expect(admissionStampFromResolution(undefined)).toBeUndefined();
  });
});

describe("plugin-context: prompt hook rewrite contract", () => {
  /** An admission draft in the shape V2 hands the hook (observed on 2.0.26). */
  function draft(): Record<string, unknown> {
    return {
      sessionID: "ses_stamp",
      messageID: "msg_stamp",
      prompt: {
        text: "please implement the stamp",
        files: [{ uri: "file:///repo/a.txt" }],
        agents: [{ id: "build" }],
        skills: [{ id: "arggon-cli" }],
      },
      delivery: "steer",
    };
  }

  it("writes only metadata.arggon and leaves the submitted prompt byte-identical", () => {
    const event = draft();
    const before = structuredClone(event);
    const applied = applyAdmissionStamp(event, buildAdmissionStamp(IDENTITY));
    expect(applied?.item).toBe("task-stamp");
    expect(event.metadata).toEqual({ [ADMISSION_STAMP_KEY]: applied });
    // Everything else the host handed over is untouched, by value.
    expect(event.prompt).toEqual(before.prompt);
    expect(event.delivery).toBe(before.delivery);
    expect(event.sessionID).toBe(before.sessionID);
    expect(event.messageID).toBe(before.messageID);
  });

  it("merges into metadata the caller already set and never replaces it", () => {
    const event = { ...draft(), metadata: { source: "api", keep: 1 } };
    applyAdmissionStamp(event, buildAdmissionStamp(IDENTITY));
    expect(event.metadata).toMatchObject({ source: "api", keep: 1 });
    expect((event.metadata as Record<string, unknown>)[ADMISSION_STAMP_KEY]).toMatchObject({
      item: "task-stamp",
    });
  });

  it("overwrites a previous stamp instead of accumulating one per prompt", () => {
    const event = draft();
    const first = applyAdmissionStamp(event, buildAdmissionStamp(IDENTITY));
    const second = applyAdmissionStamp(event, {
      item: "task-other",
      branch: "feat/task-other",
      source: "branch",
    });
    expect(first?.item).toBe("task-stamp");
    expect(second?.item).toBe("task-other");
    expect(Object.keys(event.metadata as Record<string, unknown>)).toEqual([ADMISSION_STAMP_KEY]);
    expect((event.metadata as Record<string, unknown>)[ADMISSION_STAMP_KEY]).toEqual(second);
  });

  it("creates no metadata object at all when there is nothing to stamp", () => {
    const event = draft();
    expect(applyAdmissionStamp(event, undefined)).toBeUndefined();
    expect("metadata" in event).toBe(false);
    expect(event).toEqual(draft());
  });

  it("survives a host that hands over a non-object metadata value", () => {
    const event = { ...draft(), metadata: "not-an-object" };
    applyAdmissionStamp(event, buildAdmissionStamp(IDENTITY));
    expect(event.metadata).toMatchObject({ [ADMISSION_STAMP_KEY]: { item: "task-stamp" } });
  });

  it("never rewrites the delivery mode or the prompt contents (contract, not convention)", () => {
    const event = draft();
    const before = structuredClone(event.prompt);
    applyAdmissionStamp(event, buildAdmissionStamp(IDENTITY));
    expect(structuredClone(event.prompt)).toEqual(before);
    expect(event.delivery).toBe("steer");
    // No key outside the documented draft shape is ever introduced.
    expect(Object.keys(event).sort()).toEqual(
      ["delivery", "messageID", "metadata", "prompt", "sessionID"].sort(),
    );
  });
});

describe("plugin-context: prompt hook guard order (T4)", () => {
  function context(directory: string): Parameters<typeof onPromptAdmission>[0] {
    return {
      location: { directory },
      storage: { get: async () => undefined, set: async () => undefined, remove: async () => undefined },
      vcs: { get: async () => ({ data: { branch: "feat/task-stamp" } }) },
    };
  }

  it("stamps from the worktree env contract at the session directory", async () => {
    const directory = mkdtempSync(join(tmpdir(), "arggon-stamp-env-"));
    try {
      mkdirSync(join(directory, "ArggonManager"));
      writeFileSync(
        join(directory, ".arggon.env"),
        [
          "ARGON_ITEM=task-stamp",
          "ARGGON_WORKTREE_ID=repo-task-stamp",
          `ARGGON_WORKTREE_PATH=${directory}`,
          "ARGGON_WORKTREE_BRANCH=feat/task-stamp",
          "ARGGON_STATE_DIR=/state/repo-task-stamp",
          "ARGGON_CACHE_DIR=/cache/repo-task-stamp",
          "",
        ].join("\n"),
        "utf8",
      );
      const event: Record<string, unknown> = { sessionID: "ses_env", prompt: { text: "go" } };
      await onPromptAdmission(context(directory), event);
      expect(event.metadata).toEqual({
        [ADMISSION_STAMP_KEY]: {
          item: "task-stamp",
          branch: "feat/task-stamp",
          worktreePath: directory,
          worktreeId: "repo-task-stamp",
          source: join(directory, ".arggon.env"),
        },
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("falls back to the branch when no env contract declares anything", async () => {
    const directory = mkdtempSync(join(tmpdir(), "arggon-stamp-branch-"));
    try {
      mkdirSync(join(directory, "ArggonManager"));
      const event: Record<string, unknown> = { sessionID: "ses_branch", prompt: { text: "go" } };
      await onPromptAdmission(context(directory), event);
      expect(event.metadata).toEqual({
        [ADMISSION_STAMP_KEY]: { item: "task-stamp", source: "branch" },
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("is silent outside a tracker tree and when nothing resolves", async () => {
    const outside = mkdtempSync(join(tmpdir(), "arggon-stamp-outside-"));
    const inside = mkdtempSync(join(tmpdir(), "arggon-stamp-empty-"));
    try {
      const event: Record<string, unknown> = { sessionID: "ses_out", prompt: { text: "go" } };
      await onPromptAdmission(context(outside), event);
      expect("metadata" in event).toBe(false);

      mkdirSync(join(inside, "ArggonManager"));
      const bare: Parameters<typeof onPromptAdmission>[0] = {
        location: { directory: inside },
        storage: { get: async () => undefined, set: async () => undefined, remove: async () => undefined },
        vcs: { get: async () => ({ data: { branch: "main" } }) },
      };
      const second: Record<string, unknown> = { sessionID: "ses_plain", prompt: { text: "go" } };
      await onPromptAdmission(bare, second);
      expect("metadata" in second).toBe(false);
    } finally {
      rmSync(outside, { recursive: true, force: true });
      rmSync(inside, { recursive: true, force: true });
    }
  });

  it("never throws on a bare or hostile context (failure isolation)", async () => {
    await expect(onPromptAdmission({} as never, { sessionID: "ses_x" })).resolves.toBeUndefined();
    await expect(
      onPromptAdmission(
        {
          location: { directory: 7 },
          session: { get: async () => undefined },
        } as never,
        {},
      ),
    ).resolves.toBeUndefined();
  });
});

describe("plugin-context: compaction retention (T4)", () => {
  function context(directory: string): Parameters<typeof onCompaction>[0] {
    return {
      location: { directory },
      storage: { get: async () => undefined, set: async () => undefined, remove: async () => undefined },
      vcs: { get: async () => ({ data: { branch: "feat/task-stamp" } }) },
    };
  }

  const ITEM = {
    id: "task-stamp",
    type: "task",
    status: "in_progress",
    title: "Stamp",
    parent: "story-stamp",
    branch: "feat/task-stamp",
    assignee: "arggon-maker",
  };

  /**
   * A stub `arggon` on PATH answering `show <id> --meta --json` with the
   * documented envelope, so the retention path's own view of the item is
   * deterministic instead of depending on a binary the test machine may lack
   * (the same in-process fake-CLI pattern `tools.test.ts` uses for `gh`).
   */
  function stubArgonShow(item: Record<string, unknown>): () => void {
    const binDir = join(mkdtempSync(join(tmpdir(), "arggon-stub-bin-")), "bin");
    mkdirSync(binDir, { recursive: true });
    const shim = join(binDir, "arggon");
    const payload = JSON.stringify({ ok: true, schemaVersion: 1, command: "show", item });
    writeFileSync(
      shim,
      [
        "#!/bin/sh",
        'case "$1" in',
        "  show)",
        `    printf '%s' '${payload.replaceAll("'", "'\\''")}'`,
        "    ;;",
        "  *) exit 1 ;;",
        "esac",
        "",
      ].join("\n"),
      "utf8",
    );
    chmodSync(shim, 0o755);
    const original = process.env.PATH ?? "";
    process.env.PATH = `${binDir}:${original}`;
    return () => {
      process.env.PATH = original;
    };
  }

  /** `needsCompactionRetention` only decides; the part itself is this helper. */
  it("retains the item block as exactly one system part", () => {
    const block = buildItemBlock(ITEM);
    const part = compactionRetentionPart(block.text);
    expect(part).toEqual({ type: "text", text: block.text });
    expect(part.text).toContain("<arggon-item>");
    expect(part.text).toContain("id: task-stamp");
    expect(part.text.length).toBeLessThanOrEqual(ITEM_BLOCK_MAX_BYTES);
  });

  it("needs retention only for a clean system array with no recorded result", () => {
    expect(needsCompactionRetention([{ type: "text", text: "harness" }])).toBe(true);
    // Already retained: a second compaction must not stack a duplicate.
    expect(needsCompactionRetention([{ type: "text", text: buildItemBlock(ITEM).text }])).toBe(false);
    // Another plugin recorded the compaction itself: no model call to retain for.
    expect(needsCompactionRetention([{ type: "text", text: "harness" }], { summary: "…" })).toBe(false);
    expect(needsCompactionRetention(undefined)).toBe(false);
    expect(needsCompactionRetention("not-an-array")).toBe(false);
  });

  it("injects the block into a compaction request and leaves result unset", async () => {
    const directory = mkdtempSync(join(tmpdir(), "arggon-compact-"));
    const restore = stubArgonShow(ITEM);
    try {
      mkdirSync(join(directory, "ArggonManager"));
      const system: unknown[] = [{ type: "text", text: "harness instructions" }];
      const event: Record<string, unknown> = {
        sessionID: "ses_compact",
        system,
        messages: [{ id: "msg_1", role: "user", content: [{ type: "text", text: "go" }] }],
      };
      await onCompaction(context(directory), event);
      const injected = system.filter(
        (part) =>
          typeof (part as { text?: unknown }).text === "string" &&
          ((part as { text: string }).text as string).includes("<arggon-item>"),
      );
      expect(injected).toHaveLength(1);
      expect((injected[0] as { text: string }).text).toContain("id: task-stamp");
      // The model still writes the summary: the hook never records it.
      expect(event.result).toBeUndefined();
      expect(event.messages).toHaveLength(1);
    } finally {
      restore();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("does not stack a second block when a compaction request is re-offered", async () => {
    const directory = mkdtempSync(join(tmpdir(), "arggon-compact-twice-"));
    const restore = stubArgonShow(ITEM);
    try {
      mkdirSync(join(directory, "ArggonManager"));
      const system: unknown[] = [{ type: "text", text: "harness instructions" }];
      const event: Record<string, unknown> = { sessionID: "ses_twice", system, messages: [] };
      await onCompaction(context(directory), event);
      await onCompaction(context(directory), event);
      expect(
        system.filter((part) =>
          ((part as { text?: string }).text ?? "").includes("<arggon-item>"),
        ),
      ).toHaveLength(1);
    } finally {
      restore();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("is silent outside a tracker tree, with a recorded result, or on a non-array system", async () => {
    const outside = mkdtempSync(join(tmpdir(), "arggon-compact-outside-"));
    const inside = mkdtempSync(join(tmpdir(), "arggon-compact-guard-"));
    try {
      mkdirSync(join(inside, "ArggonManager"));
      const outsideEvent: Record<string, unknown> = { sessionID: "ses_a", system: [] };
      await onCompaction(context(outside), outsideEvent);
      expect(outsideEvent.system).toEqual([]);

      const recordedEvent: Record<string, unknown> = {
        sessionID: "ses_b",
        system: [],
        result: { summary: "already written" },
      };
      await onCompaction(context(inside), recordedEvent);
      expect(recordedEvent.system).toEqual([]);
      expect(recordedEvent.result).toEqual({ summary: "already written" });

      const noSystem: Record<string, unknown> = { sessionID: "ses_c", system: undefined };
      await expect(onCompaction(context(inside), noSystem)).resolves.toBeUndefined();
      expect(noSystem.system).toBeUndefined();
    } finally {
      rmSync(outside, { recursive: true, force: true });
      rmSync(inside, { recursive: true, force: true });
    }
  });
});
