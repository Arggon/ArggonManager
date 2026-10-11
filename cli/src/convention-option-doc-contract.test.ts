/**
 * Namespaced-extension option lists ↔ convention.md doc contract
 * (bug-x-tracker-option-list-has-no-doc-drift-guard).
 *
 * `ArggonManager/docs/convention.md` enumerates each namespaced extension's
 * official options in prose, and `cli/src/convention.test.ts` asserts only
 * parsing behaviour. Nothing linked the two, so `x-tracker.product-acceptance`
 * shipped implemented-but-undocumented through PR #637's green CI: the flag
 * lived in the kernel (`lib/src/convention.ts`, `TrackerConfig`) while
 * §Tracker hygiene still named four options, and only a worker's escalation
 * caught it. That is the same class as the ADR-index drift
 * `adr-index-parity.test.ts` pins.
 *
 * Every list checked here is DERIVED, never restated — a guard that restates
 * the list in the test is the same bug one level down. Option names come from
 * the kernel's exported config type, from the parser's own `key === "…"`
 * branches, and from the runtime default object; doc names come from the doc's
 * sentences. The only literals are the section↔type↔projection table below
 * (structure, not content) and the escape-hatch marker.
 *
 *   1. ONE SOURCE, THREE FACES AGREE. The type's members (kebab-cased), the
 *      keys the parser reads and the keys of the runtime default object are the
 *      same set, and the type's own `boolean` members are exactly the parser's
 *      boolean-validated options — so a new option cannot live in one face of
 *      the kernel alone.
 *   2. EVERY OPTION THE PARSER READS IS DOCUMENTED. The doc section's
 *      enumeration sentence ("the official options today are …") must name each
 *      key. This is the kernel→doc direction, the PR #637 failure mode.
 *   3. THE BOOLEAN PARSE-ERROR SENTENCE IS EXACT, BOTH DIRECTIONS. The keys it
 *      enumerates as "a `k` … value that is not `true`/`false`" are exactly the
 *      boolean-validated options: a boolean option that ships outside the
 *      sentence fails (the same gap one clause down — `x-worktree.env` and
 *      `x-github.issue-roundtrip` are boolean-validated while their sentences
 *      enumerated neither), and a key claimed there that is not a boolean option
 *      fails too. The sentence's own delimiters make the window exact, so both
 *      directions are safe to assert on it.
 *
 * The escape hatch: an option that ships deliberately undocumented carries
 * `undocumented-by-design` on its parse branch in `lib/src/convention.ts`; only
 * marked keys are exempt from rules 2 and 3, and `convention.md` §Tracker
 * hygiene documents the marker, so the choice stays visible in the branch diff.
 *
 * Deliberate narrowing, stated so it cannot be mistaken for coverage: rule 2's
 * reverse direction (a doc line naming an option the parser does not read) is
 * checked over HYPHENATED names only. The enumeration sentence's trailing gloss
 * is prose that legitimately backticks non-option words — `x-github` ends
 * "… flipped to `done`" — so a whole-sentence reverse check fires on correct
 * prose, and a gate that fires on correct prose gets deleted rather than fixed.
 * Every multi-word option in the convention is kebab-case; the two single-word
 * options (`x-worktree.env`, `x-worktree.services`) are covered kernel→doc by
 * rule 2, and the boolean one by rule 3. Carriers outside
 * `ArggonManager/docs/convention.md` (the README's bug-note flag list, the
 * kernel's own comments) are not pinned: a dated bug note describes what was
 * true when it was written.
 *
 * Scope: the `x-*` subsections of convention.md that own a FIXED, kernel-read
 * option registry. `x-views` (the parser accepts any view name — the option set
 * is the adopter's) and `x-generated` (machine-written state, tolerant by
 * design) are excluded in `UNGUARDED_SECTIONS`; a new documented `x-*` section
 * must join `SECTIONS` or that table, and the section test says which.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseConventionConfig, type ConventionConfig } from "@arggondev/lib";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const kernelSource = readFileSync(join(repoRoot, "lib/src/convention.ts"), "utf8");
const docSource = readFileSync(join(repoRoot, "ArggonManager/docs/convention.md"), "utf8");

/** camelCase → kebab-case: the spelling `.convention.yml` uses for option keys. */
function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** One guarded extension: its section key, its kernel type and its projection. */
interface Section {
  /** The `.convention.yml` section key, and the doc's `### … (`x-name`)` heading. */
  key: string;
  /** The kernel's exported config type declaring the section's options. */
  type: string;
  /** Where the parsed options land on the `ConventionConfig`. */
  read: (config: ConventionConfig) => object;
}

