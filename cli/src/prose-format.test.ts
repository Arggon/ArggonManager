import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";
import { describe, expect, it } from "vitest";

// bug-formatter-glues-markdown-spaces (PR #387) + task-code-span-repair-sweep:
// `npm run format` (prettier -w .) runs on every edit in this repo and CI never
// runs prettier, so nothing else notices when the formatter silently rewrites
// prose. Prettier's markdown printer rebuilds inline-code spans from its own
// parse, and two span shapes get rewritten:
//
//   - an invalid `\`` escape inside single-backtick delimiters makes the parser
//     split the span and drop the whitespace around the split — `null` otherwise
//     became `null`otherwise in ArggonManager/docs/json-output.md;
//   - a code span broken across lines inside a list item: the continuation
//     line's indentation is list indentation, so the printer re-emits that line
//     at column 0 and the span's source text silently changes shape — the
//     "indent-lost" variant repaired across ArggonManager/docs by
//     task-code-span-repair-sweep (the rendered text is unaffected, which is why
//     only a source-level rule catches it).
//
// Five rules pin the prose corpus:
//
//   1. formatting never MERGES whitespace-separated tokens (glue diff below);
//   2. formatting never REWRITES a code span's source text (corpus-wide);
//   3. the files repaired by these two items stay byte-stable under
//      `prettier --write`;
//   4. formatting is CONVERGENT where a span wraps - a second `--write` changes
//      nothing there (determinism already covers every other file);
//   5. no code span straddles a wrap boundary onto an INDENTED continuation,
//      the shape that makes rule 4 fail.
//
// Rule 2 deliberately is NOT `prettier --check`: these docs are not byte-clean
// (prettier re-pads tables) and need not become so; the invariant is that
// formatting cannot change what a code span says. Rule 3 is the stronger pin
// for the repaired files.
//
// Rules 4/5 pin bug-prettier-glues-split-inline-code-span (prettier 3.9.6). When
// an inline code span starts on one line and ends on an INDENTED continuation
// of a list item, the markdown printer walks that continuation two spaces (one
// tabWidth) to the LEFT on every `--write` until it reaches column 0: measured
// 6 -> 4 -> 2 -> 0, i.e. the file still changes on the third write and
// `--check` fails on the very output `--write` just produced. The mid-drift
// states are the loud ones: the span's parsed value keeps the line ending AND
// the continuation's surplus indentation ("arggon spec\n    analyze" at a
// 6-space continuation), which renders with extra spaces inside the span. The
// settled column-0 state renders correctly again (CommonMark folds the line
// ending to a space), so the corruption never shows in a render of the committed
// tree - which is why it reads as pure churn rather than as broken docs. No
// markdown option repairs it: `proseWrap: "always"` dodges the straddle by
// reflowing every paragraph (817/996 tracked `.md` files rewritten against 615
// for the shipped `preserve`), and `never` drifts exactly like `preserve`. The
// recorded decision is therefore the authoring rule - keep a multi-word span
// off the wrap boundary - pinned here, plus an explicit `"proseWrap":
// "preserve"` in `.prettierrc.json` so the choice is recorded rather than
// inherited from prettier's default.
//
// Scope: every tracked markdown file except the tracker item tree
// (ArggonManager/<initiative>/…). Item bodies are historical records that quote
// mangled formatter output as evidence — the F1 verdict quotes in
// task-native-lib-hygiene and the escaped-tick repro in
// bug-seam-signature-anchor-regressed — so they are deliberately left as-is and
// excluded here (task-code-span-repair-sweep documents that decision). The
// exclusion also covers the drift: five item bodies are non-convergent today
// and they belong to other items, so the tracker-subtree convergence rule is
// owned by bug-prettier-indented-list-continuation-grows-2-spaces-per-write and
// not by this guard. Embedded code-fence content is out of scope too: a JS
// normalization inside a fence can merge tokens without being flagged, and
// reformatting that code is the
// embedded formatter's job, not prose.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * The files repaired by bug-formatter-glues-markdown-spaces and
 * task-code-span-repair-sweep: `prettier --write` must stay a no-op on them.
 */
