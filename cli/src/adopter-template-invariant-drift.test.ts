/**
 * Adopter doc templates ↔ methodology carriers: invariant drift guard
 * (bug-adopter-engineering-template-software-locked).
 *
 * The defect this pins. `arggon init` writes a SECOND copy of the methodology
 * into every adopting repo: `templates/docs/**` becomes that project's
 * `AGENTS.md` / `ArggonManager/docs/convention.md` / `engineering.md` — the
 * files it reads FIRST, before anything else. Those templates are
 * hand-maintained and nothing tied them to the carriers
 * (`ArggonManager/docs/{agents,engineering,convention}.md` plus the README
 * methodology section), so they drifted in three visible ways:
 *
 *   - `templates/docs/docs/engineering.md` opened with a software-only
 *     operating principle ("code is cheap; good practices and sound software
 *     architecture are always important") and kept software nouns throughout,
 *     while ADR 0021 §6.2 declares a rule by **what the project declares** and
 *     the carriers say "any project — not only software";
 *   - `templates/docs/docs/convention.md` carried "Humans and agents follow the
 *     same rules" **verbatim** — the flat-parity invariant ADR 0021 §1
 *     superseded with the two-axis rule;
 *   - `templates/docs/AGENTS.md` named the pre-rename "coordinator" role.
 *
 * `cli/src/init-docs.test.ts` asserted the tier-2 templates were
 * adopter-owned, never that they agreed with the carriers, so every existing
 * gate stayed green while the templates taught a superseded, software-locked
 * bar. ADR 0016 then makes the wrong sentence permanent: `init` never
 * overwrites, and an acked or hand-edited doc is skipped on every re-run, so a
 * corrected template reaches NEW trees only and no existing adopter.
 *
 * What the guard asserts, in three clauses:
 *
 *  1. THE CARRIERS ARE ONE BLOCK. The four ADR 0020 carriers carry a
 *     byte-identical `- **Invariants:**` line (and one `- **Scope:**` line).
 *     Blockquote prefixes are normalized away, so the README's plain list
 *     items and the doc carriers' blockquote bullets are compared as the same
 *     block (before task-adopter-template-family-followups the parser saw only
 *     the blockquote form, so the README contributed nothing while the header
 *     claimed it did). Without this precondition "the carriers' invariant
 *     block" has no meaning, and a guard compared against a moving target
 *     would be theatre.
 *  2. THE FAMILY CANNOT CONTRADICT IT. Every file under the adopter template
 *     root — the governing templates AND the adapter-seam subtrees, whatever
 *     its extension — is walked as ONE set, not the one file that happened to
 *     break. The old Markdown-only filter is exactly how the pre-rename role
 *     word survived in `templates/docs/adapters/capability-matrix.json`
 *     (task-retired-role-words-product-text): a template `arggon init` copies
 *     byte-for-byte is a family member even when it is not `.md`. No member may
 *     carry the superseded flat-parity sentence, a retired agent id, or the
 *     pre-rename role word; a member that restates an invariant or the scope
 *     must restate it byte-identically to the carriers.
 *  3. THE FAMILY CANNOT SHRINK. Every member the guard leans on is required to
 *     exist — including one from each adapter-seam subtree — and the two that
 *     render into an adopting repo's carriers must carry the block, so the
 *     guard cannot be disarmed by deleting a template or by silently
 *     re-excluding a subtree, and the walk itself is asserted non-vacuous.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bundledTemplatesDir } from "./package-assets.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * The four ADR 0020 carriers (the README methodology section plus the three
 * declared doc carriers). PR #636 rewired their `- **Invariants:**` header
 * blocks to byte-identical text; that is the block the adopter templates must
 * not contradict. The README carries its copy as plain list items while the
 * three doc carriers quote it — `bulletsOf` normalizes the prefix away so all
 * four are actually compared.
 */
