/** Compact filter expressions for `list --filter` (story-filter-language). */

export const FILTER_FIELDS = ["status", "type", "assignee", "label", "parent"] as const;

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
  status: string;
  type: string;
  assignee?: string | null;
  labels: string[];
  parent?: string | null;
};

/** Test one predicate against an item. Pure; no I/O, no @me resolution. */
export function matchesPredicate(item: FilterableItem, pred: FilterPredicate): boolean {
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
  }
  return pred.negated ? !hit : hit;
}
