/** v0 YAML frontmatter read/write. Official keys plus pass-through for x-* extras. */

export type Frontmatter = Record<string, unknown>;

const FENCE = "---";

/**
 * Why a frontmatter block could not be read, as a TYPED discriminant
 * (bug-validate-does-not-check-frontmatter-present).
 *
 * The three refusals used to be bare `Error`s distinguished only by their
 * message text, so every consumer that needed to tell "there is no block at
 * all" from "the block never closed" had to string-match a message — and the
 * loader flattened all three into one generic `BROKEN_YAML` code. The
 * distinction is load-bearing for `validate`: an absent block and an unclosed
 * one are the same CLASS of corruption (the structure is not there / not
 * complete) but they are different repairs, and both need to name the file.
 * The code lives here, at the parser that decides, so the consumer classifies
 * without re-sniffing the bytes.
 */
export type FrontmatterParseCode =
  /** The text does not open with a `---` fence line at all. */
  | "MISSING_FRONTMATTER"
  /** The block opens but is never closed by a second `---` line. */
  | "UNTERMINATED_FRONTMATTER"
  /** A line inside the block is not a `key: value` pair. */
  | "INVALID_FRONTMATTER_LINE";

/** A structural frontmatter refusal, carrying its typed `code`. */
export class FrontmatterParseError extends Error {
  readonly code: FrontmatterParseCode;

  constructor(code: FrontmatterParseCode, message: string) {
    super(message);
    this.name = "FrontmatterParseError";
    this.code = code;
  }
}

export function parseFrontmatter(raw: string): { data: Frontmatter; body: string } {
  const normalized = raw.replace(/^\uFEFF/, "");
  if (!normalized.startsWith(`${FENCE}\n`) && !normalized.startsWith(`${FENCE}\r\n`)) {
    throw new FrontmatterParseError(
      "MISSING_FRONTMATTER",
      "missing YAML frontmatter (expected file to start with ---)",
    );
  }
  const rest = normalized.slice(normalized.indexOf("\n") + 1);
  const endMatch = rest.match(/\r?\n---\r?\n?/);
  if (!endMatch || endMatch.index === undefined) {
    throw new FrontmatterParseError("UNTERMINATED_FRONTMATTER", "unterminated YAML frontmatter");
  }
  const yaml = rest.slice(0, endMatch.index);
  const body = rest.slice(endMatch.index + endMatch[0].length);
  const lines = yaml.split(/\r?\n/);
  const data: Frontmatter = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx === -1) {
      throw new FrontmatterParseError(
        "INVALID_FRONTMATTER_LINE",
        `invalid frontmatter line: ${JSON.stringify(line)}`,
      );
    }
    const key = line.slice(0, idx).trim();
    const { value, end } = readValue(lines, i);
    i = end;
    data[key] = value;
  }
  return { data, body };
}

/**
 * A LIST value continued over the following physical lines
 * (bug-update-depends-on-multiline-rejected).
 *
 * The contract used to be exactly one physical `key: value` line per field, so
 * ANY continuation line was refused — and the write path could not honor that
 * and stay formatter-stable at once. A long list is written as
 * `depends_on: [task-a, task-b, …]` on one line; the repo formatter (prettier,
 * `printWidth: 100`) reflows it to
 *
 *   depends_on:
 *     [task-a, task-b, …]
 *
 * or, past the wrap width, to the multi-line flow block
 *
 *   depends_on:
 *     [
 *       task-a,
 *       task-b,
 *     ]
 *
 * Both shapes are valid YAML the writer's own inline form becomes, so the
 * reader refused bytes produced by its own tooling: `update` succeeded,
 * the NEXT `validate` (the pre-commit hook) reported `BROKEN_YAML`, and
 * `update --status done` then refused to flip the item — the close-out flow
 * itself could produce an un-flippable item (the same class as the cancelled
 * duplicate `bug-prettier-reflow-breaks-item-frontmatter`).
 *
 * The reader now accepts a value continued over the following lines when those
 * lines are a list in one of the two shapes YAML (and the formatter) use — a
 * wrapped FLOW sequence (`[...]`, closing bracket included) or an indented
 * BLOCK sequence (`- item`). Both hand back exactly the list the single-line
 * form yields, in any field: `depends_on`, `labels` and an `x-*` extra all
 * share this one reader, just as they share `formatValue` on the write side.
 *
 * The permissiveness is SCOPED to that shape and a genuinely broken line is
 * still refused: an indented line that is neither a block entry nor an open
 * flow sequence (`  this is not yaml`) and a flow sequence that never closes
 * both raise `INVALID_FRONTMATTER_LINE` (surfacing as the historical
 * `BROKEN_YAML`).
 */
