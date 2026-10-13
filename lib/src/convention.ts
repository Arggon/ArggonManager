import { existsSync, readFileSync } from "node:fs";
import { isItemType, type ItemType } from "./ids.js";
import { conventionPathForRoot, TRACKER_DIR_NAME } from "./paths.js";

/**
 * Latest task-tree convention version written by `arggon init`
 * (docs/convention.md). v4 = priority field; v5 = tracker root rename
 * (`ArggonManager/` + docs under the tracker, ADR 0012). v3/v4 trees on the
 * legacy `tasks/` layout stay valid (auto-detected; `validate` reports the
 * legacy location and `arggon migrate --layout` is the supported move).
 */
export const CONVENTION_VERSION = 5;

/** Version assumed when `.convention.yml` is missing or unparseable (omit file = 0). */
export const CONVENTION_VERSION_DEFAULT = 0;

/**
 * Read the tree convention version from the tracker's `.convention.yml`
 * (`<dir>/ArggonManager/.convention.yml`, or `<dir>/tasks/.convention.yml` on
 * the legacy layout). Returns CONVENTION_VERSION_DEFAULT when the file is
 * missing or has no parseable `version: N` line (per docs/json-output.md:
 * omit file = 0).
 *
 * The key is read exactly like `parseConventionConfig` reads it, quotes
 * included (bug-convention-parser-rejects-valid-yaml-force-rescaffolds): two
 * readers of one file must give one answer, so `"version": 5` is version 5 on
 * both surfaces.
 */
