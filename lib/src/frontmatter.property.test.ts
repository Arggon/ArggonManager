/**
 * Property: valid item frontmatter survives parse → serialize → parse.
 *
 * The kernel under test is `frontmatter.ts` — the single read/write path the
 * CLI, the MCP adapter and the native plugin all share (ADR 0013). Properties
 * complement the example-based `frontmatter.test.ts` / `deps.test.ts` suites,
 * which stay authoritative for concrete contracts; this file attacks the space
 * humans do not enumerate.
 *
 * INVARIANT (asserted per generated run, for a VALID item model):
 *   1. `stringify(parse(stringify(data, body)))` is byte-identical to
 *      `stringify(data, body)` — a second mutation can never change bytes, so
 *      the write is already normalized (this is what "survives" means: a later
 *      `update` cannot rewrite the file under the reader).
 *   2. Every field the item model exposes reads back EXACTLY as generated
 *      through the production accessors (`stringField` / `stringArrayField` /
 *      `numberField`) — no required field is lost, coerced or reordered.
 *   3. The body text is returned byte-for-byte (documented normalization only:
 *      a leading blank line and a single trailing newline).
 *   4. Neither the writer nor the reader throws.
 *
 * "Valid" is the item-FILE level contract: the production validators
 * (`assertValidId`, `assertLabels`, `assertBranchName`, `assertClaimAndBlocked`)
 * are run inside the property, so a generator change that leaves the model
 * domain fails loudly here instead of quietly testing something invalid.
 * Tree-level relations (a parent that exists, an acyclic `depends_on`) are a
 * different contract and belong to `validate.property.test.ts`.
 *
 * The generator emits only inputs the kernel claims to support: the free-text
 * carrier always contains an ASCII letter (so a plain YAML scalar can never be
 * re-read as `null`, `~`, a boolean or an integer), ids/labels are kebab-case
 * (the `ID_PATTERN` / `LABEL_PATTERN` the validator enforces), and list
 * elements carry no comma (the array form is comma-joined, which the
 * convention's id and label shapes already exclude).
 *
 * The class the letter rule excludes — plain scalars the parser resolves to a
 * non-string — is NOT hidden: it is covered exhaustively by the second property
 * in this file, which pins today's behaviour token by token and carries the
 * filed bug. Nothing in this file weakens an invariant to make a run pass.
 */
import { describe, expect, it } from "vitest";
import {
  numberField,
  parseFrontmatter,
  stringArrayField,
  stringField,
  stringifyFrontmatter,
  type Frontmatter,
} from "./frontmatter.js";
import {
  assertBranchName,
  assertLabels,
  assertValidId,
  BRANCH_PATTERN,
  ITEM_TYPES,
  type ItemType,
} from "./ids.js";
import { ASSIGNEE_PATTERN, assertClaimAndBlocked, CLAIMABLE_TYPES, STATUSES } from "./status.js";
import { fc, checkProperty } from "../../test/property-runner.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const LOWER_ALNUM = "abcdefghijklmnopqrstuvwxyz0123456789".split("");

/**
 * One atom of generated free text, one per quoting/escaping class the writer
 * has to handle. Written as escapes on purpose: the control code points are
 * part of the corpus.
 */
/** A control code point built by number, so the corpus stays readable as source. */
const codePoint = (code: number): string => String.fromCharCode(code);

const FREE_TEXT_ATOMS: readonly string[] = [
  // plain scalars
  "a",
  "Z",
  "0",
  "9",
  " ",
  // separators that force the quoted form
  "#",
  ": ",
  "-",
  "\u2014",
  // characters `formatScalar` treats as needing JSON/YAML quoting
  "[",
  "]",
  "{",
  "}",
  ",",
  "&",
  "*",
  "?",
  "!",
  "'",
  '"',
  "\\",
  "|",
  ">",
  "%",
  "`",
  // whitespace the writer must escape or quote
  "\t",
  "\n",
  "\r\n",
  "  leading",
  "trailing  ",
  // C0, DEL, C1 and the Unicode line/paragraph separators
  codePoint(0x00),
  codePoint(0x1b),
  codePoint(0x7f),
  codePoint(0x85),
  codePoint(0x9f),
  codePoint(0x2028),
  codePoint(0x2029),
  // multibyte: Latin-1, Latin Extended, CJK, combining marks, astral
  "\u00e9",
  "\u00fc",
  "\u00df",
  "\u65e5\u672c\u8a9e",
  "\u4e2d",
  "e\u0301",
  String.fromCodePoint(0x1f642),
  String.fromCodePoint(0x1f389),
  String.fromCodePoint(0x10ffff),
];