/**
 * The extensions with a fixed, kernel-owned option registry. Structure only:
 * no option name appears here. `x-views` and `x-generated` are the two
 * documented `x-*` sections with no kernel list to derive
 * (`UNGUARDED_SECTIONS` carries their reasons).
 */
const SECTIONS: readonly Section[] = [
  { key: "x-tracker", type: "TrackerConfig", read: (config) => config.tracker },
  { key: "x-playbooks", type: "PlaybooksConfig", read: (config) => config.playbooks },
  { key: "x-import", type: "ImportConfig", read: (config) => config.import },
  { key: "x-worktree", type: "WorktreeConfig", read: (config) => config.worktree },
  { key: "x-github", type: "GitHubConfig", read: (config) => config.github },
];

/**
 * Documented `x-*` sections the guard deliberately does not cover, each with
 * the reason. An exclusion for a subsection the doc does not even carry fails
 * the section test below, so the table cannot rot into a stale claim.
 */
const UNGUARDED_SECTIONS: Readonly<Record<string, string>> = {
  "x-views":
    "open vocabulary: the parser accepts any view name, so the option set is the adopter's, not the kernel's",
  "x-generated": "machine-written state with a tolerant parse and no adopter-facing option list",
};

/**
 * `if (section === "x-tracker") {` — the parser's section dispatch. Any indent:
 * the kernel both dispatches each section at the top of the branch chain and
 * handles its options in a per-section block further down; the walk below takes
 * the last dispatch's block, which is the handler, so a reorder that empties one
 * fails the suite rather than silently reading nothing.
 */
