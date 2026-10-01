/**
 * Transform-neutral embedding for the board's `toString()`-rendered page
 * script (bug-tsx-board-dead-script).
 *
 * The board page has no bundled script file: `renderBoardHtml` embeds each
 * controller function into the page with `Function.prototype.toString()`
 * (board-parity.test.ts proves the embedded copy 1:1 against the TS source).
 * That contract silently assumed a function object's source is the source the
 * author wrote — true under `tsc` (the `dist/cli.js` bin CI and the smoke
 * lane drive) and under vitest's oxc transform, but NOT under tsx: `tsx`
 * compiles TypeScript with esbuild and esbuild enables `keepNames`, which
 * renames nested function declarations/closures while lowering them and then
 * preserves their original `.name` by splicing `__name(target, "name")` calls
 * into the enclosing function body. `Function.prototype.toString()` of the
 * transformed function therefore ships those calls to the page, where `__name`
 * does not exist: the first statement that reaches one throws
 * `ReferenceError: __name is not defined` and the whole script block dies —
 * filter, drag, collapse, theme and density controls included (the `<head>`
 * theme boot survives only because it is a separate block that calls no
 * transformed helper). This is why every existing gate missed it: oxc's
 * transform leaves `toString()` clean, and CI drives `dist/cli.js` (tsc
 * output, no `__name`).
 *
 * `embeddedFunctionSource` strips the mechanical `__name(...)` wrapper at
 * render time. esbuild's `__name` returns its first argument, so replacing
 * the call with that argument restores the exact source shape `tsc` emits,
 * for every shape esbuild produces today:
 *
 *   1. statement:            `__name(inner,"inner");`            -> `inner;`
 *   2. comma-list statement: `__name(a,"a"),__name(b,"b");`      -> `a,b;`
 *   3. expression wrapper:   `const cb=__name(f,"cb");`          -> `const cb=f;`
 *
 * The first two rewritten forms remain legal no-op expression statements
 * (the identifier is already bound by its declaration), and the third keeps
 * the wrapped function expression — one rewrite rule covers all three.
 *
 * The stripper is deliberately shape-strict: it scans real JS syntax
 * (strings, template literals, comments, regex literals) so it never touches
 * a `__name` spelled inside a literal, and any `__name` token it cannot
 * consume as a known keepNames call THROWS at render time — with the
 * unrecognized shape in the message — instead of shipping a page script that
 * dies in a browser. An unknown shape means esbuild changed its emission;
 * failing the render loudly and immediately is the contract, and the
 * spawn-the-CLI gate in board.test.ts plus the tsx-path `@smoke` browser leg
 * in e2e/board.smoke.spec.ts keep the class from returning silently.
 *
 * Constraint for embedded board functions (same family as the existing
 * "no module-scope references, no template literals" rule): never write the
 * identifier `__name` in a function embedded with `toString()` — as a call,
 * a bare reference or a property key. The stripper treats every code-context
 * occurrence as an esbuild artifact to strip or an error to report.
 */

/** Any function value whose source is embedded into a board page. */
type EmbeddedFunction = (...args: never[]) => unknown;

/**
 * Source of `fn` as it may be embedded into a board page: the function's own
 * source with any esbuild keepNames artifacts stripped (see the module doc).
 * Identity under `tsc` and vitest's oxc transform (nothing to strip), so the
 * board-parity `toString()` assertions stay exact on those paths.
 * @throws when a `__name` artifact survives in an unrecognized shape.
 */
export function embeddedFunctionSource(fn: EmbeddedFunction): string {
  return stripKeepNamesCalls(fn.toString());
}

/** Identifiers/keywords after which `/` starts a regex literal, not division. */
const REGEX_KEYWORDS = new Set([
  "await",
  "case",
  "delete",
  "do",
  "else",
  "in",
  "instanceof",
  "new",
  "of",
  "return",
  "throw",
  "typeof",
  "void",
  "yield",
]);

/** Punctuation after which `/` starts a regex literal, not division. */
const REGEX_PRECEDERS = new Set([
  "!",
  "%",
  "&",
  "(",
  "*",
  "+",
  ",",
  "-",
  ":",
  ";",
  "<",
  "=",
  ">",
  "?",
  "[",
  "{",
  "}",
  "~",
  "|",
  "^",
]);

function isWordChar(c: string): boolean {
  return (
    (c >= "a" && c <= "z") ||
    (c >= "A" && c <= "Z") ||
    (c >= "0" && c <= "9") ||
    c === "_" ||
    c === "$"
  );
}

