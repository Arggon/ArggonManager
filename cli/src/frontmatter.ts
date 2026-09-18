/** v0 YAML frontmatter read/write. Official keys plus pass-through for x-* extras. */

export type Frontmatter = Record<string, unknown>;

const FENCE = "---";

export function parseFrontmatter(raw: string): { data: Frontmatter; body: string } {
  const normalized = raw.replace(/^\uFEFF/, "");
  if (!normalized.startsWith(`${FENCE}\n`) && !normalized.startsWith(`${FENCE}\r\n`)) {
    throw new Error("missing YAML frontmatter (expected file to start with ---)");
  }
  const rest = normalized.slice(normalized.indexOf("\n") + 1);
  const endMatch = rest.match(/\r?\n---\r?\n?/);
  if (!endMatch || endMatch.index === undefined) {
    throw new Error("unterminated YAML frontmatter");
  }
  const yaml = rest.slice(0, endMatch.index);
  const body = rest.slice(endMatch.index + endMatch[0].length);
  const data: Frontmatter = {};
  for (const line of yaml.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx === -1) {
      throw new Error(`invalid frontmatter line: ${JSON.stringify(line)}`);
    }
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    data[key] = parseValue(value);
  }
  return { data, body };
}

function parseValue(raw: string): unknown {
  if (raw === "" || raw === "null" || raw === "~") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw.startsWith("[") && raw.endsWith("]")) {
    const inner = raw.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((part) => parseScalar(part.trim()));
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
    return `[${value.map((v) => formatScalar(String(v), false)).join(", ")}]`;
  }
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  const text = String(value);
  const forceQuote = key === "created" || key === "updated" || /^\d{4}-\d{2}-\d{2}$/.test(text);
  return formatScalar(text, forceQuote);
}

function formatScalar(value: string, forceQuote: boolean): string {
  // Backslashes force the quoted (JSON-escaped) form too
  // (bug-tracker-title-rescape): that keeps an input double-quoted scalar
  // byte-identical instead of silently down-converting it to a plain scalar.
  if (forceQuote || /[:#{}[\],&*?!'"\\]|^\s|\s$|^$/.test(value)) {
    return JSON.stringify(value);
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