const SECTION_DISPATCH = /^\s*if \(section === "(x-[a-z-]+)"\) \{$/;
/** `key === "auto-commit"` / `key !== "max-age-days"` — a branch that reads an option. */
const KEY_BRANCH = /key [!=]== "([a-z0-9-]+)"/g;
/** `'allow-steal' must be a boolean` — the boolean validation's own error text. */
const BOOLEAN_ERROR = /'([a-z0-9-]+)' must be a boolean/;
/** The escape hatch, documented in convention.md §Tracker hygiene. */
const UNDOCUMENTED_BY_DESIGN = "undocumented-by-design";

/** One section's parse branches: which options the parser reads, and how. */
interface ParsedSection {
  /** Every option key the section reads, in source order, with its exemption. */
  keys: { name: string; exempt: boolean }[];
  /** Every option whose value the parser validates as a boolean. */
  booleans: Set<string>;
}

/**
 * Walk the kernel line by line, associating each parse branch with the section
 * dispatch it sits under. Pure over `source`, so the premise test can run it
 * over synthetic branches and prove the exemption logic really works.
 */
function readKernelSections(source: string = kernelSource): Map<string, ParsedSection> {
  const sections = new Map<string, ParsedSection>();
  let current: ParsedSection | null = null;
  for (const line of source.split("\n")) {
    const dispatch = line.match(SECTION_DISPATCH);
    if (dispatch) {
      current = { keys: [], booleans: new Set<string>() };
      sections.set(dispatch[1]!, current);
      continue;
    }
    if (current === null) continue;
    for (const branch of line.matchAll(KEY_BRANCH)) {
      current.keys.push({ name: branch[1]!, exempt: line.includes(UNDOCUMENTED_BY_DESIGN) });
    }
    const boolean = line.match(BOOLEAN_ERROR);
    if (boolean) current.booleans.add(boolean[1]!);
  }
  return sections;
}

/** `### Tracker hygiene (`x-tracker`)` — how convention.md opens each extension. */
const DOC_HEADING = /^### [^`]*`(x-[a-z-]+)`/;
/** The enumeration sentence's opening: "the official options today are ". */
const ENUMERATION_ANCHOR = /the (?:only )?official options?(?: today)? (?:is|are) /;
/**
 * The parse-error sentence's boolean window: "or an `k1`/`k2` value that is not
 * `true`/`false`". Deliberately anchored on the doc's own wording, so the two
 * directions of rule 3 read exactly what the sentence claims and nothing else.
 */
const BOOLEAN_WINDOW = /or an ((?:`[a-z0-9-]+`\/)*`[a-z0-9-]+`) value that is not `true`\/`false`/;

/** Every `x-*` subsection of the doc: section key → body, heading excluded. */
function docSections(): Map<string, string> {
  const sections = new Map<string, string>();
  let name: string | null = null;
  let body: string[] = [];
  const flush = () => {
    if (name !== null) sections.set(name, body.join("\n"));
  };
  for (const line of docSource.split("\n")) {
    const heading = line.match(DOC_HEADING);
    if (heading) {
      flush();
      name = heading[1]!;
      body = [];
      continue;
    }
    if (name !== null) body.push(line);
  }
  flush();
  return sections;
}

/** The paragraph that opens a section — the enumeration sentence lives there. */
function introParagraph(sectionBody: string, section: string): string {
  const paragraph = sectionBody.split(/\n[ \t]*\n/).find((block) => block.trim().length > 0);
  expect(
    paragraph,
    `convention.md: \`${section}\` has no opening paragraph to read the option list from`,
  ).toBeTruthy();
  return paragraph!;
}

/** The backticked option names in the section's enumeration clause. */
function documentedOptions(sectionBody: string, section: string): string[] {
  const intro = introParagraph(sectionBody, section);
  const anchor = intro.match(ENUMERATION_ANCHOR);
  expect(
    anchor,
    `convention.md: \`${section}\` opening paragraph has no "official option(s) … is/are" ` +
      `enumeration (read: "${intro.slice(0, 100)}…") — the test derives its expected list ` +
      `from the kernel, so the doc must keep naming its options in that sentence`,
  ).toBeTruthy();
  const clause = intro.slice(anchor!.index! + anchor![0].length);
  return [...clause.matchAll(/`([a-z0-9-]+)`/g)].map((match) => match[1]!);
}

/** The option names the section's parse-error sentence enumerates as boolean-only. */
function documentedBooleans(sectionBody: string): string[] {
  const window = sectionBody.match(BOOLEAN_WINDOW);
  return window?.[1]?.split("/").map((name) => name.replaceAll("`", "")) ?? [];
}

/**
 * The members of an exported kernel config type, from its declaration in the
 * kernel source: option names (kebab) and its `boolean` members.
 */
function typeMembers(type: string): { names: string[]; booleans: string[] } {
  const block = kernelSource.match(new RegExp(`export type ${type} = \\{[\\s\\S]*?\\n\\};`));
  expect(
    block,
    `lib/src/convention.ts: no \`export type ${type} = { … };\` declaration to derive from`,
  ).toBeTruthy();
  const body = block![0]!;
  return {
    names: [...body.matchAll(/^ {2}(\w+)\??:/gm)].map((match) => kebab(match[1]!)),
    booleans: [...body.matchAll(/^ {2}(\w+)\??:\s*boolean\b/gm)].map((match) => kebab(match[1]!)),
  };
}

describe("convention.md documents every option the namespaced-extension parsers read", () => {
  const kernel = readKernelSections();
  const sections = docSections();
  const defaults = parseConventionConfig("");
  const guarded = new Set(SECTIONS.map((section) => section.key));

  it("guards every x-* subsection the doc documents, and names the two it excludes", () => {
    const documented = new Set(sections.keys());
    // A silently empty doc would make the two directions below vacuous.
    expect([...documented].length).toBeGreaterThan(Object.keys(UNGUARDED_SECTIONS).length);
    const problems = [
      ...[...documented]
        .filter((section) => !guarded.has(section) && !(section in UNGUARDED_SECTIONS))
        .map(
          (section) =>
            `convention.md documents \`${section}\` with no guard on its option list — ` +
            `add it to SECTIONS (with its kernel type), or to UNGUARDED_SECTIONS with the reason`,
        ),
      ...[...guarded]
        .filter((section) => !documented.has(section))
        .map(
          (section) =>
            `SECTIONS guards \`${section}\` but convention.md has no such subsection — ` +
            `the doc dropped the section this suite derives from`,
        ),
      ...Object.keys(UNGUARDED_SECTIONS)
        .filter((section) => !documented.has(section))
        .map((section) => `UNGUARDED_SECTIONS excludes \`${section}\` but the doc documents none`),
    ];
    expect(problems).toEqual([]);
  });

  it.each(SECTIONS)(
    "$key: the exported type, the parser and the runtime default agree on the options",
    ({ key, type, read }) => {
      const parsed = kernel.get(key);
      expect(
        parsed,
        `lib/src/convention.ts: no \`if (section === "${key}")\` parse block for the \`${type}\` type`,
      ).toBeTruthy();
      const readKeys = parsed!.keys.map((option) => option.name);
      // One branch per option: a second branch for the same key is dead code,
      // and the duplicate would hide behind the set comparison below.
      expect(
        new Set(readKeys).size,
        `${key}: the parser reads one listed key twice — drop the dead branch`,
      ).toBe(readKeys.length);
      const { names, booleans } = typeMembers(type);
      expect(names.length, `${key}: \`${type}\` declares no options`).toBeGreaterThan(0);
      expect(readKeys.sort(), `${key}: the parser's read keys vs \`${type}\`'s members`).toEqual(
        [...names].sort(),
      );
      expect(
        Object.keys(read(defaults)).map(kebab).sort(),
        `${key}: the runtime default object vs \`${type}\`'s members`,
      ).toEqual([...names].sort());
      expect(new Set(booleans).size, `${key}: \`${type}\` declares a boolean member twice`).toBe(
        booleans.length,
      );
      expect(
        [...parsed!.booleans].sort(),
        `${key}: the parser's boolean-validated options vs \`${type}\`'s boolean members`,
      ).toEqual([...booleans].sort());
    },
  );

  it.each(SECTIONS)("$key: convention.md names every option the parser reads", ({ key }) => {
    const parsed = kernel.get(key)!;
    const documented = documentedOptions(sections.get(key)!, key);
    expect(
      documented.length,
      `convention.md: \`${key}\`'s enumeration names no option`,
    ).toBeGreaterThan(0);
    const named = new Set(documented);
    const problems = parsed.keys
      .filter((option) => !option.exempt && !named.has(option.name))
      .map(
        (option) =>
          `\`${key}.${option.name}\` is read by the parser but not named in convention.md's ` +
          `\`${key}\` enumeration (the PR #637 shape) — add it to the "official options" ` +
          `sentence, or mark its parse branch \`${UNDOCUMENTED_BY_DESIGN}\` for a ` +
          `deliberately undocumented option`,
      );
    expect(problems).toEqual([]);
    // Reverse direction, hyphenated names only (see the header note: the
    // clause's trailing gloss backticks non-option words). A marked option is
    // still shipped, so the exemption does not launder this direction.
    const shipped = new Set(parsed.keys.map((option) => option.name));
    const stale = documented.filter((name) => name.includes("-") && !shipped.has(name));
    expect(
      stale.map(
        (name) =>
          `\`${key}.${name}\` is named in convention.md but the parser reads no such option — ` +
          `drop the doc line or restore the branch`,
      ),
    ).toEqual([]);
  });

  it.each(SECTIONS)(
    "$key: the boolean parse-error sentence enumerates exactly the boolean options",
    ({ key }) => {
      const parsed = kernel.get(key)!;
      const exempt = new Set(
        parsed.keys.filter((option) => option.exempt).map((option) => option.name),
      );
      const expected = [...parsed.booleans].filter((name) => !exempt.has(name)).sort();
      const documented = documentedBooleans(sections.get(key)!).sort();
      expect(
        documented,
        `convention.md: \`${key}\`'s parse-error sentence names ` +
          `${documented.length === 0 ? "no boolean option" : documented.join(", ")}, the kernel ` +
          `validates ${expected.length === 0 ? "none" : expected.join(", ")} as boolean — the ` +
          `sentence must enumerate exactly the boolean options`,
      ).toEqual(expected);
    },
  );

  it("exempts exactly the parse branches that carry the marker (premise)", () => {
    // Every option is documented today, so the exemption path would otherwise
    // be unexercised. The same option, marked and unmarked, over synthetic
    // branches: this is the evidence the escape hatch discriminates.
    const parsed = readKernelSections(
      [
        'if (section === "x-tracker") {',
        '  if (key === "documented-option") {',
        '    tracker.documentedOption = value === "true";',
        "    continue;",
        "  }",
        `  if (key === "legacy-alias") { // ${UNDOCUMENTED_BY_DESIGN} — old spelling, kept readable`,
        '    tracker.legacyAlias = value === "true";',
        "    continue;",
        "  }",
        '  if (key !== "typed-option") continue;',
        `    throw new Error(\`\${sourcePath}: 'typed-option' must be a boolean (got \${JSON.stringify(value)})\`);`,
        "}",
      ].join("\n"),
    ).get("x-tracker");
    expect(parsed).toEqual({
      keys: [
        { name: "documented-option", exempt: false },
        { name: "legacy-alias", exempt: true },
        { name: "typed-option", exempt: false },
      ],
      booleans: new Set(["typed-option"]),
    });
  });

  it("documents the escape hatch where an undocumented-by-design option would hide", () => {
    // The marker is the one way to ship an option without a doc line, so the
    // doc must say so — an undocumented hatch is a hatch no reviewer sees.
    const tracker = sections.get("x-tracker")!;
    expect(
      tracker.includes(UNDOCUMENTED_BY_DESIGN),
      "convention.md §Tracker hygiene does not mention `undocumented-by-design` — " +
        "the escape hatch is itself undocumented",
    ).toBe(true);
  });
});
