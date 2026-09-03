import type { ItemType } from "./ids.js";

/** v0 allowed parent type. initiative is a root (null). */
export const PARENT_TYPE: Record<ItemType, ItemType | null> = {
  initiative: null,
  epic: "initiative",
  story: "epic",
  task: "story",
  bug: "story",
};

export function expectedParentType(type: ItemType): ItemType | null {
  return PARENT_TYPE[type];
}

/**
 * Allowed edges only: epic→initiative, story→epic, task/bug→story.
 * No skip, no cycles. Initiative must have no parent type.
 */
export function assertParentEdge(
  childType: ItemType,
  parentType: ItemType | null | undefined,
): void {
  const expected = expectedParentType(childType);
  if (expected === null) {
    if (parentType) {
      throw new Error("initiative cannot have a parent");
    }
    return;
  }
  if (!parentType) {
    throw new Error(`${childType} requires parent type ${expected}`);
  }
  if (parentType !== expected) {
    throw new Error(`${childType} must live under a ${expected} (got ${parentType})`);
  }
}