export function readConventionVersion(dir: string): number {
  const path = conventionPathForRoot(dir);
  if (!existsSync(path)) return CONVENTION_VERSION_DEFAULT;
  try {
    const raw = readFileSync(path, "utf8");
    const match = raw.match(/^["']?version["']?\s*:\s*(\d+)/m);
    if (!match) return CONVENTION_VERSION_DEFAULT;
    const parsed = Number.parseInt(match[1] ?? "", 10);
    return Number.isFinite(parsed) ? parsed : CONVENTION_VERSION_DEFAULT;
  } catch {
    return CONVENTION_VERSION_DEFAULT;
  }
}

/** Default `branch_patterns` (docs/convention.md): feat/ everywhere, fix/ for bugs. */
export const DEFAULT_BRANCH_PATTERNS: Record<ItemType, string> = {
  initiative: "feat/{id}",
  epic: "feat/{id}",
  story: "feat/{id}",
  task: "feat/{id}",
  bug: "fix/{id}",
};

/** `x-playbooks` namespaced extension options (story-tech-playbooks). */
export type PlaybooksConfig = {
  /**
   * Stale threshold for `arggon playbook status`, in days, from
   * `x-playbooks.max-age-days`. `null` when unset (the command applies its
   * own default of 90).
   */
  maxAgeDays: number | null;
};

/** `x-tracker` namespaced extension options (story-tracker-hygiene). */
export type TrackerConfig = {
  /**
   * Auto-commit of tracker mutations from `x-tracker.auto-commit`
   * (create/comment/adopt/cleanup --prune). `null` when unset (callers apply
   * the built-in default of true; a `--no-commit` CLI flag still wins).
   */
  autoCommit: boolean | null;
  /**
   * Claim-steal arming from `x-tracker.allow-steal` (bug-cli-steal-not-gated).
   * `null` (unset) and `false` both leave `update --steal` refused with an
   * actionable message; only an explicit `true` arms the interactive,
   * human-only steal flow.
   */
  allowSteal: boolean | null;
  /**
   * Orphan-reaping arming from `x-tracker.reap-acked-orphans`
   * (task-adapter-orphan-reaping). `null` (unset) and `false` both mean an
   * ACKNOWLEDGED orphan is never deleted: `adopt --ack` re-records the checksum
   * from disk, so for an acknowledged entry a checksum match proves only
   * "unchanged since the ack" — provenance cannot separate "unedited" from
   * "curated, then acked", and the second is the adopter's content. Only an
   * explicit `true` lets `arggon init` reap that middle case (the agent-rename
   * migration needs acked adopters to be able to clear a dead agent file).
   * The default therefore cannot lose work; arming is the documented choice.
   */
  reapAckedOrphans: boolean | null;
  /**
   * Strict start gate from `x-tracker.strict-gate-bins`
   * (task-start-gate-strict-mode). `null` (unset) and `false` both keep start
   * report-only (the documented honest-receipt design: the claim commit stays
   * authoritative and a foreign gate-bin resolution only withholds `ready`);
   * an explicit `true` additionally HARD-FAILS the claim commit when the
   * readiness receipt reports any gate binary resolving from OUTSIDE the
   * worktree (`external`, `path`, or `missing` — the bin-resolves-nowhere
   * flavor included).
   */
  strictGateBins: boolean | null;
  /**
   * Strict worktree-write gate from `x-tracker.strict-worktree-writes`
   * (task-single-writer-worktree-enforcement). `null` (unset) and `false` both
   * keep start's single-writer detection REPORT-ONLY: an attach to a worktree
   * stamped by a DIFFERENT session, with tracked files modified after that
   * claim stamp, is carried as a named warning in the receipt
   * (`claim.foreignWrites`). An explicit `true` additionally HARD-FAILS the
   * claim (before the claim update, the item file unmutated) on the same
   * observation, mirroring `strict-gate-bins`.
   */
  strictWorktreeWrites: boolean | null;
  /**
   * Product-acceptance recording from `x-tracker.product-acceptance` (ADR 0021
   * §4, spec promotion-policy-018). `null` (unset) and `false` both leave every
   * surface exactly as it is today: the `accept:` convention is still parsed and
   * reported on `report --json` / `show --json` (additive fields, read-only),
   * but the `spec analyze` detector stays silent. Only an explicit `true` arms
   * the report-only `MISSING-PRODUCT-ACCEPTANCE` finding — arming is the act of
   * saying "this project has a product owner and wants the record".
   */
  productAcceptance: boolean | null;
};

/** `x-import` namespaced extension options (task-import-type-mapping). */
export type ImportConfig = {
  /**
   * GitHub label -> work-item type mapping from `x-import.label-types`
   * (keys matched exactly against the slugified issue labels). `null` when
   * unset (the import applies its built-in default: `bug` -> bug, everything
   * else -> task). Values are validated as work-item types at parse time;
   * the import itself only accepts leaf types (`task`/`bug`).
   */
  labelTypes: Record<string, ItemType> | null;
};

/** `x-worktree` namespaced extension options (task-start-post-hook). */
export type WorktreeConfig = {
  /**
   * Shell command from `x-worktree.post-start`, run inside a freshly created
   * worktree after a successful `arggon start --worktree` (cwd = the worktree
   * root). `null` when unset (the start is a no-op for the hook; `--no-hook`
   * skips it per invocation).
   */
  postStart: string | null;
  /**
   * Shell variant from `x-worktree.post-start-shell` (task-post-start-env):
   * `"inherit"` (default) runs the hook via `sh -c` with the invoking arggon
   * process environment; `"login"` runs it via the user's login shell
   * (`$SHELL -lc`) so toolchains installed through profile files (rustup's
   * ~/.cargo/env, mise, asdf) land on PATH. `null` when unset (= inherit).
   * The `--post-start-shell` start flag overrides per invocation.
   */
  postStartShell: "inherit" | "login" | null;
  /**
   * Env-contract opt-out from `x-worktree.env` (spec
   * worktree-env-contract-016): only an explicit `false` disables the
   * per-worktree `.arggon.env` preparation (and the receipt reports
   * `env: { written: false, warning }` for it); `null` (unset) and `true`
   * both keep the documented default of enabled.
   */
  env: boolean | null;
  /**
   * Compose reaping declaration from `x-worktree.services` (ADR 0019 layer 2,
   * task-cleanup-declared-services): `"true"` = the per-worktree Compose
   * project is named exactly the worktree id `<repo>-<item-id>`; any other
   * non-null value is the adopter's declared base project name, and the
   * worktree project reaped is `<base>-<repo>-<item-id>` (lowercased — the
   * adopter pattern's `name: "<base>${WORKTREE_SUFFIX:-}"`). `null` (unset or
   * an explicit `false`) declares nothing: `cleanup --prune` never invokes
   * Docker — the report-only path is the safety gate, the kernel never probes
   * for or invokes Docker the convention didn't declare.
   */
  services: string | null;
};

/** `x-github` namespaced extension options (task-issue-roundtrip). */
export type GitHubConfig = {
  /**
   * Issue round-trip from `x-github.issue-roundtrip` (task-issue-roundtrip):
   * when an item carrying the `issue` frontmatter field flips to `done`, the
   * linked GitHub issue is closed (annotated) via `gh`. Default OFF — flips
   * happen through bots too, so a per-call flag would not cover them; the
   * tree-wide config gate does.
   */
  issueRoundtrip: boolean;
};

/** `x-friction` namespaced extension options (ADR 0024 §3, plan T4). */
export type FrictionConfig = {
  /**
   * Friction-capture opt-out from `x-friction` (spec-friction-capture-020
   * §Opt-out). `false` disables capture tree-wide: `arggon friction "<obs>"`
   * writes no record and `--report` renders empty with `optedOut: true`. It
   * gates **capture only** — never discoverability (ADR 0024 §3): the trigger
   * text stays in the generated agent files and the command stays on PATH and
   * in `--help`, so an adopter who opts out and later wants the channel back
   * can still find it.
   *
   * `null` when unset (capture is the default). `ARGGON_NO_FRICTION=1` is the
   * per-invocation off-switch and WINS over this key, mirroring the
   * `--no-commit` / `x-tracker.auto-commit` precedence.
   */
  capture: boolean | null;
};

/**
 * One generated-doc provenance record (`x-generated` namespaced extension,
 * story-adoption-state): destination path -> entry, written by
 * `generateDocs`/`init` after stamping the file with its marker comment.
 */
export type GeneratedEntry = {
  /** Source template, package-root relative (e.g. "docs/AGENTS.md"). */
  template: string;
  /** Checksum of the file as generated, "sha256:<hex>" (marker included). */
  checksum: string;
  /** ArggonManager version that generated the file. */
  arggonVersion: string;
  /** ISO-8601 timestamp of the generating run. */
  generatedAt: string;
  /**
   * True when `arggon adopt --ack` sanctioned the current content as the
   * baseline (bug-ack-baseline-regen-loss): the entry is adopter-owned
   * sanctioned-diverged content and is NEVER regenerated by later `init`
   * re-runs, even though the checksum matches the recorded baseline.
   */
  acknowledged?: boolean;
};

export type ConventionConfig = {
  version: number;
  /** Per-type branch patterns; always complete (missing keys fall back to defaults). */
  branchPatterns: Record<ItemType, string>;
  /** Named saved views (`x-views` extension key): view name -> filter expression. */
  views: Record<string, string>;
  /** Technology-playbook options (`x-playbooks` extension key). */
  playbooks: PlaybooksConfig;
  /** Tracker-hygiene options (`x-tracker` extension key). */
  tracker: TrackerConfig;
  /** Issue-import options (`x-import` extension key). */
  import: ImportConfig;
  /** Worktree-bootstrap options (`x-worktree` extension key). */
  worktree: WorktreeConfig;
  /** GitHub round-trip options (`x-github` extension key). */
  github: GitHubConfig;
  /** Adopter-friction options (`x-friction` extension key). */
  friction: FrictionConfig;
  /**
   * Generated-doc provenance (`x-generated` extension key): destination path
   * (posix, relative to the repo root) -> provenance entry.
   */
  generated: Record<string, GeneratedEntry>;
  /**
   * Project name recorded once under `x-generated.projectName`
   * (bug-project-name-dir-derived): the `{{PROJECT_NAME}}` value used at
   * generation time, so re-runs (from worktrees/renamed clones whose
   * directory basename differs) recover it instead of re-deriving it from
   * the directory name. `null` when absent (legacy state).
   */
  generatedProjectName: string | null;
};

/**
 * YAML 1.2 double-quoted escapes (a superset of JSON's). Mirrors the private
 * helper in `frontmatter.ts` (bug-tracker-title-rescape), which is not
 * exported; keeps both hand-rolled YAML readers decoding identically.
 * bug-convention-config-scalar-unescape: returning the inner text verbatim
 * re-escaped literal backslashes on every init/upgrade rewrite
 * (2 -> 4 -> 8 -> ...). Unknown escapes and a trailing lone backslash are
 * preserved verbatim: a malformed scalar must stay readable, never throw.
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

/** Decode the inner text of a double-quoted YAML scalar (bug-convention-config-scalar-unescape). */
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

/**
 * Strip the YAML quoting from a scalar and decode its escape sequences:
 * double-quoted style decodes the YAML 1.2 escape set, single-quoted style
 * only un-doubles `''` (its sole escape). Unquoted values pass through
 * unchanged (bug-convention-config-scalar-unescape).
 */
function stripQuotes(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    return unescapeDoubleQuoted(value.slice(1, -1));
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  return value;
}

/**
 * Strip a trailing YAML comment from the raw text after a `key:` colon.
 *
 * bug-convention-parser-rejects-valid-yaml-force-rescaffolds: `allow-steal: true
 * # armed` is valid YAML whose value is the boolean `true`, and it is the
 * spelling an adopter writes naturally. Refusing it made `init --force`
 * classify the whole file as unreadable and re-derive it from the fixed
 * scaffold, dropping the adopter's configuration. YAML starts a comment at a
 * `#` that begins the line or is preceded by whitespace, so that is exactly
 * the rule here; a `#` inside a quoted scalar, or one with no whitespace in
 * front of it, is content.
 */
function stripInlineComment(raw: string): string {
  if (raw.startsWith("#")) return "";
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i]!;
    if (quote === '"') {
      if (ch === "\\") i += 1;
      else if (ch === '"') quote = null;
      continue;
    }
    if (quote === "'") {
      if (ch === "'") {
        if (raw[i + 1] === "'") i += 1;
        else quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "#" && (raw[i - 1] === " " || raw[i - 1] === "\t")) {
      return raw.slice(0, i).trimEnd();
    }
  }
  return raw;
}

/** One parsed block-scalar header (`|`, `|-`, `>2+`, ...). */
type BlockScalarHeader = {
  style: "|" | ">";
  /** Explicit indentation indicator, when the header carries one. */
  indent: number | null;
  /** `-` strip, `+` keep, `null` clip (the default). */
  chomp: "-" | "+" | null;
};

/**
 * Is the raw value a block-scalar header? `|` (literal) and `>` (folded),
 * with an optional indentation indicator and an optional chomping indicator
 * in either order — `|2-` and `|-2` both occur in the wild. Anything else is
 * a plain scalar, so a `|` with text after it (`| npm ci`) stays text.
 */
function blockScalarHeader(raw: string): BlockScalarHeader | null {
  const match = /^([|>])([0-9+-]*)$/.exec(raw);
  if (!match) return null;
  let indent: number | null = null;
  let chomp: "-" | "+" | null = null;
  for (const ch of match[2]!) {
    if (ch === "-" || ch === "+") chomp = ch;
    else {
      const digit = Number.parseInt(ch, 10);
      if (Number.isNaN(digit)) return null;
      indent = indent === null ? digit : indent * 10 + digit;
    }
  }
  return { style: match[1]! as "|" | ">", indent, chomp };
}

/**
 * The block under a block-scalar header: every following blank line, plus
 * every line indented deeper than the key's own indent. The next line at or
 * below that indent ends the block, so a sibling option or a new top-level
 * section is never swallowed.
 */
function collectBlockScalar(
  lines: string[],
  from: number,
  parentIndent: number,
): { body: string[]; next: number } {
  const body: string[] = [];
  let index = from;
  for (; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (line.trim() === "") {
      body.push(line);
      continue;
    }
    if (line.length - line.trimStart().length <= parentIndent) break;
    body.push(line);
  }
  return { body, next: index };
}

/**
 * Folded style (`>`): a single break between two ordinary lines becomes a
 * space, a blank line stays a break, and a more-indented line keeps its own
 * breaks (it is a literal chunk). Content is never dropped.
 */
function foldBlockScalar(core: string[]): string {
  let out = "";
  let previousWasFolded = false;
  for (const line of core) {
    if (line === "") {
      out += "\n";
      previousWasFolded = false;
      continue;
    }
    if (/^[ \t]/.test(line)) {
      out += `${line}\n`;
      previousWasFolded = false;
      continue;
    }
    if (previousWasFolded) out += " ";
    out += line;
    previousWasFolded = true;
  }
  // The last line's break belongs to the chomping indicator, not the body.
  return out.endsWith("\n") ? out.slice(0, -1) : out;
}

/**
 * Decode a block scalar into the value it denotes. The decoded text is
 * LITERAL: it is never re-read as a quoted scalar, so `post-start: |-\n  "a b"`
 * is the two-character-quoted command, not the unquoted one.
 */
function decodeBlockScalar(body: string[], header: BlockScalarHeader): string {
  let blockIndent = header.indent;
  if (blockIndent === null) {
    for (const line of body) {
      if (line.trim() === "") continue;
      blockIndent = line.length - line.trimStart().length;
      break;
    }
  }
  if (blockIndent === null) return ""; // nothing but blanks: an empty block
  const content = body.map((line) => (line.length >= blockIndent! ? line.slice(blockIndent!) : ""));
  let last = content.length;
  while (last > 0 && content[last - 1]!.trim() === "") last -= 1;
  const core = content.slice(0, last);
  const trailingBlanks = content.length - last;
  if (core.length === 0) return header.chomp === "+" ? "\n".repeat(trailingBlanks) : "";
  const joined = header.style === "|" ? core.join("\n") : foldBlockScalar(core);
  if (header.chomp === "-") return joined;
  if (header.chomp === "+") return `${joined}\n${"\n".repeat(trailingBlanks)}`;
  return `${joined}\n`; // clip: exactly one trailing break
}

/**
 * A mapping section (`x-tracker:`, `branch_patterns:`, ...) must open a mapping
 * on the following lines. Anything else on the header line is refused — and the
 * refusal NAMES the construct, because
 * bug-convention-parser-rejects-valid-yaml-force-rescaffolds showed what a
 * nameless refusal costs: `init --force` answered it by re-deriving the whole
 * file from the fixed scaffold. Flow style, anchors, aliases and tags are all
 * valid YAML this line parser does not read; a scalar is not a mapping.
 */
function requireEmptyMapping(sourcePath: string, key: string, rawValue: string): void {
  if (rawValue === "") return;
  throw new Error(
    `${sourcePath}: '${key}' must be a mapping, one option per line ` +
      `(got ${JSON.stringify(rawValue)}; this parser reads BLOCK style only — ` +
      `flow style { }, anchors (&id), aliases (*id) and tags (!!tag) are not supported)`,
  );
}

/**
 * Read one boolean option off its RAW token (comment stripped, still quoted):
 * only the exact tokens `true`/`false` are accepted, and a *quoted* boolean is
 * refused — `allow-steal: "true"` denotes the STRING "true", and reading an
 * arming flag (or an opt-out) out of a string is exactly how an armed gate
 * reads as unset (bug-convention-parser-rejects-valid-yaml-force-rescaffolds).
 * The YAML-1.1-only spellings (`yes`/`on`) are refused for the same reason.
 */
function parseBooleanOption(sourcePath: string, key: string, rawValue: string): boolean {
  if (rawValue !== "true" && rawValue !== "false") {
    throw new Error(`${sourcePath}: '${key}' must be a boolean (got ${JSON.stringify(rawValue)})`);
  }
  return rawValue === "true";
}

/**
 * Parse the tracker's `.convention.yml` (line-oriented, no YAML dependency).
 * Unknown top-level keys are ignored for forward compatibility;
 * `x-views` (saved views), `x-playbooks` (playbook staleness options),
 * `x-tracker` (tracker-hygiene options), `x-import` (issue-import options),
 * `x-worktree` (worktree-bootstrap options), `x-github` (GitHub round-trip
 * options), `x-friction` (adopter-friction opt-out) and `x-generated`
 * (generated-doc provenance) are the official namespaced extensions.
 * Throws with file context on malformed `branch_patterns`, `x-views`,
 * `x-playbooks`, `x-tracker`, `x-import`, `x-worktree`, or `x-github`; `x-generated`
 * parses tolerantly (machine-written state).
 *
 * bug-convention-parser-rejects-valid-yaml-force-rescaffolds: this is a LINE
 * parser, not a YAML parser, and the difference used to cost the adopter their
 * configuration — a valid-YAML file this reader refused was classified by
 * `init --force` as "unreadable or unparseable" and re-derived from the fixed
 * scaffold, wholesale. The tolerance is therefore deliberately widened for the
 * constructs a real YAML read handles without any judgement: a trailing
 * comment, a block scalar, and a quoted key. It is NOT widened where the
 * strictness protects an arming flag: a boolean option still accepts only the
 * exact tokens `true`/`false`, still refuses the YAML-1.1-only spellings
 * (`yes`/`on`, which YAML 1.2 reads as the STRING "yes"), and still refuses a
 * *quoted* boolean — accepting `allow-steal: "true"` is exactly how an armed
 * gate reads as unset. The parser also stays honest about what it cannot read
 * (flow style, anchors, aliases, tags): those are refused with a message that
 * names the construct, because a refusal an adopter cannot diagnose is the
 * first half of the same loss.
 */
export function parseConventionConfig(
  raw: string,
  sourcePath = `${TRACKER_DIR_NAME}/.convention.yml`,
): ConventionConfig {
  const branchPatterns: Record<ItemType, string> = { ...DEFAULT_BRANCH_PATTERNS };
  const views: Record<string, string> = {};
  const playbooks: PlaybooksConfig = { maxAgeDays: null };
  const tracker: TrackerConfig = {
    autoCommit: null,
    allowSteal: null,
    reapAckedOrphans: null,
    strictGateBins: null,
    strictWorktreeWrites: null,
    productAcceptance: null,
  };
  const generated: Record<string, GeneratedEntry> = {};
  let generatedProjectName: string | null = null;
  const importLabelTypes: Record<string, ItemType> = {};
  let importHasLabelTypes = false;
  const worktree: WorktreeConfig = {
    postStart: null,
    postStartShell: null,
    env: null,
    services: null,
  };
  const github: GitHubConfig = { issueRoundtrip: false };
  const friction: FrictionConfig = { capture: null };
  let version = CONVENTION_VERSION_DEFAULT;
  let section: string | null = null;
  let generatedDest: string | null = null;
  let importOption: string | null = null;

  const lines = raw.split(/\r?\n/);
  // A file's text ends with a newline; `split` turns that into one final empty
  // element that is not a line of the document. Dropping it keeps a `+`
  // (keep-chomping) block scalar from reading the file's own final newline as
  // one trailing blank line of its content.
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const indent = line.length - line.trimStart().length;
    const idx = line.indexOf(":");
    if (idx === -1) {
      throw new Error(
        `${sourcePath}: invalid line ${JSON.stringify(line)} (expected 'key: value')`,
      );
    }
    // A quoted key names the same section/option as the bare one ("x-tracker":
    // is x-tracker), so every key comparison reads the decoded form.
    const key = stripQuotes(line.slice(0, idx).trim());
    // The raw value text, comment stripped but still quoted: the arming
    // checks below compare against it, so a quoted boolean stays refused.
    let rawValue = stripInlineComment(line.slice(idx + 1).trim());
    let value = stripQuotes(rawValue);
    const header = blockScalarHeader(rawValue);
    if (header !== null) {
      // `post-start: |` and friends: the value is the indented block below
      // the key, not the indicator. Consume it here so its lines are never
      // read as keys (nor as comments), and keep the decoded text literal.
      const block = collectBlockScalar(lines, index + 1, indent);
      index = block.next - 1;
      rawValue = decodeBlockScalar(block.body, header);
      value = rawValue;
    }
    if (indent === 0) {
      section = null;
      generatedDest = null;
      importOption = null;
      if (key === "version") {
        const parsed = Number.parseInt(rawValue, 10);
        if (Number.isFinite(parsed)) version = parsed;
      } else if (key === "branch_patterns") {
        requireEmptyMapping(sourcePath, key, rawValue);
        section = "branch_patterns";
      } else if (key === "x-views") {
        requireEmptyMapping(sourcePath, key, rawValue);
        section = "x-views";
      } else if (key === "x-playbooks") {
        requireEmptyMapping(sourcePath, key, rawValue);
        section = "x-playbooks";
      } else if (key === "x-tracker") {
        requireEmptyMapping(sourcePath, key, rawValue);
        section = "x-tracker";
      } else if (key === "x-import") {
        requireEmptyMapping(sourcePath, key, rawValue);
        section = "x-import";
      } else if (key === "x-worktree") {
        requireEmptyMapping(sourcePath, key, rawValue);
        section = "x-worktree";
      } else if (key === "x-github") {
        requireEmptyMapping(sourcePath, key, rawValue);
        section = "x-github";
      } else if (key === "x-generated") {
        requireEmptyMapping(sourcePath, key, rawValue);
        section = "x-generated";
      } else if (key === "x-friction") {
        // The one namespaced extension whose SCALAR spelling is the documented
        // one: the spec, the ADR and the plan all write `x-friction: false`
        // (spec-friction-capture-020 §Opt-out, ADR 0024 §3). The mapping
        // spelling (`x-friction:` + a nested `capture:` option) is accepted
        // alongside it, so the section reads like its `x-*` siblings and an
        // unknown nested key is ignored per the extension policy. A scalar that
        // is not a boolean token is a parse error, exactly like every other
        // boolean option here — a quoted `"false"` denotes the STRING "false",
        // and reading an opt-out out of a string is how an opted-out tree
        // captures anyway.
        if (rawValue === "") {
          section = "x-friction";
          continue;
        }
        friction.capture = parseBooleanOption(sourcePath, key, rawValue);
      }
      continue;
    }
    if (section === "x-generated") {
      // Namespaced machine-written state (story-adoption-state): tolerant
      // parse — unknown fields are ignored (ignore-unknown) and incomplete
      // entries are kept as-is (a missing checksum simply never matches, so
      // the file reports as adopter-modified). Hand edits must never break
      // init or doctor.
      if (indent <= 2) {
        // x-generated.projectName (bug-project-name-dir-derived): the recorded
        // {{PROJECT_NAME}} value, one level above the per-destination entries.
        // A known scalar key, never a destination — hand-written legacy state
        // without it parses identically (ignore-unknown in reverse).
        if (key === "projectName") {
          generatedProjectName = value || null;
          continue;
        }
        const dest = key;
        generatedDest = dest !== "" ? dest : null;
        if (generatedDest !== null && !(generatedDest in generated)) {
          generated[generatedDest] = {
            template: "",
            checksum: "",
            arggonVersion: "",
            generatedAt: "",
          };
        }
        continue;
      }
      if (generatedDest === null) continue;
      const entry = generated[generatedDest]!;
      if (key === "template") entry.template = value;
      else if (key === "checksum") entry.checksum = value;
      else if (key === "arggonVersion") entry.arggonVersion = value;
      else if (key === "generatedAt") entry.generatedAt = value;
      // The raw token, not the decoded scalar: a quoted boolean is still False,
      // exactly as before (bug-convention-parser-rejects-valid-yaml-force-rescaffolds).
      else if (key === "acknowledged") entry.acknowledged = rawValue === "true";
      // Unknown nested keys are ignored.
      continue;
    }
    if (section === "x-playbooks") {
      // Namespaced extension: unknown nested keys are ignored (ignore-unknown),
      // only the official `max-age-days` option is read.
      if (key !== "max-age-days") continue;
      if (!/^\d+$/.test(rawValue) || Number.parseInt(rawValue, 10) <= 0) {
        throw new Error(
          `${sourcePath}: 'max-age-days' must be a positive integer (got ${JSON.stringify(rawValue)})`,
        );
      }
      playbooks.maxAgeDays = Number.parseInt(rawValue, 10);
      continue;
    }
    if (section === "x-tracker") {
      // Namespaced extension: unknown nested keys are ignored (ignore-unknown),
      // the official options are `auto-commit` (tracker hygiene), `allow-steal`
      // (claim-steal arming, bug-cli-steal-not-gated), `strict-gate-bins`
      // (strict start gate, task-start-gate-strict-mode),
      // `strict-worktree-writes` (single-writer enforcement,
      // task-single-writer-worktree-enforcement), `product-acceptance`
      // (product-acceptance recording, ADR 0021 §4) and `reap-acked-orphans`
      // (orphan-reaping arming, task-adapter-orphan-reaping).
      //
      // Every boolean option is matched on the RAW token, comment stripped but
      // still quoted (bug-convention-parser-rejects-valid-yaml-force-rescaffolds):
      // widening the parser for trailing comments must not also widen it for
      // quoting. `allow-steal: "true"` denotes the STRING "true", and reading an
      // arming flag out of a string is exactly how an armed gate reads as unset.
      if (key === "allow-steal") {
        if (rawValue !== "true" && rawValue !== "false") {
          throw new Error(
            `${sourcePath}: 'allow-steal' must be a boolean (got ${JSON.stringify(rawValue)})`,
          );
        }
        tracker.allowSteal = rawValue === "true";
        continue;
      }
      if (key === "strict-gate-bins") {
        if (rawValue !== "true" && rawValue !== "false") {
          throw new Error(
            `${sourcePath}: 'strict-gate-bins' must be a boolean (got ${JSON.stringify(rawValue)})`,
          );
        }
        tracker.strictGateBins = rawValue === "true";
        continue;
      }
      if (key === "strict-worktree-writes") {
        if (rawValue !== "true" && rawValue !== "false") {
          throw new Error(
            `${sourcePath}: 'strict-worktree-writes' must be a boolean (got ${JSON.stringify(rawValue)})`,
          );
        }
        tracker.strictWorktreeWrites = rawValue === "true";
        continue;
      }
      if (key === "product-acceptance") {
        if (rawValue !== "true" && rawValue !== "false") {
          throw new Error(
            `${sourcePath}: 'product-acceptance' must be a boolean (got ${JSON.stringify(rawValue)})`,
          );
        }
        tracker.productAcceptance = rawValue === "true";
        continue;
      }
      if (key === "reap-acked-orphans") {
        if (rawValue !== "true" && rawValue !== "false") {
          throw new Error(
            `${sourcePath}: 'reap-acked-orphans' must be a boolean (got ${JSON.stringify(rawValue)})`,
          );
        }
        tracker.reapAckedOrphans = rawValue === "true";
        continue;
      }
      if (key !== "auto-commit") continue;
      if (rawValue !== "true" && rawValue !== "false") {
        throw new Error(
          `${sourcePath}: 'auto-commit' must be a boolean (got ${JSON.stringify(rawValue)})`,
        );
      }
      tracker.autoCommit = rawValue === "true";
      continue;
    }
    if (section === "x-import") {
      // Namespaced extension (task-import-type-mapping): unknown option keys
      // are ignored (ignore-unknown); the official `label-types` option is a
      // nested mapping of GitHub label -> work-item type.
      if (indent <= 2) {
        importOption = key === "label-types" ? "label-types" : null;
        if (importOption !== null) {
          // An explicitly declared label-types option is "set" even with zero
          // entries (empty mapping = no label mapping, replacing the default).
          importHasLabelTypes = true;
          if (rawValue !== "") {
            throw new Error(`${sourcePath}: 'label-types' must be a mapping, one label per line`);
          }
        }
        continue;
      }
      if (importOption !== "label-types") continue;
      const label = key;
      if (!label) {
        throw new Error(`${sourcePath}: invalid x-import entry ${JSON.stringify(line)}`);
      }
      if (label in importLabelTypes) {
        throw new Error(`${sourcePath}: duplicate label '${label}' in x-import.label-types`);
      }
      const mapped = value;
      if (!isItemType(mapped)) {
        throw new Error(
          `${sourcePath}: 'label-types' values must be work-item types ` +
            `(initiative | epic | story | task | bug), got ${JSON.stringify(rawValue)} for label '${label}'`,
        );
      }
      importLabelTypes[label] = mapped;
      importHasLabelTypes = true;
      continue;
    }
    if (section === "x-worktree") {
      // Namespaced extension (task-start-post-hook): unknown nested keys are
      // ignored (ignore-unknown); the official `post-start` option is a shell
      // command run inside a freshly created worktree, `post-start-shell`
      // selects the shell variant, and `env` (spec
      // worktree-env-contract-016) opts out of the per-worktree env file.
      if (key === "post-start-shell") {
        // Shell variant (task-post-start-env): "inherit" (default) or "login"
        // ($SHELL -lc, sources profile files so rustup/mise/asdf toolchains
        // are on PATH). Anything else is a parse error.
        const shell = value;
        if (shell !== "inherit" && shell !== "login") {
          throw new Error(
            `${sourcePath}: 'post-start-shell' must be "inherit" or "login" (got ${JSON.stringify(rawValue)})`,
          );
        }
        worktree.postStartShell = shell;
        continue;
      }
      if (key === "env") {
        if (rawValue !== "true" && rawValue !== "false") {
          throw new Error(
            `${sourcePath}: 'env' must be a boolean (got ${JSON.stringify(rawValue)})`,
          );
        }
        worktree.env = rawValue === "true";
        continue;
      }
      if (key === "services") {
        // Compose reaping declaration (ADR 0019 layer 2,
        // task-cleanup-declared-services): `true` = the per-worktree Compose
        // project is named exactly the worktree id `<repo>-<item-id>`;
        // anything else non-empty is the adopter's base project name (reaped
        // as `<base>-<repo>-<item-id>`, lowercased — the adopter pattern's
        // `name: "<base>${WORKTREE_SUFFIX:-}"`); `false` = declaration
        // explicitly closed. Compose project names are `[a-z0-9][a-z0-9_-]*`
        // after lowercasing, so the declared base is validated here, at parse
        // time, against the same alphabet (uppercase allowed, lowercased at
        // derivation).
        if (rawValue === "true") {
          worktree.services = "true";
          continue;
        }
        if (rawValue === "false") {
          worktree.services = null;
          continue;
        }
        const base = value;
        if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(base)) {
          throw new Error(
            `${sourcePath}: 'services' must be true, false, or a Compose project base name ` +
              `([A-Za-z0-9][A-Za-z0-9_-]*, got ${JSON.stringify(rawValue)})`,
          );
        }
        worktree.services = base;
        continue;
      }
      if (key !== "post-start") continue;
      const command = value;
      if (!command) {
        throw new Error(
          `${sourcePath}: 'post-start' must be a non-empty string (got ${JSON.stringify(rawValue)})`,
        );
      }
      worktree.postStart = command;
      continue;
    }
    if (section === "x-github") {
      // Namespaced extension (task-issue-roundtrip): unknown nested keys are
      // ignored (ignore-unknown); the official `issue-roundtrip` option is a
      // boolean gate for closing the linked GitHub issue on a done flip.
      if (key !== "issue-roundtrip") continue;
      if (rawValue !== "true" && rawValue !== "false") {
        throw new Error(
          `${sourcePath}: 'issue-roundtrip' must be a boolean (got ${JSON.stringify(rawValue)})`,
        );
      }
      github.issueRoundtrip = rawValue === "true";
      continue;
    }
    if (section === "x-friction") {
      // Namespaced extension (ADR 0024 §3, plan T4): unknown nested keys are
      // ignored (ignore-unknown, forward compat); the official `capture` option
      // is the boolean capture opt-out the scalar spelling sets directly.
      if (key === "capture") {
        friction.capture = parseBooleanOption(sourcePath, "capture", rawValue);
        continue;
      }
      continue; // unknown nested key: ignored, never fatal
    }
    if (section === "x-views") {
      if (!key) {
        throw new Error(`${sourcePath}: invalid x-views entry ${JSON.stringify(line)}`);
      }
      if (key in views) {
        throw new Error(`${sourcePath}: duplicate view '${key}' in x-views`);
      }
      const expr = value;
      if (!expr) {
        throw new Error(`${sourcePath}: empty expression for view '${key}'`);
      }
      views[key] = expr;
      continue;
    }
    if (section !== "branch_patterns") continue;
    if (!isItemType(key)) {
      throw new Error(
        `${sourcePath}: unknown type '${key}' in branch_patterns (expected: initiative | epic | story | task | bug)`,
      );
    }
    const pattern = value;
    if (!pattern) {
      throw new Error(`${sourcePath}: empty pattern for type '${key}'`);
    }
    if (!pattern.includes("{id}")) {
      throw new Error(
        `${sourcePath}: pattern for type '${key}' must contain an {id} placeholder (got ${JSON.stringify(pattern)})`,
      );
    }
    branchPatterns[key] = pattern;
  }

  return {
    version,
    branchPatterns,
    views,
    playbooks,
    tracker,
    import: { labelTypes: importHasLabelTypes ? importLabelTypes : null },
    worktree,
    github,
    friction,
    generated,
    generatedProjectName,
  };
}

