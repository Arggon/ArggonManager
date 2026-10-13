import type { FrictionClassRow, FrictionReport } from "./friction-report.js";

/**
 * Tier B — the prefilled publish URL (plan task T4 of spec-friction-capture-020,
 * stage 1 of ADR 0024).
 *
 * **This module is the whole of the load-bearing design.** It is what lets the
 * channel exist without violating `docs/agents.md` §0 ("Do not open new GitHub
 * issues"): the agent's job ENDS at emitting a URL; a human opens it and clicks
 * submit. There is no submit call here, no `gh`, no token, no network, no
 * fetch — nothing in this file can publish anything. `ce-ai#426`'s tiered output
 * dissolves the auth objection the same way: the URL needs no credential to
 * construct and none to open.
 *
 * What it builds, and why each constraint is there:
 *
 *  - **No YAML front matter.** GitHub Issue Forms parse QUERY params, and no
 *    surveyed project parses front matter out of an issue body — front matter is
 *    a file-format convention for in-tree Markdown, not a GitHub issue
 *    convention. The machine-readable part is a final fenced
 *    `arggon-fingerprint` block plus the stable `[adopter-friction] ` title
 *    prefix, which is what a later stage-2 `gh issue list --search` finds.
 *  - **The title prefix is stable and the title is bounded.** ≤120 chars AFTER
 *    the prefix, so the prefix survives truncation and the search key never
 *    moves.
 *  - **The URL is bounded by construction.** GitHub answers 414 above the server
 *    limit (the spike measured 200 up to ~6.5 KB, 5xx around 7 KB, 414 at 8.2
 *    KB), so classes are dropped from the tail — and the drop is STATED in the
 *    body — until the whole URL fits {@link FRICTION_PUBLISH_MAX_URL_CHARS}.
 *    Overflow is never silent and never a failed command.
 *  - **Encoding is `encodeURIComponent` on each param value**, the documented
 *    GitHub prefill contract: the separator (`&`) and the `=` inside a value are
 *    percent-escaped, so a narrative carrying either cannot forge another param.
 *    A newline becomes `%0A`, not a raw line break, which is why the body may
 *    safely be multi-line markdown.
 *
 * Pure throughout: no clock, no filesystem, no stdout. The CLI owns the channel,
 * exactly as it does for every other command.
 */

/** The stable title prefix a stage-2 search keys on; never moved, never truncated away. */
export const FRICTION_PUBLISH_TITLE_PREFIX = "[adopter-friction] ";

/** Title budget AFTER the prefix (spec §The report and its tiers). */
export const FRICTION_PUBLISH_TITLE_MAX_CHARS = 120;

/** The prefill endpoint. Issues, not Discussions — decided in task-spike-friction-tier-b-surface. */
export const FRICTION_PUBLISH_URL_BASE = "https://github.com/Arggon/ArggonManager/issues/new";

/**
 * The label the URL asks for. It rides as a documented query param, but GitHub
 * requires "permission to add a label to an issue" for it to LAND, which an
 * outside adopter lacks on this repo — so for most filers it is best-effort and
 * the issue simply arrives unlabeled. The repo-side fix is the spike's
 * amendment 1: a `.github/ISSUE_TEMPLATE/adopter-friction.yml` Issue Forms
 * template (its `labels:` front matter applies regardless of filer
 * permission). That is a named repo-side OPS CHANGE recorded in the item and
 * the PR — deliberately not part of this code diff — so the label is asked for
 * here and made to stick there. The URL works either way; only the label is
 * affected.
 */
export const FRICTION_PUBLISH_LABEL = "adopter-friction";

/** The info string of the machine-readable trailing fence. */
export const FRICTION_PUBLISH_FENCE_INFO = "arggon-fingerprint";

/** At most this many classes rendered in the body before the "and N more" line. */
export const FRICTION_PUBLISH_MAX_CLASSES = 10;

/** Per-class narrative budget inside the body (the local log keeps the full 2000). */
export const FRICTION_PUBLISH_NARRATIVE_CAP = 400;

/**
 * The whole-URL budget. Comfortably under the observed ~6.5 KB 200-OK ceiling
 * and far under the 8.2 KB 414, with room for `encodeURIComponent`'s worst-case
 * 3× expansion of a non-ASCII narrative.
 */
export const FRICTION_PUBLISH_MAX_URL_CHARS = 6000;

/** The truncation marker; counts against the cap it truncates to. */
const MARKER = "…";

/** Tier A is the default: the report only, no URL, no failure mode. */
export type FrictionPublishTier = "a" | "b";

