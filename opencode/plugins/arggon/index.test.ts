import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CACHE_MAX_ENTRIES,
  ITEM_BLOCK_MAX_BYTES,
  MAX_SUBSTITUTION_DEPTH,
  boundText,
  buildItemBlock,
  isArggonItemId,
  itemCacheKey,
  itemIdFromBranch,
  looksLikeCommitCommand,
  onToolAfter,
  parseArggonItemFromCode,
  parseArggonItemFromCommand,
  parseArggonItemFromTool,
  parseValidateFailure,
  setBounded,
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
    expect(parseArggonItemFromCommand("arggon show task-smoke-item --json")).toBe(
      "task-smoke-item",
    );
    expect(parseArggonItemFromCommand("npm run arggon -- update task-x --status in_progress")).toBe(
      "task-x",
    );
    expect(
      parseArggonItemFromCommand("cd repo && /usr/local/bin/arggon comment bug-login-500 'note'"),
    ).toBe("bug-login-500");
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
    expect(
      parseArggonItemFromCode("const cmd = \"grep -rn 'arggon show task-x' .\""),
    ).toBeUndefined();
    expect(
      parseArggonItemFromCode("await tools.shell({ command: 'echo \"arggon update task-fake\"' })"),
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
    expect(
      parseArggonItemFromCommand("sudo -u root arggon update task-x --status in_progress"),
    ).toBe("task-x");
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
      parseArggonItemFromCode(
        'return await tools.arggon.arggon_update({ id: "task-x", status: "in_progress" })',
      ),
    ).toBe("task-x");
    expect(parseArggonItemFromCode("return await tools.arggon.arggon_show({ id: 'bug-y' })")).toBe(
      "bug-y",
    );
    expect(
      parseArggonItemFromCode("await tools.arggon.arggon_comment({id: `task-z`, text: 'hi'})"),
    ).toBe("task-z");
    expect(
      parseArggonItemFromCode('return await tools.shell({ command: "arggon show task-cli" })'),
    ).toBe("task-cli");
    expect(
      parseArggonItemFromCode(
        'return await tools.shell({ command: "npx arggon show task-wrapped" })',
      ),
    ).toBe("task-wrapped");
  });

  it("does not invent an item for unrelated Code Mode calls", () => {
    expect(parseArggonItemFromCode("return await tools.arggon.arggon_next({})")).toBeUndefined();
    expect(
      parseArggonItemFromCode('return await tools.arggon.arggon_update({ status: "in_progress" })'),
    ).toBeUndefined();
    expect(
      parseArggonItemFromCode("return await tools.read({ path: 'README.md' })"),
    ).toBeUndefined();
    expect(
      parseArggonItemFromCode("const cmd = 'echo \"&& arggon show task-x\"';"),
    ).toBeUndefined();
  });

  it("parses observed tool executions by tool name", () => {
    expect(parseArggonItemFromTool("shell", { command: "arggon show task-x --json" })).toBe(
      "task-x",
    );
    expect(parseArggonItemFromTool("arggon_update", { id: "task-x", status: "in_progress" })).toBe(
      "task-x",
    );
    expect(parseArggonItemFromTool("arggon.arggon_handoff", { id: "task-x" })).toBe("task-x");
    expect(
      parseArggonItemFromTool("execute", {
        code: 'await tools.arggon.arggon_start({ id: "task-x" })',
      }),
    ).toBe("task-x");
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
    expect(block.text).toContain(
      "worktree: /tmp/worktrees/task-smoke-item (session_move available)",
    );
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
    const clipped = buildItemBlock({
      ...item,
      title: "x".repeat(5000),
      labels: Array.from({ length: 50 }, (_, i) => `label-${i}`),
    });
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
    const bounded = boundText(
      ["<arggon-item>", "a".repeat(2000), "</arggon-item>"].join("\n"),
      128,
    );
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