/**
 * Free text that always contains an ASCII letter (the first character is one),
 * so it can never coincide with a bare `null` / `~` / boolean / integer token —
 * the YAML-ambiguous class is covered by the canary property below.
 */
const freeText = fc
  .tuple(
    fc.constantFrom(...LETTERS),
    fc.array(fc.constantFrom(...FREE_TEXT_ATOMS), { maxLength: 8 }),
  )
  .map(([letter, atoms]) => letter + atoms.join(""));

const kebabWord = fc
  .array(fc.constantFrom(...LOWER_ALNUM), { minLength: 1, maxLength: 6 })
  .map((chars) => chars.join(""));

const kebabWordWithLetter = fc
  .array(fc.constantFrom(...LOWER_ALNUM.filter((c) => /[a-z]/.test(c))), {
    minLength: 1,
    maxLength: 6,
  })
  .map((chars) => chars.join(""));

/**
 * Kebab-case id/label token whose FIRST segment carries an ASCII letter. Both
 * shapes are inside the convention (`ID_PATTERN` / `LABEL_PATTERN` accept a
 * purely numeric token such as `06`), but a token with no letter can be a bare
 * YAML integer — the ambiguous class the canary property below covers
 * exhaustively and the filed bug tracks. Keeping the letter here is a DOCUMENTED
 * domain restriction, not a special case for a failing input.
 */
const kebab = fc
  .tuple(kebabWordWithLetter, fc.array(kebabWord, { maxLength: 2 }))
  .map(([head, rest]) => (rest.length === 0 ? head : `${head}-${rest.join("-")}`));

/** Valid leaf id: `task-`/`bug-` + kebab (matches `itemId` + `ID_PATTERN`). */
const leafId = fc
  .tuple(fc.constantFrom("task", "bug"), kebab)
  .map(([prefix, slug]) => `${prefix}-${slug}`);

/**
 * Valid CONTAINER id (initiative/epic/story): kebab-case whose first segment is
 * a single letter, so it can never start with `task-`/`bug-` (which
 * `checkItemShape` reports as INVALID_ID_PREFIX for a container).
 */
const containerId = fc
  .tuple(
    fc.constantFrom(...LOWER_ALNUM.filter((c) => /[a-z]/.test(c))),
    fc.array(kebabWord, { maxLength: 2 }),
  )
  .map(([letter, words]) => (words.length === 0 ? letter : `${letter}-${words.join("-")}`));

const uniqueLabels = fc.uniqueArray(kebab, { minLength: 0, maxLength: 3 });

const isoDate = fc
  .tuple(
    fc.integer({ min: 2020, max: 2038 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }),
  )
  .map(([y, m, d]) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);

