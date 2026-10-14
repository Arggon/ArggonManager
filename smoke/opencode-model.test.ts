import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_OPENCODE_MODEL, resolveSmokeModel, resolveWaveModel } from "./opencode-model.js";

// bug-wave-smoke-retired-model-pin: the provider retired
// `opencode-go/deepseek-v4-flash`. The full smoke moved to the canaried
// successor (bug-full-smoke-scenarios-precede-newer-gates); the wave script
// still pinned the retired id and would have failed the same way, in mass. The
// fix is ONE shared source both harnesses resolve — these tests pin the
// default, the documented overrides, and the no-re-pin rule that keeps the
// class from coming back. CI has no `opencode` binary, so the model-driven
// harnesses themselves cannot pin this shape.

const smokeDir = resolve(dirname(fileURLToPath(import.meta.url)));

describe("opencode-model: one pin for both model-driven harnesses", () => {
  it("resolves the same default for both harnesses when nothing overrides", () => {
    expect(resolveSmokeModel({})).toBe(DEFAULT_OPENCODE_MODEL);
    expect(resolveWaveModel({})).toBe(DEFAULT_OPENCODE_MODEL);
  });

  it("applies the shared override to both harnesses", () => {
    const env = { OPENCODE_SMOKE_MODEL: "provider/shared-override" };
    expect(resolveSmokeModel(env)).toBe("provider/shared-override");
    expect(resolveWaveModel(env)).toBe("provider/shared-override");
  });

  it("lets the wave's own override win there without changing the full smoke", () => {
    const env = {
      OPENCODE_SMOKE_MODEL: "provider/shared-override",
      OPENCODE_WAVE_MODEL: "provider/wave-override",
    };
    expect(resolveWaveModel(env)).toBe("provider/wave-override");
    expect(resolveSmokeModel(env)).toBe("provider/shared-override");
  });

  it("keeps the default a provider-qualified model id", () => {
    expect(DEFAULT_OPENCODE_MODEL).toMatch(/^[^/\s]+\/[^/\s]+$/);
  });
});

// The no-re-pin rule: a harness carrying its own model literal is how the two
// scripts drifted (the wave kept the retired pin after the full smoke moved
// on). The shared module is the only place a provider-qualified model id may
// appear.
describe("opencode-model: the harnesses never re-pin a model", () => {
  it.each(["opencode-smoke.ts", "opencode-wave.ts"])(
    "%s resolves its model through opencode-model and carries no provider id",
    (file) => {
      const source = readFileSync(join(smokeDir, file), "utf8");
      expect(source).toContain("./opencode-model.js");
      expect(source).not.toMatch(/["'`]opencode-go\//);
    },
  );
});