/** Read and parse the tracker's `.convention.yml`. Missing file yields version 0 + defaults. */
export function readConventionConfig(dir: string): ConventionConfig {
  const path = conventionPathForRoot(dir);
  if (!existsSync(path)) {
    return {
      version: CONVENTION_VERSION_DEFAULT,
      branchPatterns: { ...DEFAULT_BRANCH_PATTERNS },
      views: {},
      playbooks: { maxAgeDays: null },
      tracker: {
        autoCommit: null,
        allowSteal: null,
        reapAckedOrphans: null,
        strictGateBins: null,
        strictWorktreeWrites: null,
        productAcceptance: null,
      },
      import: { labelTypes: null },
      worktree: { postStart: null, postStartShell: null, env: null, services: null },
      github: { issueRoundtrip: false },
      friction: { capture: null },
      generated: {},
      generatedProjectName: null,
    };
  }
  return parseConventionConfig(readFileSync(path, "utf8"), path);
}

/**
 * Tolerant read of the `x-generated` provenance state. Unlike
 * `readConventionConfig` this never throws: a missing file or a malformed
 * `.convention.yml` yields an empty state (docs then count as
 * adopter-modified — the conservative default).
 */
export function readGeneratedState(dir: string): Record<string, GeneratedEntry> {
  const path = conventionPathForRoot(dir);
  if (!existsSync(path)) return {};
  try {
    return parseConventionConfig(readFileSync(path, "utf8"), path).generated;
  } catch {
    return {};
  }
}

