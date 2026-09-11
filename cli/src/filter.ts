/** Compact filter expressions for `list --filter` (story-filter-language). */

export const FILTER_FIELDS = [
  "status",
  "type",
  "assignee",
  "label",
  "parent",
  "depends-on",
  "blocked-by",
] as const;

export type FilterField = (typeof FILTER_FIELDS)[number];

export type FilterPredicate = {
  field: FilterField;
  /** Raw value (quotes stripped; `@me` is resolved by the caller, not here). */
  value: string;
  negated: boolean;
};

function isFilterField(field: string): field is FilterField {
  return (FILTER_FIELDS as readonly string[]).includes(field);
}

/** Split on whitespace outside single/double quotes (quotes are kept for now). */
function splitTokens(expr: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: string | null = null;
  for (const ch of expr) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (quote) throw new Error(`unterminated quote in filter expression: ${expr}`);
  if (current) tokens.push(current);
  return tokens;
}

function unquote(value: string, expr: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  if (value.includes('"') || value.includes("'")) {
    throw new Error(`mismatched quotes in filter expression: ${expr}`);
  }
  return value;
}

/**
 * Parse `status:todo assignee:@me label:security` into predicates.
 * `!` prefixes negate (`!status:done`); quoted values allow spaces
 * (`assignee:"Jane Doe"`). Unknown fields are usage errors, never
 * silently ignored. Value validation (status/type enums, @me) stays
 * with the caller, which owns the same predicates as the flags.
 */
export function parseFilter(expr: string): FilterPredicate[] {
  const tokens = splitTokens(expr.trim());
  return tokens.map((token) => {
    let negated = false;
    let rest = token;
    if (rest.startsWith("!")) {
      negated = true;
      rest = rest.slice(1);
    }
    const colon = rest.indexOf(":");
    if (colon <= 0) {
      throw new Error(
        `bad filter token "${token}" (expected [!]field:value with field in ${FILTER_FIELDS.join(", ")})`,
      );
    }
    const field = rest.slice(0, colon);
    if (!isFilterField(field)) {
      throw new Error(`unknown filter field "${field}". Allowed: ${FILTER_FIELDS.join(", ")}`);
    }
    const value = unquote(rest.slice(colon + 1), expr);
    if (!value) throw new Error(`empty value in filter token "${token}"`);
    return { field, value, negated };
  });
}

export type FilterableItem = {
  id?: string;
  status: string;
  type: string;
  assignee?: string | null;
  labels: string[];
  parent?: string | null;
  /** Ids this item waits for (convention v3). Optional for call sites that don't carry deps. */
  dependsOn?: string[];
};

/**
 * Computed inverse dependency view (never stored): dep id -> ids that list
 * it in `depends_on`. Required by the `blocked-by:` predicate; build once
 * per query with `buildBlockedByIndex` and pass it to `matchesPredicate`.
 */
export type BlockedByIndex = ReadonlyMap<string, readonly string[]>;

/** Build the inverse depends_on view for a set of items. Pure. */
export function buildBlockedByIndex(
  items: readonly { id: string; dependsOn?: string[] }[],
): BlockedByIndex {
  const index = new Map<string, string[]>();
  for (const item of items) {
    for (const depId of item.dependsOn ?? []) {
      const bucket = index.get(depId);
      if (bucket) bucket.push(item.id);
      else index.set(depId, [item.id]);
    }
  }
  return index;
}

/**
 * Test one predicate against an item. Pure; no I/O, no @me resolution.
 * The `blocked-by:` predicate is computed against the whole tree, so it
 * needs the inverse index (build with `buildBlockedByIndex`); without one
 * it never matches. All other predicates are self-contained.
 */
export function matchesPredicate(
  item: FilterableItem,
  pred: FilterPredicate,
  blockedByIndex?: BlockedByIndex,
): boolean {
  let hit: boolean;
  switch (pred.field) {
    case "status":
      hit = item.status === pred.value;
      break;
    case "type":
      hit = item.type === pred.value;
      break;
    case "assignee":
      hit = (item.assignee ?? null) === pred.value;
      break;
    case "label":
      hit = item.labels.includes(pred.value);
      break;
    case "parent":
      hit = (item.parent ?? null) === pred.value;
      break;
    case "depends-on":
      hit = (item.dependsOn ?? []).includes(pred.value);
      break;
    case "blocked-by":
      hit = (blockedByIndex?.get(pred.value) ?? []).includes(item.id ?? "");
      break;
  }
  return pred.negated ? !hit : hit;
}
