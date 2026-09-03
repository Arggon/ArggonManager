const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_ID_LENGTH = 64;

export const ITEM_TYPES = ["initiative", "epic", "story", "task", "bug"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

const LEAF_PREFIX: Record<"task" | "bug", string> = {
  task: "task-",
  bug: "bug-",
};

export function isItemType(value: string): value is ItemType {
  return (ITEM_TYPES as readonly string[]).includes(value);
}

export function slugify(text: string): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) {
    throw new Error(`Cannot derive id from ${JSON.stringify(text)}`);
  }
  return slug;
}

export function assertValidId(id: string): void {
  if (id.length > MAX_ID_LENGTH) {
    throw new Error(`id '${id}' exceeds ${MAX_ID_LENGTH} characters`);
  }
  if (!ID_PATTERN.test(id)) {
    throw new Error(`id '${id}' must be kebab-case ASCII (a-z, 0-9, hyphens)`);
  }
}

/** Build the canonical id (filename stem). Adds task-/bug- for leaves if missing. */
export function itemId(type: ItemType, stem: string): string {
  if (type === "task" || type === "bug") {
    const prefix = LEAF_PREFIX[type];
    const id = stem.startsWith(prefix) ? stem : `${prefix}${stem}`;
    assertValidId(id);
    return id;
  }
  if (stem.startsWith("task-") || stem.startsWith("bug-")) {
    throw new Error(`Container id '${stem}' must not start with task- or bug-`);
  }
  assertValidId(stem);
  return stem;
}

export function innerSlug(id: string): string {
  return id.replace(/^(?:task|bug)-/, "");
}