/**
 * Tolerant read of the `x-friction` capture opt-out. Like
 * {@link readGeneratedState} this never throws: a missing file, an unreadable
 * one, or a `.convention.yml` this parser refuses yields `{ capture: null }`
 * (capture ON, the documented default).
 *
 * The direction is deliberate and it is the FAIL-OPEN one. A tree that opted
 * out with a token this reader refuses (`x-friction: yes`) is not silently
 * captured-and-forgotten: every OTHER surface that reads the config
 * (`list`, `show`, `validate`, `init`, …) already fails that file with the
 * named parse error, so the adopter sees it immediately. Refusing the friction
 * capture here too would turn one bad line into "ArggonManager's escape hatch
 * for broken tooling stopped working", which is exactly the friction this
 * channel exists to hear about.
 */
export function readFrictionConfig(dir: string): FrictionConfig {
  const path = conventionPathForRoot(dir);
  if (!existsSync(path)) return { capture: null };
  try {
    return parseConventionConfig(readFileSync(path, "utf8"), path).friction;
  } catch {
    return { capture: null };
  }
}

/**
 * Read the project name recorded under `x-generated.projectName`
 * (bug-project-name-dir-derived). Tolerant: missing file, missing key, or a
 * malformed `.convention.yml` yields `null` (legacy state — the caller falls
 * back to content-based recovery).
 */