const CARRIERS = [
  "ArggonManager/docs/agents.md",
  "ArggonManager/docs/engineering.md",
  "ArggonManager/docs/convention.md",
  "README.md",
];

/**
 * The adapter-seam subtrees are part of the family. PR #758 excluded them
 * because the agent rename (PR #641) owned the seam ids; #641 merged, and the
 * exclusion only kept the exact defect this guard exists to catch — the
 * pre-rename "coordinator" at
 * `templates/docs/zcode/arggon/commands/arggon-goal.md` — out of the walk.
 * `REQUIRED_MEMBERS` names one file per subtree so the walk cannot silently
 * shrink back to the governing docs. The Claude Code seam
 * (spec-claude-code-adapter-024) joins on the same terms: it is a template
 * subtree `arggon init` copies into an adopting tree, so a pre-rename word or
 * a retired id inside it is exactly this guard's business.
 */
const SEAM_SUBTREES = [
  "templates/docs/opencode/",
  "templates/docs/zcode/",
  "templates/docs/claude/",
];

/**
 * The members the guard leans on. Required to exist so the guard cannot be
 * disarmed by deleting a template or by re-excluding a seam subtree.
 *
 * Path note: the item body named `templates/docs/docs/AGENTS.md` and
 * `templates/docs/docs/agents.md` — neither exists on disk. The adopter router
 * `AGENTS.md` lives at `templates/docs/AGENTS.md` (one level up: it renders to
 * the adopting repo's ROOT), and the family carries no `agents.md` at all: the
 * playbook a new tree reads is that same `AGENTS.md` plus the hand-maintained
 * `ArggonManager/docs/agents.md` in the carriers. `templates/docs/docs/` holds
 * exactly `convention.md`, `deploy.md`, `engineering.md`, `runbooks/`.
 */
const REQUIRED_MEMBERS = [
  "templates/docs/AGENTS.md",
  "templates/docs/docs/engineering.md",
  "templates/docs/docs/convention.md",
  "templates/docs/opencode/agents/arggon-delivery-lead.md",
  "templates/docs/zcode/arggon/commands/arggon-goal.md",
  // spec-claude-code-adapter-024 (task-claude-plugin-seam): one member from the
  // Claude Code seam, so the walk cannot shrink back to the older seams.
  "templates/docs/claude/arggon/README.md",
  // The non-Markdown member: a JSON template `arggon init` renders byte-for-byte
  // into an adopting tree (task-retired-role-words-product-text). Pinning it
  // here is what stops the walk from being narrowed back to `.md` — the filter
  // that let the pre-rename role word survive in this very file.
  "templates/docs/adapters/capability-matrix.json",
];

/** The two templates that render into an adopting repo's own carriers. */
const CARRIER_MEMBERS = ["templates/docs/docs/engineering.md", "templates/docs/docs/convention.md"];

/**
 * The retired agent ids of ADR 0021 §6.2a′ (`arggon-coordinator` →
 * `arggon-delivery-lead`, `arggon-worker` → `arggon-maker`,
 * `arggon-reviewer` → `arggon-standards-reviewer`, `arggon-prover` →
 * `arggon-verifier`). A template naming one names an id no seam materializes,
 * so the adopting tree would ship a file nothing answers to.
 */
const RETIRED_IDS = ["arggon-coordinator", "arggon-worker", "arggon-prover", "arggon-reviewer"];

/**
 * The pre-rename role word. Word-bounded so `coordinated` (SECURITY.md's
 * "coordinated disclosure") is not a false positive: the word is gone as a
 * ROLE, and ADR 0021 §6.1 ships "delivery lead" in its place.
 */
const PRE_RENAME_ROLE = /\bcoordinators?\b/i;

