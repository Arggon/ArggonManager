/**
 * The pinned small model the model-driven OpenCode smokes serve with — one
 * source for both harnesses.
 *
 * `opencode-smoke.ts` (full harness) and `opencode-wave.ts` (orchestration
 * wave) resolve their default from here, so a provider retiring the model is
 * one change plus a canary — never two scripts drifting apart
 * (bug-wave-smoke-retired-model-pin: the wave kept the retired
 * `opencode-go/deepseek-v4-flash` after the full smoke had already moved on).
 *
 * History: `deepseek-v4-flash` was retired by the provider
 * (`provider.no-route: Model unavailable`, 2026-10-14) and every full-smoke
 * session died before any model output; the same-family successor keeps the
 * pinned-small-model shape (bug-full-smoke-scenarios-precede-newer-gates).
 *
 * Overrides: `OPENCODE_SMOKE_MODEL` applies to both harnesses (they share the
 * model); `OPENCODE_WAVE_MODEL` is the wave's own override and wins there.
 */

/** The shared default model id (`<provider>/<model>`) both harnesses resolve. */
export const DEFAULT_OPENCODE_MODEL = "opencode-go/deepseek-v4.1-flash";

/** Model for the full smoke harness: shared override, else the shared default. */
export function resolveSmokeModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.OPENCODE_SMOKE_MODEL ?? DEFAULT_OPENCODE_MODEL;
}

/**
 * Model for the orchestration wave: the wave's own override wins over the
 * shared one, else the shared default.
 */
export function resolveWaveModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.OPENCODE_WAVE_MODEL ?? env.OPENCODE_SMOKE_MODEL ?? DEFAULT_OPENCODE_MODEL;
}