export function readGeneratedProjectName(dir: string): string | null {
  const path = conventionPathForRoot(dir);
  if (!existsSync(path)) return null;
  try {
    return parseConventionConfig(readFileSync(path, "utf8"), path).generatedProjectName;
  } catch {
    return null;
  }
}

/**
 * Parse the `x-generated.projectName` scalar out of raw `.convention.yml`
 * text without touching the filesystem (task-init-dry-run-plan: the plan
 * must be able to resolve the recorded name against the state content the
 * caller is about to scaffold, not the not-yet-written file). `null` when
 * the key is absent or empty.
 */
export function parseGeneratedProjectName(raw: string): string | null {
  try {
    return parseConventionConfig(raw).generatedProjectName;
  } catch {
    return null;
  }
}

/**
 * Serialize one quoted YAML scalar (double quotes, YAML-escaped).
 * bug-convention-config-scalar-unescape: `JSON.stringify` escapes backslashes,
 * quotes and control characters (`\n`, NUL, ...); DEL and the JS/YAML line
 * separators are left raw by JSON and escaped explicitly with YAML escapes
 * `stripQuotes` decodes back. A decoded `\n` would otherwise be written raw,
 * splitting the line-oriented section and corrupting the file.
 */
function yamlQuote(value: string): string {
  return JSON.stringify(value)
    .replaceAll("\u007f", "\\x7F")
    .replaceAll("\u2028", "\\L")
    .replaceAll("\u2029", "\\P");
}

