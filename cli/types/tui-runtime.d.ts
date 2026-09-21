/**
 * Minimal ambient types for the vendored TUI entry (W5 `task-native-tui`),
 * repo-only: `cli/**` is not part of the published package (`files`), and this
 * file exists solely so `tsc -p cli/tsconfig.plugin.json` can strict-check
 * `opencode/plugins/arggon/tui.tsx`.
 *
 * At load time OpenCode resolves `solid-js` and transpiles the JSX itself
 * (probe on 2.0.12, docs/playbooks/opencode.md); the repo deliberately has no
 * `solid-js` dependency (the vendored file must stay dependency-less), so the
 * gate maps the specifier here. The surface is intentionally permissive: it
 * types the wiring (slots, command, panel props, signal) without pretending to
 * be the runtime's JSX types.
 */
declare namespace JSX {
  type Element = unknown;
  interface IntrinsicElements {
    [element: string]: Record<string, unknown>;
  }
}

declare module "solid-js" {
  export function createSignal<T>(value: T): [() => T, (next: T | ((previous: T) => T)) => void];
  export function Show(props: { when?: unknown; children?: unknown }): unknown;
  export function For<T>(props: {
    each?: readonly T[];
    children?: (item: T, index: () => number) => unknown;
  }): unknown;
}
