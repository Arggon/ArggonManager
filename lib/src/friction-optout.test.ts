import { mkdirSync, mkdtempSync as _mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FRICTION_OPT_OUT_ENV, readFrictionOptOut, resolveFrictionOptOut } from "@arggondev/lib";

/**
 * The friction opt-out — ADR 0024 §3, plan task T4 of spec-friction-capture-020.
 *
 * Two things are pinned here and nowhere else:
 *
 *  1. **Precedence.** `ARGGON_NO_FRICTION` (per invocation) beats
 *     `x-friction: false` (tree-wide), mirroring `--no-commit` over
 *     `x-tracker.auto-commit`: the narrower scope is the one the operator just
 *     typed.
 *  2. **What it gates: capture, never discoverability.** The opt-out only ever
 *     answers "does a record get written" — nothing here removes the trigger
 *     from the generated agent files or hides the command from `--help`, and
 *     the CLI tests assert the carrier is untouched.
 */

describe("resolveFrictionOptOut", () => {
  it("captures by default (nothing set)", () => {
    expect(resolveFrictionOptOut({ capture: null }, {})).toEqual({ optedOut: false, source: null });
    expect(resolveFrictionOptOut({ capture: true }, {})).toEqual({
      optedOut: false,
      source: null,
    });
  });

  it("opts out on x-friction: false and on ARGGON_NO_FRICTION=1", () => {
    expect(resolveFrictionOptOut({ capture: false }, {})).toEqual({
      optedOut: true,
      source: "config",
    });
    expect(resolveFrictionOptOut({ capture: null }, { [FRICTION_OPT_OUT_ENV]: "1" })).toEqual({
      optedOut: true,
      source: "env",
    });
  });

  it("lets the per-invocation key WIN over the tree-wide one", () => {
    expect(resolveFrictionOptOut({ capture: false }, { [FRICTION_OPT_OUT_ENV]: "1" }).source).toBe(
      "env",
    );
    // …and the tree-wide key stands when the environment says nothing.
    expect(resolveFrictionOptOut({ capture: false }, {}).source).toBe("config");
  });

  it("treats an EMPTY env value as unset (the documented form is =1)", () => {
    expect(resolveFrictionOptOut({ capture: null }, { [FRICTION_OPT_OUT_ENV]: "" }).optedOut).toBe(
      false,
    );
  });

  it("provides no per-invocation opt-IN: the env key can only turn capture off", () => {
    // A tree that opted out at the config level re-enables by editing the
    // config, never by an ambient variable a wrapper shell may or may not set.
    expect(resolveFrictionOptOut({ capture: false }, { [FRICTION_OPT_OUT_ENV]: "" }).optedOut).toBe(
      true,
    );
    expect(resolveFrictionOptOut(null, {}).optedOut).toBe(false);
  });
});

describe("readFrictionOptOut", () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  /** A repo root whose `ArggonManager/.convention.yml` holds `text`. */
  function fixture(text: string): string {
    const root = _mkdtempSync(join(tmpdir(), "arggon-friction-optout-"));
    roots.push(root);
    mkdirSync(join(root, "ArggonManager"), { recursive: true });
    writeFileSync(join(root, "ArggonManager", ".convention.yml"), text, "utf8");
    return root;
  }

  it("reads the opt-out out of a real tracker .convention.yml", () => {
    // Both documented spellings converge on the same answer.
    const scalar = readFrictionOptOut(fixture("x-friction: false\n"), {});
    const mapping = readFrictionOptOut(fixture("x-friction:\n  capture: false\n"), {});
    expect(scalar.optedOut).toBe(true);
    expect(mapping.optedOut).toBe(true);
    expect(readFrictionOptOut(fixture("version: 5\n"), {}).optedOut).toBe(false);
    // The tolerant read never throws on a file this parser refuses.
    expect(readFrictionOptOut(fixture("x-friction: [oops\n"), {}).optedOut).toBe(false);
  });
});