/** Quote a mapping key when it is not a plain safe path token. */
function yamlKey(key: string): string {
  return /^[A-Za-z0-9._/-]+$/.test(key) ? key : yamlQuote(key);
}

/**
 * Serialize the `x-generated` section (destinations sorted) for the given
 * provenance entries. `projectName` (bug-project-name-dir-derived) is
 * recorded once above the per-destination entries when non-null. Empty
 * entries with no projectName serialize as no section at all.
 */
export function serializeGeneratedSection(
  entries: Record<string, GeneratedEntry>,
  projectName: string | null = null,
): string[] {
  const dests = Object.keys(entries).sort();
  if (dests.length === 0 && projectName === null) return [];
  const lines: string[] = ["x-generated:"];
  if (projectName !== null) lines.push(`  projectName: ${yamlQuote(projectName)}`);
  for (const dest of dests) {
    const entry = entries[dest]!;
    lines.push(`  ${yamlKey(dest)}:`);
    lines.push(`    template: ${yamlQuote(entry.template)}`);
    lines.push(`    checksum: ${yamlQuote(entry.checksum)}`);
    lines.push(`    arggonVersion: ${yamlQuote(entry.arggonVersion)}`);
    lines.push(`    generatedAt: ${yamlQuote(entry.generatedAt)}`);
    // Acknowledged baselines (bug-ack-baseline-regen-loss) are recorded only
    // when set, so sections written before the flag stay byte-identical.
    if (entry.acknowledged) lines.push(`    acknowledged: true`);
  }
  return lines;
}