function readValue(lines: readonly string[], at: number): { value: unknown; end: number } {
  const line = lines[at]!;
  const inline = line.slice(line.indexOf(":") + 1).trim();

  // A flow sequence opened on the key's own line — it may continue below.
  if (inline.startsWith("[")) {
    const flow = readFlow(lines, at, inline);
    return { value: parseValue(flow.text), end: flow.end };
  }
  if (inline !== "") return { value: parseValue(inline), end: at };

  // `key:` with the list on the following lines — the formatter's wrap.
  const next = lines[at + 1];
  if (next === undefined || next.trim() === "") return { value: null, end: at };
  const first = next.trim();
  if (first.startsWith("[")) {
    const flow = readFlow(lines, at + 1, first);
    return { value: parseValue(flow.text), end: flow.end };
  }
  if (BLOCK_ITEM.test(next)) {
    const items: unknown[] = [];
    let end = at;
    for (let j = at + 1; j < lines.length; j++) {
      const item = BLOCK_ITEM.exec(lines[j]!);
      if (!item) break;
      items.push(item[1] ? parseValue(item[1]) : null);
      end = j;
    }
    return { value: items, end };
  }
  // Anything else: the continuation line is not a list, so `key:` stays null and
  // the next iteration refuses that line by name.
  return { value: null, end: at };
}

/** An indented block-sequence entry (`  - value`), with its value captured. */
const BLOCK_ITEM = /^\s+-\s*(.*)$/;

/**
 * Assemble a flow sequence that may span physical lines (`[a,\n  b]`), stopping
 * at the line that closes it. An unterminated sequence is refused rather than
 * swallowed: the value is malformed, not a continuation.
 */
function readFlow(
  lines: readonly string[],
  at: number,
  first: string,
): { text: string; end: number } {
  let text = first;
  let end = at;
  while (flowDepth(text) > 0 && end + 1 < lines.length) {
    end++;
    text = `${text} ${lines[end]!.trim()}`;
  }
  if (flowDepth(text) !== 0) {
    throw new FrontmatterParseError(
      "INVALID_FRONTMATTER_LINE",
      `invalid frontmatter line: ${JSON.stringify(lines[at])}`,
    );
  }
  return { text, end };
}

/**
 * Net `[` depth of a flow sequence, quote-aware: the writer quotes every scalar
 * containing a bracket, so a `]` inside a quoted element must not close the
 * sequence early (and a `"` inside a single-quoted scalar, or vice versa, must
 * not open a span). Single quotes escape by doubling, double quotes by `\`.
 */
function flowDepth(text: string): number {
  let depth = 0;
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quote === '"') {
      if (ch === "\\") i++;
      else if (ch === '"') quote = null;
      continue;
    }
    if (quote === "'") {
      if (ch !== "'") continue;
      if (text[i + 1] === "'") i++;
      else quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "[") depth++;
    else if (ch === "]") depth--;
  }
  return depth;
}

function parseValue(raw: string): unknown {
  if (raw === "" || raw === "null" || raw === "~") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw.startsWith("[") && raw.endsWith("]")) {
    const inner = raw.slice(1, -1).trim();
    if (!inner) return [];
    // Empty parts are dropped: the formatter's multi-line flow block puts a
    // trailing comma before the closing bracket (`[a, b,\n]`), which is a
    // separator, not an empty element. A genuinely empty STRING element is
    // written quoted (`""`) and survives as a non-empty part.
    return inner
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part !== "")
      .map((part) => parseScalar(part));
  }
  return parseScalar(raw);
}

function parseScalar(raw: string): string | number {
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return unescapeDoubleQuoted(raw.slice(1, -1));
  }
  if (raw.startsWith("'") && raw.endsWith("'")) {
    // YAML single-quoted style: the ONLY escape is a doubled quote.
    return raw.slice(1, -1).replaceAll("''", "'");
  }
  if (/^-?\d+$/.test(raw)) return Number(raw);
  return raw;
}

/**
 * YAML 1.2 double-quoted escapes (a superset of JSON's).
 * bug-tracker-title-rescape: the inner text used to be returned verbatim, so
 * `stringifyFrontmatter`'s JSON escaping re-escaped it on EVERY write and a
 * title containing literal backslashes doubled per mutation (4 -> 8 -> 16...).
 * Unknown escapes and a trailing lone backslash are preserved verbatim: a
 * malformed scalar must stay readable, never throw.
 */
const DOUBLE_QUOTED_ESCAPES: Readonly<Record<string, string>> = {
  "0": "\0",
  a: "\x07",
  b: "\b",
  t: "\t",
  n: "\n",
  v: "\v",
  f: "\f",
  r: "\r",
  e: "\x1b",
  " ": " ",
  '"': '"',
  "/": "/",
  "\\": "\\",
  N: "\u0085",
  _: "\u00a0",
  L: "\u2028",
  P: "\u2029",
};

/** Decode the inner text of a double-quoted YAML scalar (bug-tracker-title-rescape). */
function unescapeDoubleQuoted(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = raw[i + 1];
    if (next === undefined) {
      out += ch;
      break;
    }
    if (next === "x" || next === "u" || next === "U") {
      const width = next === "x" ? 2 : next === "u" ? 4 : 8;
      const hex = raw.slice(i + 2, i + 2 + width);
      if (hex.length === width && /^[0-9a-fA-F]+$/.test(hex)) {
        const code = Number.parseInt(hex, 16);
        try {
          out += String.fromCodePoint(code);
          i += 1 + width;
          continue;
        } catch {
          // Out-of-range code point: keep the escape text verbatim.
        }
      }
      out += ch + next;
      i += 1;
      continue;
    }
    const mapped = DOUBLE_QUOTED_ESCAPES[next];
    if (mapped !== undefined) {
      out += mapped;
      i += 1;
      continue;
    }
    // Unknown escape: keep the backslash and the character verbatim.
    out += ch + next;
    i += 1;
  }
  return out;
}