/** Regex-vs-division heuristic: the classic prev-token rule, good enough for
 * machine-generated (esbuild) and hand-written plain function bodies. */
function regexAllowed(prev: string, lastWord: string): boolean {
  if (prev === "") return true;
  if (REGEX_PRECEDERS.has(prev)) return true;
  return REGEX_KEYWORDS.has(lastWord);
}

/** `source[start]` is a quote: return the index just past the closing quote. */
function skipString(source: string, start: number): number {
  const quote = source[start];
  let i = start + 1;
  while (i < source.length) {
    const c = source[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === quote) return i + 1;
    if (c === "\n") return i; // unterminated: stop here, never consume the file
    i++;
  }
  return source.length;
}

/** `source[start]` is a backtick: return the index just past the closing
 * backtick, honoring escapes and `${...}` substitutions (which may nest
 * strings and further templates). */
function skipTemplate(source: string, start: number): number {
  let i = start + 1;
  while (i < source.length) {
    const c = source[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === "`") return i + 1;
    if (c === "$" && source[i + 1] === "{") {
      i += 2;
      let depth = 1;
      while (i < source.length && depth > 0) {
        const d = source[i];
        if (d === "\\") {
          i += 2;
          continue;
        }
        if (d === "'" || d === '"') {
          i = skipString(source, i);
          continue;
        }
        if (d === "`") {
          i = skipTemplate(source, i);
          continue;
        }
        if (d === "/" && source[i + 1] === "/") {
          const nl = source.indexOf("\n", i);
          i = nl === -1 ? source.length : nl + 1;
          continue;
        }
        if (d === "/" && source[i + 1] === "*") {
          const end = source.indexOf("*/", i + 2);
          i = end === -1 ? source.length : end + 2;
          continue;
        }
        if (d === "{") depth++;
        else if (d === "}") depth--;
        i++;
      }
      continue;
    }
    i++;
  }
  return source.length;
}

/** `source[start]` is a regex-literal `/`: return the index just past the
 * closing `/` and its flags. */
function skipRegexLiteral(source: string, start: number): number {
  let i = start + 1;
  let inClass = false;
  while (i < source.length) {
    const c = source[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === "[") inClass = true;
    else if (c === "]") inClass = false;
    else if (c === "/" && !inClass) {
      i++;
      while (i < source.length && isWordChar(source[i] ?? "")) i++;
      return i;
    }
    i++;
  }
  return source.length;
}

/** Failure for a `__name` occurrence the stripper cannot classify (shape 1-3
 * in the module doc): render-time and loud, never a broken page. */
function unknownKeepNamesShape(source: string, at: number): Error {
  const sample = source.slice(at, Math.min(source.length, at + 120));
  return new Error(
    `board embed: unrecognized esbuild keepNames shape at offset ${at}: "${sample}"... — ` +
      "the tsx transform emitted a __name form this renderer does not strip. " +
      "Extend stripKeepNamesCalls (cli/src/board-embed.ts) rather than shipping " +
      "a page script that throws ReferenceError: __name is not defined.",
  );
}

/**
 * Parse one `__name(EXPR,"NAME")` call; `open` is the index of the opening
 * `(`. Returns EXPR (the first argument, which is what `__name` evaluates to)
 * and the index just past the closing `)`.
 * @throws unknownKeepNamesShape unless EXPR starts a function/class expression
 * (the only thing esbuild wraps) and the tail is exactly `,"NAME")`.
 */
