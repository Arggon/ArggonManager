import { describe, expect, it } from "vitest";
import { carriesFrictionTrigger, isManagedAgentDest, readFrictionTrigger } from "@arggondev/lib";

/**
 * The marked trigger-block reader — ADR 0024 §2, task-friction-trigger-carrier.
 *
 * Two questions, one marker, and the boundary between them is the whole point:
 * a TEMPLATE asks "does this seam ship the block" (which decides the carrier set
 * `doctor` reports), a GENERATED FILE asks "does it carry it and at which
 * version" (which is what the compliance spike observes). Conflating them would
 * report an adopter's stale file as current, or a source as a generated file.
 */
/**
 * The token `renderDocPlaceholders` resolves into the block. Spelled out here and
 * deliberately NOT exported by the lib: this module's source is inlined into the
 * plugin bundle, and the bundle is itself rendered — a literal token in lib code
 * would be rewritten inside the bundle and mark every vendored copy drifted.
 */
const UNRESOLVED = "<arggonVersion>";

describe("carriesFrictionTrigger", () => {
  it("sees the block in a template and in a rendered file alike", () => {
    const template = `<!-- arggon:friction-trigger begin triggerVersion=${UNRESOLVED} -->\n\ntext\n<!-- arggon:friction-trigger end -->\n`;
    const rendered = template.replaceAll(UNRESOLVED, "0.10.0");
    expect(carriesFrictionTrigger(template)).toBe(true);
    expect(carriesFrictionTrigger(rendered)).toBe(true);
  });

  it("does not see the phrase in prose, or a half-written block", () => {
    expect(carriesFrictionTrigger("do not run `arggon friction` here")).toBe(false);
    expect(carriesFrictionTrigger("<!-- arggon:friction-trigger begin triggerVersion=0.10.0")).toBe(
      false,
    );
    expect(carriesFrictionTrigger("")).toBe(false);
  });
});

describe("readFrictionTrigger", () => {
  it("reads the version a rendered file carries", () => {
    const text =
      "<!-- arggon:friction-trigger begin triggerVersion=0.10.0 -->\n…\n<!-- arggon:friction-trigger end -->";
    expect(readFrictionTrigger(text)).toEqual({ present: true, triggerVersion: "0.10.0" });
  });

  it("reads a template's unresolved placeholder verbatim", () => {
    const text = `<!-- arggon:friction-trigger begin triggerVersion=${UNRESOLVED} -->`;
    expect(readFrictionTrigger(text)).toEqual({
      present: true,
      triggerVersion: UNRESOLVED,
    });
  });

  it("reports absent rather than guessing a version", () => {
    expect(readFrictionTrigger("nothing here")).toEqual({ present: false, triggerVersion: null });
    // The block present but with no attribute is reported present, version null:
    // "seen" without a version is not "never seen", and the two must not merge.
    expect(
      readFrictionTrigger(
        "<!-- arggon:friction-trigger begin -->\nx\n<!-- arggon:friction-trigger end -->",
      ),
    ).toEqual({ present: true, triggerVersion: null });
  });

  it("reads the FIRST marker when a file somehow carries two", () => {
    // A double block is a malformed file, not a version dispute: the reader does
    // not try to be clever about it. One marker per file is what the templates
    // write, and a second one is an adopter edit the file's own history explains.
    const text = [
      "<!-- arggon:friction-trigger begin triggerVersion=0.8.0 -->",
      "<!-- arggon:friction-trigger end -->",
      "<!-- arggon:friction-trigger begin triggerVersion=0.10.0 -->",
      "<!-- arggon:friction-trigger end -->",
    ].join("\n");
    expect(readFrictionTrigger(text)).toEqual({ present: true, triggerVersion: "0.8.0" });
  });
});

describe("isManagedAgentDest", () => {
  it("accepts an agent file in every seam arggon materializes", () => {
    expect(isManagedAgentDest(".opencode/agents/arggon-maker.md")).toBe(true);
    expect(isManagedAgentDest(".claude-marketplace/arggon/agents/arggon-maker.md")).toBe(true);
    expect(isManagedAgentDest(".zcode-marketplace/arggon/agents/arggon-maker.md")).toBe(true);
  });

  it("rejects anything an agent does not load as its contract", () => {
    expect(isManagedAgentDest(".opencode/commands/arggon-next.md")).toBe(false);
    expect(isManagedAgentDest("AGENTS.md")).toBe(false);
    expect(isManagedAgentDest(".agents/skills/arggon-cli/SKILL.md")).toBe(false);
    expect(isManagedAgentDest(".opencode/agents/arggon-maker.md.bak")).toBe(false);
  });
});
