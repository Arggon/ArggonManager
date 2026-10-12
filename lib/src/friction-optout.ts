import { readFrictionConfig, type FrictionConfig } from "./convention.js";

/**
 * The friction opt-out — ADR 0024 §3, plan task T4 of spec-friction-capture-020.
 *
 * Two keys, one meaning, and the precedence between them is the part that is
 * easy to get wrong:
 *
 *  1. `ARGGON_NO_FRICTION` (per invocation) — the off-switch an operator can
 *     reach without editing the repo. Any NON-EMPTY value opts out; the
 *     documented form is `ARGGON_NO_FRICTION=1`, an empty value reads as unset.
 *     The rule mirrors the update channel's `ARGGON_NO_UPDATE_CHECK`
 *     (spec-update-channel-023: "opt-out = value !== \"\""), which ADR 0024 §3
 *     names as the precedent — one spelling, not two.
 *  2. `x-friction: false` in the tracker `.convention.yml` (tree-wide).
 *
 * The per-invocation key WINS, mirroring `--no-commit` over
 * `x-tracker.auto-commit`: the narrower scope is the one the operator just
 * typed. There is deliberately NO per-invocation opt-IN — the env key can only
 * turn capture off, so a tree that opted out at the config level re-enables by
 * editing the config, never by an ambient variable a wrapper shell may or may
 * not have set.
 *
 * **What the opt-out gates: capture, never discoverability** (ADR 0024 §3).
 * It suppresses the WRITE (no record appended) and empties the report. It does
 * not remove the trigger block from the generated agent files, does not hide
 * `arggon friction` from `--help` or the bundled skill, and does not make the
 * command undiscoverable: an adopter who opted out and later wants the channel
 * back must be able to find it, and an agent that cannot see the rule cannot
 * tell the user it exists. This is the one place the exploration's own evidence
 * overrides the usual "respect the opt-out completely" instinct, and the ADR
 * records it as deliberate.
 */

/** The per-invocation opt-out environment variable (mirrors `ARGGON_NO_UPDATE_CHECK`). */
export const FRICTION_OPT_OUT_ENV = "ARGGON_NO_FRICTION";

/** Which key turned capture off. */
export type FrictionOptOutSource = "env" | "config";

/** The resolved opt-out state: what a machine acts on, plus where it came from. */
export type FrictionOptOut = {
  /** True when capture is disabled and `--report` renders empty. */
  optedOut: boolean;
  /** The key that decided it, or `null` when nothing did (capture is on). */
  source: FrictionOptOutSource | null;
};

/**
 * Resolve the opt-out from an already-read config plus an environment. Pure, so
 * the precedence is testable without a filesystem fixture.
 */
export function resolveFrictionOptOut(
  config: FrictionConfig | null,
  env: NodeJS.ProcessEnv,
): FrictionOptOut {
  // Per invocation first: the narrower scope wins, exactly like `--no-commit`.
  const fromEnv = env[FRICTION_OPT_OUT_ENV];
  if (fromEnv !== undefined && fromEnv !== "") {
    return { optedOut: true, source: "env" };
  }
  const capture = config?.capture ?? null;
  if (capture === false) {
    return { optedOut: true, source: "config" };
  }
  return { optedOut: false, source: null };
}

/**
 * Resolve the opt-out for a repo root: the tolerant config read plus the
 * caller's environment. The `source` names which key decided it so the human
 * line can tell an operator WHAT to undo — an opt-out whose remediation is not
 * named is a trap.
 */
export function readFrictionOptOut(dir: string, env: NodeJS.ProcessEnv): FrictionOptOut {
  return resolveFrictionOptOut(readFrictionConfig(dir), env);
}
