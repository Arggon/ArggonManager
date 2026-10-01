/**
 * Unit gate for the transform-neutral board embed (bug-tsx-board-dead-script).
 *
 * `renderBoardHtml` embeds controller functions with `Function.toString()`.
 * Under tsx, esbuild's keepNames transform splices `__name(target, "name")`
 * calls into those sources; shipped verbatim they kill the page script
 * (`ReferenceError: __name is not defined`). These tests pin the stripper's
 * contract against the exact shapes esbuild emits (samples taken from a real
 * `npm run arggon -- board` render) and its fail-loud behavior on unknown
 * shapes. The vitest transform (oxc) leaves `toString()` clean, so the
 * identity assertions here also prove the tsc/dist path is untouched; the
 * tsx-spawn CLI gate in board.test.ts and the tsx-path browser leg in
 * e2e/board.smoke.spec.ts drive the transformed path for real.
 */
import { describe, expect, it } from "vitest";
import { embeddedFunctionSource, stripKeepNamesCalls } from "./board-embed.js";
import { applyBoardFilter, evaluateDrop } from "./board.js";

describe("stripKeepNamesCalls (bug-tsx-board-dead-script)", () => {
  it("is an identity on clean sources (the tsc/dist and vitest-oxc shape)", () => {
    for (const fn of [applyBoardFilter, evaluateDrop]) {
      expect(stripKeepNamesCalls(fn.toString())).toBe(fn.toString());
      expect(embeddedFunctionSource(fn)).toBe(fn.toString());
    }
  });

  it("strips the statement shape (nested function declaration)", () => {
    // Real shape from a tsx render of wireBoardColumns.
    const source =
      'function store(state2){try{localStorage.setItem(KEY,JSON.stringify(state2))}catch{}}__name(store,"store");function load(){return 1}';
    expect(stripKeepNamesCalls(source)).toBe(
      "function store(state2){try{localStorage.setItem(KEY,JSON.stringify(state2))}catch{}}store;function load(){return 1}",
    );
  });

  it("strips the comma-list statement shape (renamed closures)", () => {
    // Real shape from a tsx render of applyBoardFilter.
    const source =
      'var depsOf=depsOf2,isDepReady=isDepReady2,predicateHits=predicateHits2;__name(depsOf2,"depsOf"),__name(isDepReady2,"isDepReady"),__name(predicateHits2,"predicateHits");const tokens=splitTokens(expr.trim());';
    expect(stripKeepNamesCalls(source)).toBe(
      "var depsOf=depsOf2,isDepReady=isDepReady2,predicateHits=predicateHits2;depsOf2,isDepReady2,predicateHits2;const tokens=splitTokens(expr.trim());",
    );
  });

  it("unwraps the expression shape and keeps the wrapped function's behavior", () => {
    // Real shape from a tsx render of wireBoardTheme (scheme-change listener).
    const source =
      'const onSchemeChange=__name(function(){if(prefs.theme==="auto")apply(prefs)},"onSchemeChange");if(typeof query.addEventListener==="function"){query.addEventListener("change",onSchemeChange)}';
    expect(stripKeepNamesCalls(source)).toBe(
      'const onSchemeChange=function(){if(prefs.theme==="auto")apply(prefs)};if(typeof query.addEventListener==="function"){query.addEventListener("change",onSchemeChange)}',
    );
    // The rewritten source is runnable and the unwrapped function works
    // (theme "auto" routes through the scheme-change handler).
    const run = new Function(
      'let calls=0;const apply=()=>{calls++};const prefs={theme:"auto"};' +
        "const query={addEventListener:()=>{}};" +
        stripKeepNamesCalls(source) +
        "onSchemeChange();return calls;",
    ) as () => number;
    expect(run()).toBe(1);
  });

  it("leaves regex literals, strings and templates untouched while stripping", () => {
    const source = [
      "function outer(ch){",
      "  const ws=/\\s/.test(ch);",
      '  const label="__name(not a call)";',
      "  const tpl=`also __name( inside`;",
      '  function inner(x){return x+ws}__name(inner,"inner");',
      "  return inner;",
      "}",
    ].join("\n");
    const stripped = stripKeepNamesCalls(source);
    expect(stripped).toContain('"__name(not a call)"');
    expect(stripped).toContain("`also __name( inside`");
    expect(stripped).toContain("/\\s/.test(ch)");
    expect(stripped).toContain("}inner;");
    expect(stripped).not.toMatch(/__name\(\w+,\s*"/);
  });

  it("never treats lookalike identifiers as keepNames calls", () => {
    const source = 'function f(){my__name(a,"a");__name2(b,"b");obj.__name(c,"c");return f}';
    expect(stripKeepNamesCalls(source)).toBe(source);
  });

  it("produces zero __name tokens for a composite of all three shapes", () => {
    // Composite mirroring a real tsx-rendered applyBoardFilter slice,
    // including a regex literal inside the stripped body.
    const source =
      'function applyBoardFilter(items,expr,me){function splitTokens(text){if(/\\s/.test(text))throw new Error("unterminated quote in filter expression: "+text);return text}__name(splitTokens,"splitTokens");try{let depsOf2=function(item){return item},isDepReady2=function(item){return !0};var depsOf=depsOf2,isDepReady=isDepReady2;__name(depsOf2,"depsOf"),__name(isDepReady2,"isDepReady");const tokens=splitTokens(expr.trim());return{ok:!0,visible:[]}}catch(err){return{ok:!1,error:String(err)}}}';
    const stripped = stripKeepNamesCalls(source);
    expect(stripped).not.toContain("__name");
    expect(stripped).toContain("splitTokens;");
    expect(stripped).toContain("depsOf2,isDepReady2;");
    expect(stripped).toContain("/\\s/.test(text)");
    // Still runnable: the sandbox round-trip the board-parity suite performs.
    const fn = new Function(`${stripped}\nreturn applyBoardFilter;`)() as (
      items: unknown[],
      expr: string,
    ) => { ok: boolean; visible?: string[] };
    expect(fn([], "status:todo")).toEqual({ ok: true, visible: [] });
  });

  it("throws at render time on an unrecognized __name shape", () => {
    // Bare reference.
    expect(() => stripKeepNamesCalls("function f(){return __name;}")).toThrow(
      /unrecognized esbuild keepNames shape/,
    );
    // First argument is not a function/class expression.
    expect(() => stripKeepNamesCalls('__name(a+b,"x");')).toThrow(
      /unrecognized esbuild keepNames shape/,
    );
    // No trailing string argument.
    expect(() => stripKeepNamesCalls("__name(function f(){return 1});")).toThrow(
      /unrecognized esbuild keepNames shape/,
    );
    // Unterminated call.
    expect(() => stripKeepNamesCalls('__name(function(){return 1},"x"')).toThrow(
      /unrecognized esbuild keepNames shape/,
    );
  });
});