const REPAIRED_FILES = [
  "ArggonManager/docs/explorations/exploration-adopter-upgrade-experience-007.md",
  "ArggonManager/docs/explorations/exploration-opencode-v2-native-009.md",
  "ArggonManager/docs/explorations/exploration-priority-model-008.md",
  "ArggonManager/docs/explorations/exploration-smoke-ui-testing-006.md",
  "ArggonManager/docs/explorations/exploration-torture-contention-005.md",
  "ArggonManager/docs/json-output.md",
  "ArggonManager/docs/plans/plan-spec-pipeline-002.md",
  "ArggonManager/docs/playbooks/node.md",
  "ArggonManager/docs/playbooks/opencode.md",
  "ArggonManager/docs/playbooks/typescript.md",
  "ArggonManager/docs/playbooks/vitest.md",
  "ArggonManager/docs/specs/spec-priority-field-008.md",
  "ArggonManager/docs/specs/spec-spec-audit-006.md",
  "ArggonManager/docs/specs/spec-spec-pipeline-002.md",
  "skills/arggon-cli/references/pitfalls.md",
];

/** Tracked prose markdown: the tracker's `docs/` plus everything outside it. */
function proseDocs(): string[] {
  return execFileSync("git", ["ls-files", "-z", "--", "*.md"], {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean)
    .filter((path) => !path.startsWith("ArggonManager/") || path.startsWith("ArggonManager/docs/"))
    .sort();
}

function tokens(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * Tokens the formatter merged: a formatted token that equals a run of two or
 * more source tokens that whitespace separated. A merge is reported only when
 * the merged token sits between the same neighbours as the source run, so a
 * coincidental substring elsewhere in the file cannot fire it.
 */
function gluedTokens(source: string, formatted: string): string[] {
  const src = tokens(source);
  const out = tokens(formatted);
  const srcTokens = new Set(src);
  const outTokens = new Set(out);
  const glued: string[] = [];
  for (let i = 0; i < src.length - 1; i++) {
    let merged = src[i];
    for (let end = i + 1; end < src.length && end <= i + 3; end++) {
      merged += src[end];
      // A token the source already had on its own is not evidence of a merge.
      if (!outTokens.has(merged) || srcTokens.has(merged)) {
        continue;
      }
      const before = src[i - 1];
      const after = src[end + 1];
      const sitsInPlace = out.some(
        (token, at) => token === merged && out[at - 1] === before && out[at + 1] === after,
      );
      if (sitsInPlace) {
        glued.push(`${src.slice(i, end + 1).join(" ")} → ${merged}`);
        break;
      }
    }
  }
  return glued;
}

/** Minimal mdast shape returned by prettier's internal markdown parser. */
interface MdastNode {
  type?: string;
  position?: { start?: { offset?: number }; end?: { offset?: number } };
  children?: MdastNode[];
}

/** Prettier's internal parse hook (untyped): the mdast behind the markdown printer. */
async function parseMarkdown(text: string, filepath: string): Promise<MdastNode> {
  const debug = (
    prettier as unknown as {
      __debug: {
        parse: (text: string, options: { filepath: string }) => Promise<{ ast: MdastNode }>;
      };
    }
  ).__debug;
  const { ast } = await debug.parse(text, { filepath });
  return ast;
}

/**
 * Raw source text of every inline code span (delimiters included), in document
 * order — the exact bytes the formatter may rewrite (e.g. drop the continuation
 * indent of a multi-line span, or re-encode its delimiters).
 */
async function codeSpanSlices(text: string, filepath: string): Promise<string[]> {
  const ast = await parseMarkdown(text, filepath);
  const slices: string[] = [];
  const walk = (node: MdastNode) => {
    const start = node.position?.start?.offset;
    const end = node.position?.end?.offset;
    if (node.type === "inlineCode" && start != null && end != null) {
      slices.push(text.slice(start, end));
      return;
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(ast);
  return slices;
}

/** 0-based line index of `offset`. */
function lineOf(text: string, offset: number): number {
  let lines = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") lines++;
  }
  return lines;
}

/** Leading-space count of the (0-based) `line`. */
function lineIndent(text: string, line: number): number {
  return (text.split("\n")[line]?.match(/^ */) ?? [""])[0].length;
}

interface SpanWrapReport {
  /** Spans that wrap onto an INDENTED continuation - the shape that drifts. */
  readonly triggers: string[];
  /** How many spans wrap at all (indented continuation or not). */
  readonly wrapping: number;
}

/**
 * The drift trigger (bug-prettier-glues-split-inline-code-span): a span whose
 * delimiters sit on different lines AND whose continuation line is indented, so
 * prettier walks that continuation two spaces left on every `--write` until it
 * reaches column 0. Reported as `file:line span "..." wraps onto an N-space
 * continuation`, with each wrap shown as `<NL>`.
 *
 * `wrapping` is the broader population the formatter cannot be trusted on: every
 * span it has to carry across a line break. Those files get the convergence
 * assertion; the rest need no second pass (formatting is deterministic, so a
 * file prettier already agrees with cannot drift).
 */
async function spanWrapReport(text: string, filepath: string): Promise<SpanWrapReport> {
  const ast = await parseMarkdown(text, filepath);
  const triggers: string[] = [];
  let wrapping = 0;
  const walk = (node: MdastNode) => {
    const start = node.position?.start?.offset;
    const end = node.position?.end?.offset;
    if (node.type === "inlineCode" && start != null && end != null) {
      const firstLine = lineOf(text, start);
      const lastLine = lineOf(text, end - 1);
      if (lastLine > firstLine) wrapping++;
      for (let line = firstLine + 1; line <= lastLine; line++) {
        const indent = lineIndent(text, line);
        if (indent > 0) {
          const span = text.slice(start, end).split("\n").join("<NL>");
          triggers.push(
            `${filepath}:${firstLine + 1} span ${JSON.stringify(span)} wraps onto a ${indent}-space continuation (line ${line + 1})`,
          );
        }
      }
      return;
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(ast);
  return { triggers, wrapping };
}

/**
 * The item's literal repro written as a single-line bullet: a multi-word inline
 * code span near the wrap boundary inside a list item. Under the shipped
 * `proseWrap: "preserve"` prettier leaves it alone, which is what makes this
 * shape the safe authoring form.
 */
const SPAN_NEAR_WRAP_SAFE =
  "- [ ] **Spec + plan written** from the edge-case table, then `arggon spec analyze` reports no NEW findings - the gate that releases implementation tasks\n";

/** The shape that oscillates: the same words, with the span split at the wrap. */
const SPAN_SPLIT_AT_WRAP =
  "- [ ] **Spec + plan written** from the edge-case table, then `arggon spec\n      analyze` reports no NEW findings - the gate that releases implementation tasks\n";

describe("prose markdown survives the formatter", () => {
  it("prettier never glues whitespace-separated tokens together", async () => {
    const files = proseDocs();
    // A silent empty list would make this suite pass vacuously.
    expect(files.length).toBeGreaterThan(0);

    const config = (await prettier.resolveConfig(join(repoRoot, "package.json"))) ?? {};
    const failures: string[] = [];
    for (const file of files) {
      const source = readFileSync(join(repoRoot, file), "utf8");
      const formatted = await prettier.format(source, {
        ...config,
        filepath: join(repoRoot, file),
      });
      const glued = gluedTokens(source, formatted);
      if (glued.length > 0) {
        failures.push(`${file}: ${glued.join("; ")}`);
      }
    }

    expect(failures).toEqual([]);
  });

  it("prettier never rewrites a code span's source text", async () => {
    const files = proseDocs();
    // A silent empty list would make this suite pass vacuously.
    expect(files.length).toBeGreaterThan(0);

    const config = (await prettier.resolveConfig(join(repoRoot, "package.json"))) ?? {};
    const failures: string[] = [];
    for (const file of files) {
      const filepath = join(repoRoot, file);
      const source = readFileSync(filepath, "utf8");
      const formatted = await prettier.format(source, { ...config, filepath });
      const before = await codeSpanSlices(source, filepath);
      const after = await codeSpanSlices(formatted, filepath);
      if (before.length !== after.length) {
        failures.push(`${file}: code span count changed (${before.length} → ${after.length})`);
        continue;
      }
      const rewritten = before.findIndex((span, at) => span !== after[at]);
      if (rewritten !== -1) {
        failures.push(
          `${file}: prettier rewrites code span ${JSON.stringify(before[rewritten])} → ${JSON.stringify(after[rewritten])}`,
        );
      }
    }

    expect(failures).toEqual([]);
  });

  it("the files repaired by these items stay byte-stable under prettier", async () => {
    const config = (await prettier.resolveConfig(join(repoRoot, "package.json"))) ?? {};
    for (const file of REPAIRED_FILES) {
      const source = readFileSync(join(repoRoot, file), "utf8");
      const formatted = await prettier.format(source, {
        ...config,
        filepath: join(repoRoot, file),
      });
      expect(formatted, `${file} is no longer prettier-clean — run \`npm run format\``).toBe(
        source,
      );
    }
  });

  it("prettier is convergent where a span wraps, and no span drifts", async () => {
    const files = proseDocs();
    // A silent empty list would make this suite pass vacuously.
    expect(files.length).toBeGreaterThan(0);

    const config = (await prettier.resolveConfig(join(repoRoot, "package.json"))) ?? {};
    const failures: string[] = [];
    const wrappingFiles: string[] = [];
    for (const file of files) {
      const filepath = join(repoRoot, file);
      const source = readFileSync(filepath, "utf8");
      const { triggers, wrapping } = await spanWrapReport(source, filepath);
      // Rule 5: no shape that can drift is written down in the first place.
      failures.push(...triggers);
      if (wrapping > 0) wrappingFiles.push(file);
    }
    // A silent empty list would make the convergence half of this rule vacuous.
    expect(wrappingFiles.length).toBeGreaterThan(10);

    for (const file of wrappingFiles) {
      const filepath = join(repoRoot, file);
      const source = readFileSync(filepath, "utf8");
      const first = await prettier.format(source, { ...config, filepath });
      const second = await prettier.format(first, { ...config, filepath });
      // A single `--check` compares committed bytes against ONE pass, so it
      // cannot see a file that still moves on the second `--write`.
      if (first !== second) {
        failures.push(`${file}: prettier is not convergent - a second --write changes it`);
      }
    }

    expect(failures).toEqual([]);
  });

  it("the wrap-boundary span shape is pinned: clean, convergent, unsplit", async () => {
    const config = (await prettier.resolveConfig(join(repoRoot, "package.json"))) ?? {};
    const filepath = join(repoRoot, "prose-format-keycase.md");

    // The detector fires on the shape that drifts (so rule 5 is not vacuous)...
    const drift = await spanWrapReport(SPAN_SPLIT_AT_WRAP, filepath);
    expect(drift.wrapping).toBe(1);
    expect(drift.triggers).toEqual([
      `${filepath}:1 span "\`arggon spec<NL>      analyze\`" wraps onto a 6-space continuation (line 2)`,
    ]);
    // ...and stays silent on the safe form.
    const safe = await spanWrapReport(SPAN_NEAR_WRAP_SAFE, filepath);
    expect(safe).toEqual({ triggers: [], wrapping: 0 });

    // The safe form is what `--check` compares against: prettier leaves it be.
    const formatted = await prettier.format(SPAN_NEAR_WRAP_SAFE, { ...config, filepath });
    expect(formatted, "the safe form is no longer prettier-clean — rewrap it as one line").toBe(
      SPAN_NEAR_WRAP_SAFE,
    );
    // ...and formatting it again cannot move it.
    const reformatted = await prettier.format(formatted, { ...config, filepath });
    expect(reformatted).toBe(formatted);
    // ...and the multi-word span survives as ONE span with its value intact,
    // never split with its continuation glued to column 0.
    const before = await codeSpanSlices(SPAN_NEAR_WRAP_SAFE, filepath);
    const after = await codeSpanSlices(formatted, filepath);
    expect(after).toEqual(before);
    expect(after).toEqual(["`arggon spec analyze`"]);
  });
});