/**
 * The superseded flat-parity invariant (ADR 0021 §1). Matched over
 * whitespace-normalized text so a rewrapped paraphrase still fires: this is
 * the exact sentence the carriers replaced, so a template carrying it teaches
 * a rule the methodology withdrew.
 *
 * Deliberately the FULL sentence, never the fragment "follow the same rules":
 * README.md carries "agents follow the same rules" in a hooks-feature table
 * row, a different sentence about a different subject that must not fire.
 */
const SUPERSEDED_PARITY = "humans and agents follow the same rules";

/** The labelled bullets in one file, blockquote prefix normalized away. */
function bulletsOf(path: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const line of readFileSync(join(repoRoot, path), "utf8").split("\n")) {
    // The doc carriers quote the block (`> - **Scope:** …`) while the README
    // carries plain list items (`- **Scope:** …`); both forms must be seen, or
    // a carrier the parser cannot see weakens the "four carriers" claim.
    const match = /^(?:>\s*)?(- \*\*[^*]+\*\*.*)$/.exec(line.trim());
    // `- **Scope:** …` splits on `**` as ["- ", "Scope:", " …"] — the label
    // carries its own colon, which every lookup below drops.
    if (match) found.set(match[1]!.split("**")[1]!.replace(/:$/, ""), match[1]!);
  }
  return found;
}

/** One labelled bullet from one file, or null. */
function bulletOf(path: string, label: string): string | null {
  return bulletsOf(path).get(label) ?? null;
}

/** Whitespace-collapsed, lowercased — enough to catch a rewrapped paraphrase. */
function normalized(text: string): string {
  return text.replace(/\s+/g, " ").toLowerCase();
}

/**
 * Every file under the adopter doc-template root, as repo-relative paths —
 * `.md` and non-`.md` alike. The Markdown-only filter this walk used to carry
 * is exactly what let the pre-rename role word survive in
 * `templates/docs/adapters/capability-matrix.json`
 * (task-retired-role-words-product-text): `arggon init` copies that JSON into
 * an adopting tree byte-for-byte, so it is a family member by this guard's own
 * definition. `REQUIRED_MEMBERS` pins the JSON so the walk cannot be narrowed
 * back to Markdown without failing.
 */
function templateFamily(root: string): string[] {
  const templatesRoot = bundledTemplatesDir();
  const found: string[] = [];
  const walk = (absDir: string): void => {
    for (const entry of readdirSync(absDir).sort()) {
      const abs = join(absDir, entry);
      if (statSync(abs).isDirectory()) {
        walk(abs);
        continue;
      }
      found.push(`templates/${relative(templatesRoot, abs).split("\\").join("/")}`);
    }
  };
  walk(root);
  return found.sort();
}