/**
 * Splice a fresh `x-generated` section into raw `.convention.yml` text,
 * replacing any existing section. Everything outside the section — version,
 * branch_patterns, x-views, x-playbooks, comments, blank lines, unknown keys —
 * is preserved byte-for-byte. `projectName` (bug-project-name-dir-derived) is
 * recorded once above the per-destination entries; `null`/`undefined` omits
 * it (and preserves legacy byte-identical serialization for callers that
 * never recorded one). With no entries and no projectName, an existing
 * section is removed.
 */
export function updateGeneratedSection(
  raw: string,
  entries: Record<string, GeneratedEntry>,
  projectName?: string | null,
): string {
  const lines = raw.split(/\r?\n/);
  const start = lines.findIndex((line) => /^x-generated:\s*$/.test(line));
  if (start !== -1) {
    let end = start + 1;
    while (
      end < lines.length &&
      (lines[end] === "" || lines[end]!.length - lines[end]!.trimStart().length > 0)
    ) {
      end++;
    }
    lines.splice(start, end - start);
  }
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  const section = serializeGeneratedSection(entries, projectName ?? null);
  if (section.length === 0) {
    return lines.length > 0 ? `${lines.join("\n")}\n` : "";
  }
  if (lines.length > 0) lines.push("");
  return `${[...lines, ...section].join("\n")}\n`;
}

/** Resolve a branch pattern for an item (`{id}` required, `{type}` optional). */
export function resolveBranchName(pattern: string, item: { id: string; type: ItemType }): string {
  return pattern.replaceAll("{id}", item.id).replaceAll("{type}", item.type);
}
