/**
 * Test double for the OpenCode TUI runtime modules (`solid-js`,
 * `@opentui/solid/jsx-runtime`) — W5 task-native-tui.
 *
 * `opencode/plugins/arggon/tui.tsx` is vendored verbatim and imports
 * `solid-js` plus JSX, which OpenCode resolves/transpiles at load time
 * (probe on 2.0.12, docs/playbooks/opencode.md). The repo has no `solid-js`
 * dependency by design (the vendored file must not need `node_modules`), so
 * `vitest.config.ts` aliases those specifiers here: the JSX transform calls
 * `jsx`/`jsxs` (elements become plain `{ type, props }` objects), the two
 * reactive primitives `tui.tsx` uses are synchronous, and `test/…` is not part
 * of the published package (`package.json` `files`).
 *
 * This is a TEST FIXTURE, not a runtime implementation: it exists to assert
 * the wiring (slots, commands, panel content) without OpenCode. The real
 * component rendering is covered by `npm run smoke:tui` (PTY) and the manual
 * checklist.
 */
export const Fragment = Symbol.for("arggon.tui.test.fragment");

export type TestElement = { type: unknown; props: Record<string, unknown> };

export function jsx(type: unknown, props: Record<string, unknown> | null): TestElement {
  return { type, props: props ?? {} };
}

export const jsxs = jsx;
export const jsxDEV = jsx;

/** Signal double: `[get, set]` with an eager setter (no reactivity needed here). */
export function createSignal<T>(value: T): [() => T, (next: T | ((previous: T) => T)) => void] {
  let current = value;
  return [
    () => current,
    (next: T | ((previous: T) => T)) => {
      current = typeof next === "function" ? (next as (previous: T) => T)(current) : next;
    },
  ];
}

/** `<Show when={x}>` double: renders the children when truthy. */
export function Show(props: { when?: unknown; children?: unknown }): unknown {
  return props.when ? props.children : null;
}

/** `<For each={xs}>` double (unused today, kept for parity with the runtime). */
export function For(props: {
  each?: readonly unknown[];
  children?: (item: unknown, index: () => number) => unknown;
}): unknown {
  return (props.each ?? []).map((item, index) => props.children?.(item, () => index) ?? null);
}

/** `usePlugin()` double (the vendored file closes over the context instead). */
export function usePlugin(): unknown {
  return undefined;
}
