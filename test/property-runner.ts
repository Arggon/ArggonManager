/**
 * Bounded, deterministic `fast-check` runner for the kernel property suite
 * (task-fast-check-invariant-properties).
 *
 * Policy (the acceptance line "small reusable bounded runner or deterministic
 * seed/replay policy for normal CI"):
 *
 * - **Bounded runs.** `DEFAULT_PROPERTY_RUNS` is deliberately small so ordinary
 *   `npm test` stays fast; `ARGGON_PROPERTY_RUNS` raises it for a deliberate
 *   soak run. No property sets its own unbounded default.
 * - **Fixed seed.** The default seed is a constant, so an ordinary CI run is
 *   byte-reproducible: the same inputs are generated on every machine and every
 *   run. `ARGGON_PROPERTY_SEED` replays one specific run exactly.
 * - **Replay on failure.** fast-check shrinks to a counterexample and prints its
 *   own seed; `checkProperty` re-throws with an explicit
 *   `ARGGON_PROPERTY_SEED=… ARGGON_PROPERTY_RUNS=… npm run test:property`
 *   header so a failure is replayable without reading the shrink report.
 * - **No retry loop.** `endOnFailure` stops at the first failing run: a property
 *   suite that needs retries to be green is not a gate.
 * - **One line of evidence per property**, printed once, so the run counts and
 *   seeds actually reach the test output (and therefore the PR).
 *
 * Properties use only values produced by their own arbitraries — no
 * `Math.random`, no clocks — so a seed replays a run exactly. Test files must
 * not weaken an invariant to make a run pass: a counterexample is a finding
 * about the kernel (file it as a bug), not a generator to narrow.
 */
import fc from "fast-check";
import type { IProperty } from "fast-check";

/** Env var that pins the generator seed for an exact replay. */
export const PROPERTY_SEED_ENV = "ARGGON_PROPERTY_SEED";
/** Env var that raises (or lowers) the run count for a deliberate soak. */
export const PROPERTY_RUNS_ENV = "ARGGON_PROPERTY_RUNS";

/**
 * Fixed default seed. Ordinary CI must be reproducible, so this is a constant
 * rather than `Date.now()` (fast-check's default): the same property inputs are
 * generated on every run, and a flake is never mistaken for a fresh sample.
 */
export const DEFAULT_PROPERTY_SEED = 20_260_928;

/**
 * Small run count. Every property file is pure in-process kernel work (or a
 * handful of tmpdir operations), so 25 runs per property is a few hundred
 * milliseconds; the example-based suites stay authoritative for concrete
 * contracts.
 */
export const DEFAULT_PROPERTY_RUNS = 25;

const logged = new Set<string>();

function positiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer (got ${JSON.stringify(raw)})`);
  }
  return value;
}

/** The seed every property runs with unless it overrides it. */
export function propertySeed(): number {
  return positiveIntEnv(PROPERTY_SEED_ENV, DEFAULT_PROPERTY_SEED);
}

/** The run count every property uses unless it overrides it. */
export function propertyRuns(): number {
  return positiveIntEnv(PROPERTY_RUNS_ENV, DEFAULT_PROPERTY_RUNS);
}

export type PropertyOptions = {
  /** Per-property run count (still bounded; the env default applies otherwise). */
  readonly numRuns?: number;
  /** Per-property seed override (the env default applies otherwise). */
  readonly seed?: number;
};

/**
 * Assert one property under the bounded, seeded policy above. `label` is a
 * short property id used in the configuration line and in the replay header.
 */
export function checkProperty<Ts>(
  label: string,
  property: IProperty<Ts>,
  options: PropertyOptions = {},
): void {
  const numRuns = options.numRuns ?? propertyRuns();
  const seed = options.seed ?? propertySeed();
  if (!logged.has(label)) {
    logged.add(label);
    console.log(
      `[property] ${label}: ${numRuns} runs, seed ${seed} ` +
        `(replay: ${PROPERTY_SEED_ENV}=${seed} ${PROPERTY_RUNS_ENV}=${numRuns} npm run test:property)`,
    );
  }
  try {
    fc.assert(property, { numRuns, seed, endOnFailure: true } satisfies fc.Parameters<Ts>);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[property:${label}] counterexample found — replay with ` +
        `${PROPERTY_SEED_ENV}=${seed} ${PROPERTY_RUNS_ENV}=${numRuns} npm run test:property\n${detail}`,
      { cause: err },
    );
  }
}

/**
 * Re-exported so a test file needs one import: this module owns the library
 * surface the property suite is allowed to use.
 */
export { fc };