function parseKeepNamesCall(source: string, open: number): { expr: string; next: number } {
  let i = open + 1;
  while (i < source.length && (source[i] === " " || source[i] === "\t" || source[i] === "\n")) i++;
  const exprStart = i;
  let depth = 1;
  let prev = "";
  let lastWord = "";
  let exprEnd = -1;
  while (i < source.length) {
    const c = source[i];
    if (c === '"' || c === "'") {
      i = skipString(source, i);
      prev = c ?? "";
      lastWord = "";
      continue;
    }
    if (c === "`") {
      i = skipTemplate(source, i);
      prev = "`";
      lastWord = "";
      continue;
    }
    if (c === "/" && source[i + 1] === "/") {
      const nl = source.indexOf("\n", i);
      i = nl === -1 ? source.length : nl + 1;
      continue;
    }
    if (c === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      i = end === -1 ? source.length : end + 2;
      continue;
    }
    if (c === "/" && regexAllowed(prev, lastWord)) {
      i = skipRegexLiteral(source, i);
      prev = "/";
      lastWord = "";
      continue;
    }
    if (c === "(" || c === "[" || c === "{") {
      depth++;
      prev = c;
      lastWord = "";
      i++;
      continue;
    }
    if (c === ")" || c === "]" || c === "}") {
      depth--;
      if (depth === 0) throw unknownKeepNamesShape(source, open - 7);
      prev = c;
      lastWord = "";
      i++;
      continue;
    }
    if (c === "," && depth === 1) {
      exprEnd = i;
      break;
    }
    if (c !== undefined && isWordChar(c)) {
      let j = i;
      while (j < source.length && isWordChar(source[j] ?? "")) j++;
      lastWord = source.slice(i, j);
      prev = c;
      i = j;
      continue;
    }
    if (c && c !== " " && c !== "\t" && c !== "\n" && c !== "\r") {
      prev = c;
      lastWord = "";
    }
    i++;
  }
  if (exprEnd === -1) throw unknownKeepNamesShape(source, open - 7);
  const expr = source.slice(exprStart, exprEnd).trim();
  // esbuild passes either a plain identifier (the binding a lowered
  // declaration was renamed to — shapes 1 and 2) or a function/class
  // expression (shape 3). Anything else is a shape this module does not
  // recognize.
  const plainIdentifier = /^[A-Za-z_$][\w$]*$/.test(expr);
  if (!plainIdentifier && !/^(?:function|class|\()/.test(expr)) {
    throw unknownKeepNamesShape(source, open - 7);
  }
  let k = exprEnd + 1;
  while (k < source.length && (source[k] === " " || source[k] === "\t" || source[k] === "\n")) k++;
  if (source[k] !== '"') throw unknownKeepNamesShape(source, open - 7);
  k = skipString(source, k);
  while (k < source.length && (source[k] === " " || source[k] === "\t" || source[k] === "\n")) k++;
  if (source[k] !== ")") throw unknownKeepNamesShape(source, open - 7);
  return { expr, next: k + 1 };
}

/**
 * Remove esbuild keepNames `__name(...)` calls from an embedded function
 * source (module doc has the shapes and the rationale). Identity on sources
 * without `__name` artifacts.
 * @throws unknownKeepNamesShape on any code-context `__name` it cannot strip.
 */
export function stripKeepNamesCalls(source: string): string {
  let out = "";
  let i = 0;
  let prev = "";
  let lastWord = "";
  const n = source.length;
  while (i < n) {
    const c = source[i];
    if (c === '"' || c === "'") {
      const j = skipString(source, i);
      out += source.slice(i, j);
      prev = c;
      lastWord = "";
      i = j;
      continue;
    }
    if (c === "`") {
      const j = skipTemplate(source, i);
      out += source.slice(i, j);
      prev = "`";
      lastWord = "";
      i = j;
      continue;
    }
    if (c === "/" && source[i + 1] === "/") {
      const nl = source.indexOf("\n", i);
      const end = nl === -1 ? n : nl + 1;
      out += source.slice(i, end);
      i = end;
      continue;
    }
    if (c === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      out += source.slice(i, stop);
      i = stop;
      continue;
    }
    if (c === "/" && regexAllowed(prev, lastWord)) {
      const j = skipRegexLiteral(source, i);
      out += source.slice(i, j);
      prev = "/";
      lastWord = "";
      i = j;
      continue;
    }
    if (c !== undefined && isWordChar(c)) {
      let j = i;
      while (j < n && isWordChar(source[j] ?? "")) j++;
      const word = source.slice(i, j);
      if (word === "__name" && prev !== ".") {
        let k = j;
        while (k < n && (source[k] === " " || source[k] === "\t" || source[k] === "\n")) k++;
        if (source[k] === "(") {
          const { expr, next } = parseKeepNamesCall(source, k);
          out += expr;
          prev = ")";
          lastWord = "";
          i = next;
          continue;
        }
        throw unknownKeepNamesShape(source, i);
      }
      out += word;
      prev = c;
      lastWord = word;
      i = j;
      continue;
    }
    if (c !== undefined) out += c;
    if (c && c !== " " && c !== "\t" && c !== "\n" && c !== "\r") {
      prev = c;
      lastWord = "";
    }
    i++;
  }
  return out;
}