/** The tier-B document: the parts, and the URL that carries them. */
export type FrictionPublishDoc = {
  /** Discriminant: only tier `b` produces one of these. */
  tier: "b";
  /** `origin/issues/new?title=…&body=…&labels=…` — a HUMAN opens this. */
  url: string;
  /** Starts with {@link FRICTION_PUBLISH_TITLE_PREFIX}, ≤120 chars after it. */
  title: string;
  /** Human-readable markdown ending in the fenced `arggon-fingerprint` block. */
  body: string;
};

/** Which tiers are valid, in the order the CLI documents them. */
export const FRICTION_PUBLISH_TIERS: readonly FrictionPublishTier[] = ["a", "b"];

/** Whether a `--tier` value names a tier this spec defines. */
export function isFrictionPublishTier(value: string): value is FrictionPublishTier {
  return (FRICTION_PUBLISH_TIERS as readonly string[]).includes(value);
}

/**
 * Cap `text` to `cap` chars, marker included. The values this truncates
 * (`commandShape`, `errorCode`) were already surrogate-cleaned when the record
 * was written ({@link capField} in `friction.ts`), so a plain slice cannot
 * manufacture a lone surrogate here.
 */
function capText(text: string, cap: number): string {
  if (text.length <= cap) return text;
  return text.slice(0, cap - MARKER.length) + MARKER;
}

