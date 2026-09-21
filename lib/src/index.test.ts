/**
 * Kernel entry contract (`@arggon/lib`, ADR 0013): the entry re-exports the
 * kernel modules by identity, never as wrappers — `rules.ts` stays the single
 * source of the claim/reopen invariants (`lib/README.md`), so no caller can
 * reach a drifted copy through the package surface.
 *
 * This pin lives here, next to the modules it compares: `cli/src/lib.test.ts`
 * used to "check" it by importing `@arggon/lib` four times and comparing the
 * entry against itself (W6/PR-374 review finding 3) — a test that could never
 * fail. A static `../../lib/src/*.js` import from a `cli/` test is not an
 * option either: it pulls files outside the root build's `rootDir` and fails
 * `npm run build` with TS6059.
 */
import { describe, expect, it } from "vitest";
import * as entry from "./index.js";
import * as next from "./next.js";
import * as relations from "./relations.js";
import * as rules from "./rules.js";
import * as status from "./status.js";

describe("kernel entry (@arggon/lib)", () => {
  it("re-exports the kernel modules by identity (rules.ts stays the single source)", () => {
    // Identity, not a wrapper: the library cannot drift from the kernel module.
    expect(entry.assertUpdateRules).toBe(rules.assertUpdateRules);
    expect(entry.canTransition).toBe(status.canTransition);
    expect(entry.isClaimed).toBe(status.isClaimed);
    expect(entry.assertParentEdge).toBe(relations.assertParentEdge);
    expect(entry.runNext).toBe(next.runNext);
  });
});