const isoDateTime = fc
  .tuple(isoDate, fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
  .map(
    ([date, h, m]) => `${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`,
  );

const branch = fc
  .tuple(fc.constantFrom("feat", "fix", "chore"), kebab)
  .map(([kind, slug]) => `${kind}/${slug}`);

const login = fc
  .array(fc.constantFrom(...LETTERS, ...LOWER_ALNUM), { minLength: 1, maxLength: 12 })
  .map((chars) => chars.join(""));

const extraKey = fc.tuple(fc.constantFrom("x", "x", "x-note"), kebab).map(([p, s]) => `${p}-${s}`);

/**
 * One `x-*` pass-through value. List elements are comma-free scalars (the array
 * form is comma-joined) and carry a letter, so they stay in the same
 * unambiguous domain as the free-text carrier.
 */
const extraValue = fc.oneof(
  { weight: 4, arbitrary: freeText },
  {
    weight: 2,
    arbitrary: fc.uniqueArray(
      fc.tuple(fc.constantFrom(...LETTERS), kebabWord).map(([a, b]) => `${a}${b}`),
      {
        maxLength: 2,
      },
    ),
  },
  { weight: 1, arbitrary: fc.integer({ min: 0, max: 1000 }) },
  { weight: 1, arbitrary: fc.constantFrom(true, false) },
  { weight: 1, arbitrary: fc.constant(null) },
);

const extras = fc
  .uniqueArray(fc.tuple(extraKey, extraValue), {
    minLength: 0,
    maxLength: 3,
    selector: ([key]) => key,
  })
  .map((pairs) => Object.fromEntries(pairs) as Frontmatter);

/** Markdown-ish body text, including the shapes the kernel's own writer emits. */
const bodyLine = fc.oneof(
  { weight: 3, arbitrary: freeText },
  {
    weight: 1,
    arbitrary: fc.constantFrom(
      "",
      "# Heading",
      "## Heading",
      "- [ ] open acceptance row",
      "- [x] done acceptance row",
      "* [X] upper acceptance row",
      "```ts",
      "const x = 1;",
      "```",
      "| a | b |",
      "| - | - |",
      "plain prose line",
      "<!-- arggon:generated -->",
    ),
  },
);

/**
 * Body text that never opens with a blank line: the "add the leading blank
 * line" branch of the writer is the `leadingNewline` case below, so the two
 * cases stay disjoint and the recovery expectation is exact.
 */
const body = fc
  .array(bodyLine, { minLength: 0, maxLength: 10 })
  .map((lines) => lines.join("\n").replace(/^\n+/, ""));

/** A VALID item model, in the exact shape `softTryLoadItem` reads. */
const itemModel = fc
  .record({
    type: fc.constantFrom(...ITEM_TYPES),
    status: fc.constantFrom(...STATUSES),
    // Ids are derived from the type below (`itemId` semantics): a leaf gets its
    // own prefix, a container gets a stem that cannot start with `task-`/`bug-`.
    idStem: kebab,
    containerStem: containerId,
    labels: uniqueLabels,
    dependsOn: fc.uniqueArray(leafId, { maxLength: 3 }),
    hasTitle: fc.boolean(),
    title: freeText,
    hasAssignee: fc.boolean(),
    assignee: login,
    hasParent: fc.boolean(),
    parent: fc.oneof(leafId, kebab),
    branch: fc.option(branch),
    priority: fc.option(fc.constantFrom("p0", "p1", "p2", "p3")),
    created: isoDate,
    updated: isoDate,
    milestone: fc.option(isoDate),
    claimedAt: fc.option(isoDateTime),
    worktreePath: fc.option(kebab.map((slug) => `/home/dev/repo-${slug}`)),
    issue: fc.option(fc.integer({ min: 1, max: 9999 })),
    blockedReason: freeText,
    extras,
    body,
  })
  .map((raw) => {
    const claimable = CLAIMABLE_TYPES.has(raw.type as ItemType);
    const inProgress = raw.status === "in_progress";
    const blocked = raw.status === "blocked";
    // Production rule (`assertClaimAndBlocked`): an in_progress claimable item
    // needs an assignee; `blocked_reason` exists only with status blocked.
    const assignee =
      inProgress && claimable ? raw.assignee : raw.hasAssignee ? raw.assignee : undefined;
    const leaf = raw.type === "task" || raw.type === "bug";
    const id = leaf ? `${raw.type}-${raw.idStem}` : raw.containerStem;
    const data: Frontmatter = { type: raw.type, status: raw.status, id };
    if (raw.hasTitle) data.title = raw.title;
    if (assignee !== undefined) data.assignee = assignee;
    if (raw.branch !== null) data.branch = raw.branch;
    if (raw.type !== "initiative" && raw.hasParent) data.parent = raw.parent;
    data.labels = raw.labels;
    if (raw.priority !== null) data.priority = raw.priority;
    data.created = raw.created;
    data.updated = raw.updated;
    if (blocked) data.blocked_reason = raw.blockedReason;
    if (raw.milestone !== null) data.milestone = raw.milestone;
    if (raw.dependsOn.length > 0) data.depends_on = raw.dependsOn;
    if (raw.claimedAt !== null) data.claimed_at = raw.claimedAt;
    if (raw.worktreePath !== null) data.worktree_path = raw.worktreePath;
    if (raw.issue !== null) data.issue = raw.issue;
    for (const [key, value] of Object.entries(raw.extras)) data[key] = value;
    return { data, body: raw.body };
  });

// --- field comparison -------------------------------------------------------

const SCALAR_FIELDS = [
  "type",
  "status",
  "id",
  "title",
  "assignee",
  "branch",
  "parent",
  "priority",
  "created",
  "updated",
  "blocked_reason",
  "milestone",
  "claimed_at",
  "worktree_path",
] as const;
const LIST_FIELDS = ["labels", "depends_on"] as const;
const NUMBER_FIELDS = ["issue"] as const;
const OFFICIAL_FIELDS: ReadonlySet<string> = new Set([
  ...SCALAR_FIELDS,
  ...LIST_FIELDS,
  ...NUMBER_FIELDS,
]);

/**
 * Assert the generated model is one the kernel claims to support. Uses the
 * production validators, so a generator change that leaves the model domain
 * fails the property instead of quietly testing something invalid.
 */
function assertValidModel(data: Frontmatter): void {
  const id = stringField(data, "id") ?? "";
  assertValidId(id);
  assertLabels(stringArrayField(data, "labels"));
  for (const dep of stringArrayField(data, "depends_on")) assertValidId(dep);
  const type = stringField(data, "type") ?? "";
  expect(ITEM_TYPES).toContain(type);
  const status = stringField(data, "status") ?? "";
  expect(STATUSES).toContain(status);
  const assignee = stringField(data, "assignee");
  if (assignee !== undefined) expect(ASSIGNEE_PATTERN.test(assignee)).toBe(true);
  const branchName = stringField(data, "branch");
  if (branchName !== undefined) {
    expect(BRANCH_PATTERN.test(branchName)).toBe(true);
    assertBranchName(branchName);
  }
  for (const field of ["created", "updated"] as const) {
    expect(stringField(data, field) ?? "").toMatch(DATE_RE);
  }
  assertClaimAndBlocked({
    type: type as ItemType,
    status: status as (typeof STATUSES)[number],
    assignee,
    blockedReason: stringField(data, "blocked_reason"),
  });
}

describe("frontmatter round-trip (property)", () => {
  it("keeps every field and the body text across parse → serialize → parse", () => {
    checkProperty(
      "frontmatter round-trip",
      fc.property(itemModel, fc.boolean(), ({ data, body: rawBody }, leadingNewline) => {
        // Bodies on disk open with the blank line the writer emits; the other
        // branch exercises the documented "add the blank line" path.
        const bodyText = leadingNewline && rawBody !== "" ? `\n${rawBody}\n` : `${rawBody}\n`;
        assertValidModel(data);

        const raw1 = stringifyFrontmatter(data, bodyText);
        const first = parseFrontmatter(raw1);
        const raw2 = stringifyFrontmatter(first.data, first.body);
        const second = parseFrontmatter(raw2);

        // (1) The write is a fixed point: a later mutation cannot change bytes.
        expect(raw2).toBe(raw1);
        // (2) Every field reads back exactly as generated (production accessors).
        for (const field of SCALAR_FIELDS) {
          expect(stringField(second.data, field)).toBe(stringField(data, field));
          expect(stringField(first.data, field)).toBe(stringField(data, field));
        }
        for (const field of LIST_FIELDS) {
          expect(stringArrayField(second.data, field)).toEqual(stringArrayField(data, field));
          expect(stringArrayField(first.data, field)).toEqual(stringArrayField(data, field));
        }
        for (const field of NUMBER_FIELDS) {
          expect(numberField(second.data, field)).toBe(numberField(data, field));
          expect(numberField(first.data, field)).toBe(numberField(data, field));
        }
        // Pass-through extras survive with the same shape.
        for (const key of Object.keys(data)) {
          if (OFFICIAL_FIELDS.has(key)) continue;
          expect(second.data[key]).toEqual(first.data[key]);
        }
        // (3) Body text is untouched by the round trip.
        expect(second.body).toBe(first.body);
        // The body round-trips verbatim, with exactly one documented change:
        // the writer terminates the file with a newline, so the parsed body is
        // the generated text plus that newline. The blank line the writer puts
        // BEFORE the body is consumed by the closing-fence match, so it is
        // formatting rather than body text — `leadingNewline` exercises both
        // writer inputs and both must parse back identically.
        expect(first.body).toBe(rawBody === "" ? "" : `${rawBody}\n`);
      }),
    );
  });

  /**
   * Plain scalars the kernel's reader resolves to a NON-string: `null` / `~` →
   * null, `true` / `false` → boolean, `/^-?\d+$/` → number (`parseValue`).
   *
   * `expectedText` is what the item model reports on the FIRST read, pinned per
   * token. Rows whose text differs from the token are the loss filed as
   * `bug-frontmatter-ambiguous-plain-scalar-loss`: a leading-zero, `-0` or
   * > 2^53 integer loses its text, and `null` / `~` lose the field entirely
   * (`arggon create task "0123"` then shows `123`, and the next write rewrites
   * the file). This property is a CANARY for that bug, not a weaker model: it
   * asserts today's exact mapping, so a fix in `parseValue` / `formatScalar`
   * turns it red on purpose (flip the pinned value together with the fix) and
   * any other change is caught immediately.
   */
  const AMBIGUOUS_SCALARS: ReadonlyArray<
    readonly [token: string, expectedText: string | undefined]
  > = [
    ["null", undefined],
    ["~", undefined],
    ["true", "true"],
    ["false", "false"],
    ["0", "0"],
    ["42", "42"],
    ["-7", "-7"],
    // lossy: the integer does not survive Number()
    ["00", "0"],
    ["-0", "0"],
    ["007", "7"],
    ["0123", "123"],
    ["-007", "-7"],
    ["9007199254740993", "9007199254740992"],
    ["12345678901234567890", "12345678901234567000"],
  ];

  it("normalizes an ambiguous plain scalar exactly once, never throwing", () => {
    checkProperty(
      "frontmatter ambiguous scalar",
      fc.property(
        fc.constantFrom(...AMBIGUOUS_SCALARS),
        // Every field a bare token can legally land in, all read through the
        // same accessor. (The list form coerces through `String()` inside
        // `stringArrayField` and has its own table; deps.test.ts pins that
        // form example-based.)
        fc.constantFrom("title", "parent", "x-note"),
        ([token, expectedText], carrier) => {
          const data: Frontmatter = { type: "task", status: "todo", id: "task-ambiguous" };
          data[carrier] = token;
          const raw1 = stringifyFrontmatter(data, "\nbody\n");
          const first = parseFrontmatter(raw1);
          const raw2 = stringifyFrontmatter(first.data, first.body);
          const second = parseFrontmatter(raw2);
          const raw3 = stringifyFrontmatter(second.data, second.body);

          // Pinned behaviour: the token's text after the first read.
          expect(stringField(first.data, carrier)).toBe(expectedText);
          expect(stringField(second.data, carrier)).toBe(expectedText);
          // Bounded corruption: one write normalizes, then the bytes are stable.
          expect(raw3).toBe(raw2);
          // The body is never touched by the ambiguity.
          expect(second.body).toBe(first.body);
        },
      ),
    );
  });
});