describe("adopter templates follow the carriers' invariant block", () => {
  const familyRoot = join(bundledTemplatesDir(), "docs");
  const family = templateFamily(familyRoot);

  /** The carriers' blocks, read at run time: the single source of truth. */
  const carrierInvariants = new Set(
    CARRIERS.map((path) => bulletOf(path, "Invariants")).filter(
      (bullet): bullet is string => bullet !== null,
    ),
  );
  const carrierScopes = new Set(
    CARRIERS.map((path) => bulletOf(path, "Scope")).filter(
      (bullet): bullet is string => bullet !== null,
    ),
  );

  it("walks the whole family — never silently empty, and the seam subtrees are covered", () => {
    // A vacuous walk would make every clause below pass for free.
    expect(family.length).toBeGreaterThan(10);
    // Coverage runs the other way now: both seam subtrees exist and are IN the
    // walk, so the clauses below apply to them (PR #758 excluded them while
    // PR #641 owned the seam ids; that reason is gone).
    for (const seam of SEAM_SUBTREES) {
      expect(family.some((path) => path.startsWith(seam))).toBe(true);
    }
    // The members the guard leans on are in the walk, and on disk.
    for (const member of REQUIRED_MEMBERS) {
      expect(family).toContain(member);
    }
  });

  it("the four carriers carry ONE invariant block and ONE scope statement", () => {
    // Precondition: without byte-identical carriers there is no single block
    // for the templates to contradict. Every carrier must contribute — a
    // carrier the parser cannot see (README carried plain list items before
    // task-adopter-template-family-followups) would make the "four carriers"
    // claim broader than the assertion.
    expect(carrierInvariants.size).toBe(1);
    expect(carrierScopes.size).toBe(1);
    for (const path of CARRIERS) {
      expect(bulletOf(path, "Invariants"), `${path} must carry the invariant block`).not.toBeNull();
      expect(bulletOf(path, "Scope"), `${path} must carry the scope statement`).not.toBeNull();
    }
    // The domain-neutrality clause the adopter templates were missing: a rule
    // is named by what the project declares, never by software artifacts.
    expect(carrierScopes).toEqual(new Set(["- **Scope:** any project — not only software."]));
  });

  it("no family member carries the superseded parity sentence, a retired id, or the pre-rename role", () => {
    const failures: string[] = [];
    for (const path of family) {
      const raw = readFileSync(join(repoRoot, path), "utf8");
      const text = normalized(raw);
      if (text.includes(SUPERSEDED_PARITY)) {
        failures.push(
          `${path}: carries the superseded flat-parity sentence "${SUPERSEDED_PARITY}" — ` +
            `ADR 0021 §1 restated it as two axes (work-loop parity AND authority asymmetric and named)`,
        );
      }
      for (const id of RETIRED_IDS) {
        if (text.includes(id)) {
          failures.push(`${path}: names the retired agent id "${id}" (ADR 0021 §6.2a′)`);
        }
      }
      const role = PRE_RENAME_ROLE.exec(raw);
      if (role) {
        failures.push(
          `${path}: uses the pre-rename role word "${role[0]}" — ADR 0021 §6.1 ships "delivery lead"`,
        );
      }
    }
    expect(failures).toEqual([]);
  });

  it("a family member that restates an invariant or the scope restates it byte-identically to the carriers", () => {
    // The carriers are read at run time, so rewording a carrier without
    // rewording the templates that copy it fails here — the two cannot drift.
    const failures: string[] = [];
    for (const path of family) {
      for (const [label, bullet] of bulletsOf(path)) {
        if (label === "Invariants" && !carrierInvariants.has(bullet)) {
          failures.push(`${path}: - **Invariants:** diverges from the carriers' block`);
        }
        if (label === "Scope" && !carrierScopes.has(bullet)) {
          failures.push(`${path}: - **Scope:** diverges from the carriers' statement`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("the templates that render into an adopting repo's carriers carry the block themselves", () => {
    // So the guard cannot be dodged by deleting the block from a template.
    for (const path of CARRIER_MEMBERS) {
      expect(bulletOf(path, "Invariants"), `${path} must carry the invariant block`).not.toBeNull();
      expect(carrierInvariants.has(bulletOf(path, "Invariants")!)).toBe(true);
    }
  });

  it("the budget-bounded router (AGENTS.md) names both axes and points at a carrier", () => {
    // The generated AGENTS.md is a fixed per-session read with a 2 KB context
    // budget (cli/src/init-docs.test.ts), so it may POINT at the invariant
    // block instead of carrying it — but it must still name both axes of the
    // two-axis rule and hand the reader a carrier file.
    const raw = readFileSync(join(repoRoot, "templates/docs/AGENTS.md"), "utf8");
    const carrierLine = [...carrierInvariants][0]!;
    // Precondition: the axis words below are the carriers' own, so a carrier
    // reword fails here loudly instead of silently disarming the check.
    expect(normalized(carrierLine)).toContain("work-loop parity");
    expect(normalized(carrierLine)).toContain("authority asymmetric and named");
    expect(normalized(raw)).toContain("work-loop parity");
    expect(normalized(raw)).toContain("authority asymmetric and named");
    expect(raw).toMatch(/ArggonManager\/docs\/(engineering|convention)\.md/);
  });
});