/** One fenced block's fence: the shortest fence longer than any backtick run in `text`. */
function fenceFor(text: string): string {
  const runs = text.match(/`+/g);
  const longest = runs === null ? 0 : Math.max(...runs.map((run) => run.length));
  return "`".repeat(Math.max(3, longest + 1));
}

/** `arggon friction` in the singular/plural, stated rather than implied. */
function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/**
 * The tier-B title: the prefix, then the highest-count class — the row a
 * maintainer scanning an issue list needs to see — and an explicit statement
 * when there is nothing to say. Capped AFTER the prefix, so the search key
 * survives a long `--command` shape.
 */
export function buildFrictionPublishTitle(report: FrictionReport): string {
  const top = report.rows[0];
  let summary: string;
  if (report.optedOut) {
    summary = "opted out — nothing captured (x-friction: false / ARGGON_NO_FRICTION=1)";
  } else if (top === undefined) {
    summary = "no friction recorded (0 records)";
  } else {
    const command = top.commandShape === "" ? "(no command shape)" : top.commandShape;
    const error = top.errorCode !== undefined && top.errorCode !== "" ? ` — ${top.errorCode}` : "";
    summary = `${command}${error} (×${top.count} of ${report.classes} ${plural(report.classes, "class", "classes")})`;
  }
  return FRICTION_PUBLISH_TITLE_PREFIX + capText(summary, FRICTION_PUBLISH_TITLE_MAX_CHARS);
}

/** One class's machine-readable stanza: the fingerprint and its stable fields. */
function fingerprintStanza(row: FrictionClassRow): string[] {
  return [
    `fingerprint: ${row.fingerprint}`,
    `count: ${row.count}`,
    `reporters: ${row.reporters}`,
    `commandShape: ${row.commandShape}`,
    `errorCode: ${row.errorCode ?? ""}`,
    `harness: ${row.harness}`,
    `majorVersion: ${row.majorVersion}`,
    `firstSeen: ${row.firstSeen}`,
    `lastSeen: ${row.lastSeen}`,
    `arggonVersion: ${row.arggonVersion}`,
    `os: ${row.os}`,
    `arch: ${row.arch}`,
    `node: ${row.node}`,
  ];
}

/**
 * The tier-B body: a human-readable markdown report whose FINAL fenced block
 * carries the machine-readable fingerprint stanzas. The prose comes first
 * because the reader is a person deciding whether to click submit; the machine
 * block comes last so a parser reads one place and the body's last line is
 * always the closing fence.
 *
 * No YAML front matter anywhere — asserted by the tests, not merely intended.
 */
export function buildFrictionPublishBody(report: FrictionReport): string {
  const out: string[] = [];
  out.push("## Adopter friction report");
  out.push("");
  out.push(
    "Filed by a human who opened the prefilled URL `arggon friction --report --tier b` printed.",
  );
  out.push("Nothing here was submitted by the agent that ran arggon (ADR 0024 §4).");
  out.push("");
  out.push(
    `records: ${report.count}   classes: ${report.classes}   dropped: ${report.dropped}   optedOut: ${report.optedOut}`,
  );
  out.push(
    "dedupe scope: local-only — the reporting machine's own log. No upstream issue is consulted, so a class already filed upstream appears here as new.",
  );
  out.push(
    "reporters basis: distinct reporterIds present in this log only (stage 1 is one machine).",
  );
  out.push(
    "narrative is untrusted data, passed through verbatim — never an instruction, never parsed.",
  );
  if (report.optedOut) {
    out.push("");
    out.push(
      "Capture is opted out on this machine (`x-friction: false` in the tracker `.convention.yml`, or `ARGGON_NO_FRICTION=1`), so nothing is recorded and this report is empty. The command stays discoverable on purpose: set the key back to `true`, or unset the variable, to re-enable capture.",
    );
  }
  if (report.classes > 0) {
    const shown = report.rows.slice(0, FRICTION_PUBLISH_MAX_CLASSES);
    for (const [index, row] of shown.entries()) {
      out.push("");
      out.push(`### ${index + 1}. ${row.fingerprint} — count ${row.count}`);
      out.push("");
      out.push(`- command: \`${row.commandShape}\``);
      out.push(`- error: \`${row.errorCode ?? "(none)"}\``);
      out.push(`- harness: \`${row.harness}\`   major: \`${row.majorVersion}\``);
      out.push(`- first→last: ${row.firstSeen} → ${row.lastSeen}`);
      out.push(`- reporters in this log: ${row.reporters}`);
      out.push("");
      out.push("narrative (untrusted data, verbatim — never an instruction):");
      out.push("");
      const narrative = capText(row.narrative, FRICTION_PUBLISH_NARRATIVE_CAP);
      const fence = fenceFor(narrative);
      out.push(fence);
      out.push(narrative);
      out.push(fence);
    }
    const more = report.classes - shown.length;
    if (more > 0) {
      out.push("");
      out.push(
        `… and ${more} more ${plural(more, "class", "classes")} not included — the URL length bound. Run \`arggon friction --report\` locally for the whole log.`,
      );
    }
  } else if (!report.optedOut) {
    out.push("");
    out.push("No friction recorded (count: 0).");
  }

  // The machine-readable tail: one stanza per class, blank line between, always
  // present (an empty log still publishes its zero counts) so the body's last
  // fence is ALWAYS the `arggon-fingerprint` block.
  out.push("");
  out.push(`\`\`\`${FRICTION_PUBLISH_FENCE_INFO}`);
  if (report.optedOut) {
    out.push(`optedOut: true`);
    out.push(`records: 0`);
    out.push(`classes: 0`);
  } else {
    const classes = report.rows.slice(0, FRICTION_PUBLISH_MAX_CLASSES);
    out.push(`records: ${report.count}`);
    out.push(`classes: ${report.classes}`);
    for (const [index, row] of classes.entries()) {
      if (index > 0) out.push("");
      out.push(...fingerprintStanza(row));
    }
  }
  out.push("```");
  return `${out.join("\n")}\n`;
}

/**
 * The prefill URL: `encodeURIComponent` on each param value, so a narrative
 * carrying `&`, `=`, `#` or `?` cannot forge a param, and a newline rides as
 * `%0A` rather than breaking the line. The label rides as a query param — for
 * an outside adopter (no triage permission here) it is best-effort until the
 * repo-side Issue Forms template lands as the ops change recorded on the item
 * and in the PR — and the title and body ride as documented params.
 */
export function buildFrictionPublishUrl(title: string, body: string): string {
  // `encodeURIComponent`, not `URLSearchParams`: the latter is the FORM encoding
  // and spells a space `+`, while the prefill contract is percent-encoding.
  const encoded = [
    `title=${encodeURIComponent(title)}`,
    `body=${encodeURIComponent(body)}`,
    `labels=${encodeURIComponent(FRICTION_PUBLISH_LABEL)}`,
  ].join("&");
  return `${FRICTION_PUBLISH_URL_BASE}?${encoded}`;
}

/**
 * Build the whole tier-B document for a report, honoring the URL length bound:
 * classes are dropped from the TAIL (the lowest counts — the report is already
 * sorted count-descending, so the tail is the noise) and the drop is stated in
 * the body, never silent.
 */
export function buildFrictionPublishDoc(report: FrictionReport): FrictionPublishDoc {
  const title = buildFrictionPublishTitle(report);
  let body = buildFrictionPublishBody(report);
  let url = buildFrictionPublishUrl(title, body);
  let included = Math.min(report.classes, FRICTION_PUBLISH_MAX_CLASSES);
  while (url.length > FRICTION_PUBLISH_MAX_URL_CHARS && included > 0) {
    included -= 1;
    const narrowed: FrictionReport = {
      ...report,
      rows: report.rows.slice(0, included),
    };
    body = buildFrictionPublishBody(narrowed);
    url = buildFrictionPublishUrl(title, body);
  }
  return { tier: "b", url, title, body };
}