const OFFICIAL_ORDER = [
  "type",
  "status",
  "id",
  "title",
  "assignee",
  "branch",
  "parent",
  "labels",
  "priority",
  "created",
  "updated",
  "blocked_reason",
] as const;

const OFFICIAL_KEYS: Set<string> = new Set(OFFICIAL_ORDER);

export function stringifyFrontmatter(data: Frontmatter, body: string): string {
  const lines: string[] = [FENCE];
  const seen = new Set<string>();
  for (const key of OFFICIAL_ORDER) {
    if (!(key in data) || data[key] === undefined) continue;
    if (key === "assignee" && (data[key] === null || data[key] === "")) continue;
    if (key === "branch" && (data[key] === null || data[key] === "")) continue;
    if (key === "parent" && data[key] === null) continue;
    if (key === "blocked_reason" && (data[key] === null || data[key] === "")) continue;
    lines.push(`${key}: ${formatValue(key, data[key])}`);
    seen.add(key);
  }
  const extras = Object.keys(data)
    .filter((k) => !seen.has(k) && !OFFICIAL_KEYS.has(k) && data[k] !== undefined)
    .sort();
  for (const key of extras) {
    lines.push(`${key}: ${formatValue(key, data[key])}`);
  }
  lines.push(FENCE);
  const bodyOut = body.startsWith("\n") || body.length === 0 ? body : `\n${body}`;
  return `${lines.join("\n")}${bodyOut.endsWith("\n") ? bodyOut : `${bodyOut}\n`}`;
}

function formatValue(key: string, value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    // A genuine NUMBER element keeps its bare token (`parseScalar` decodes
    // bare digits back to a number). Every other element goes through
    // `formatScalar`: the reader decodes array booleans/nulls as STRINGS
    // anyway (`parseScalar` has no true/false/null branch), so quoting them
    // is the same read with a first-write fixed point.
    return `[${value
      .map((v) => (typeof v === "number" ? String(v) : formatScalar(String(v), false)))
      .join(", ")}]`;
  }
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  const text = String(value);
  const forceQuote = key === "created" || key === "updated" || /^\d{4}-\d{2}-\d{2}$/.test(text);
  return formatScalar(text, forceQuote);
}

/**
 * Plain tokens the reader (`parseValue` / `parseScalar`) resolves to a
 * NON-string: `null` / `~` -> null, `true` / `false` -> boolean,
 * `/^-?\d+$/` -> Number. The writer has to quote every string that matches,
 * or a title like `0123` loses its text on the first read and the next write
 * bakes the loss into the file
 * (bug-frontmatter-ambiguous-plain-scalar-loss; same class as
 * bug-tracker-title-rescape: the writer must quote anything the reader would
 * decode as a different type).
 */
const AMBIGUOUS_TOKEN = /^(?:~|null|true|false|-?\d+)$/;

function formatScalar(value: string, forceQuote: boolean): string {
  // Backslashes force the quoted (JSON-escaped) form too
  // (bug-tracker-title-rescape): that keeps an input double-quoted scalar
  // byte-identical instead of silently down-converting it to a plain scalar.
  // Control characters force it as well (PR #360 review F1): a decoded `\n`
  // used to be written raw, splitting the frontmatter and corrupting the tree.
  // YAML-ambiguous tokens force it too (see AMBIGUOUS_TOKEN) so a string that
  // looks like null/~/a boolean/an integer survives as that exact string —
  // this also covers list elements (`depends_on`), which skip `formatValue`.
  if (
    forceQuote ||
    AMBIGUOUS_TOKEN.test(value) ||
    /[\u0000-\u001f\u007f\u2028\u2029]|[:#{}[\],&*?!'"\\]|^\s|\s$|^$/.test(value)
  ) {
    // JSON.stringify escapes \u0000-\u001f, but leaves DEL and the YAML/JS
    // line separators raw; escape those explicitly with YAML escapes the
    // parser decodes back.
    return JSON.stringify(value)
      .replaceAll("\u007f", "\\x7F")
      .replaceAll("\u2028", "\\L")
      .replaceAll("\u2029", "\\P");
  }
  return value;
}

export function stringField(data: Frontmatter, key: string): string | undefined {
  const v = data[key];
  if (v === undefined || v === null) return undefined;
  return String(v);
}

/** Tolerant numeric field: undefined when absent/null/unparseable (never throws). */
export function numberField(data: Frontmatter, key: string): number | undefined {
  const v = data[key];
  if (v === undefined || v === null) return undefined;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : undefined;
}

export function stringArrayField(data: Frontmatter, key: string): string[] {
  const v = data[key];
  if (v === undefined || v === null) return [];
  if (Array.isArray(v)) return v.map((x) => String(x));
  throw new Error(`frontmatter '${key}' must be a list`);
}
