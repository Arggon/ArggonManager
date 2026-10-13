/**
 * Unit tests for the shared hermetic-serving helpers. The runtime legs (a real
 * `opencode serve`/`run` under the hermetic HOME) live in the smokes the
 * helpers serve; what decides each check is the logic pinned here.
 */
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createHermeticHome,
  hostConfigHome,
  pluginEvidenceFaults,
  seedHermeticCredentials,
  vendoredSource,
  vendoredSourceMatches,
} from "./opencode-hermetic.js";

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tmp(prefix: string): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  tmpDirs.push(dir);
  return dir;
}

describe("opencode-hermetic: vendoredSourceMatches", () => {
  const source = 'export default { id: "arggon" }\n';

  it("accepts a byte-identical copy and one carrying the init provenance line", () => {
    expect(vendoredSourceMatches(source, source)).toBe(true);
    const marked = `// arggon:generated template="opencode/plugins/arggon/index.bundle.ts"\n${source}`;
    expect(vendoredSource(marked)).toBe(source);
    expect(vendoredSourceMatches(marked, source)).toBe(true);
  });

  it("rejects a copy whose bytes after the marker differ (the shadowing shape)", () => {
    // A machine-global pre-T4 bundle: same id, different bytes.
    const stale = `// arggon:generated template="opencode/plugins/arggon/index.bundle.ts"\nexport default { id: "arggon" } // pre-T4\n`;
    expect(vendoredSourceMatches(stale, source)).toBe(false);
    expect(vendoredSourceMatches(`${source} // trailing`, source)).toBe(false);
    expect(vendoredSourceMatches("", source)).toBe(false);
  });
});

describe("opencode-hermetic: hostConfigHome", () => {
  it("prefers XDG_CONFIG_HOME and falls back to HOME/.config", () => {
    expect(hostConfigHome({ XDG_CONFIG_HOME: "/x/config", HOME: "/home/a" })).toBe("/x/config");
    expect(hostConfigHome({ HOME: "/home/a" })).toBe("/home/a/.config");
  });
});

describe("opencode-hermetic: pluginEvidenceFaults", () => {
  const expected = {
    pluginDirs: [
      "/tmp/fixture/.opencode/plugins/arggon",
      "/tmp/fixture-primary/.opencode/plugins/arggon",
    ],
    hostConfigHome: "/home/a/.config",
  };
  const loadingLine = (dir: string): string =>
    `timestamp=now level=INFO msg="loading plugin" id=${dir} entrypoint=file://${dir}/index.ts\n`;

  it("accepts a log that names any fixture copy as loaded", () => {
    expect(pluginEvidenceFaults(loadingLine(expected.pluginDirs[0]), expected)).toEqual([]);
    expect(pluginEvidenceFaults(loadingLine(expected.pluginDirs[1]), expected)).toEqual([]);
  });

  it("fails when the host never named a fixture plugin, and reports what it did load", () => {
    expect(pluginEvidenceFaults("no plugin lines here", expected)).toEqual([
      `the host log never names a fixture plugin (${expected.pluginDirs.join(", ")}) as loaded; observed: no loading-plugin line`,
    ]);
    const elsewhere = pluginEvidenceFaults(
      loadingLine("/tmp/other/.opencode/plugins/arggon"),
      expected,
    );
    expect(elsewhere).toHaveLength(1);
    expect(elsewhere[0]).toContain("observed: /tmp/other/.opencode/plugins/arggon");
  });

  it("fails when the machine-global plugin directory is in play, even beside a fixture one", () => {
    const global = "/home/a/.config/opencode/plugins/arggon";
    const faults = pluginEvidenceFaults(
      `${loadingLine(global)}${loadingLine(expected.pluginDirs[0])}`,
      expected,
    );
    expect(faults).toEqual([
      `the host log names the machine-global plugin directory ${join(expected.hostConfigHome, "opencode", "plugins")} — the fixture bundle is not the only copy in play`,
    ]);
  });

  it("requires the id= line, not just any mention of the path", () => {
    const entrypointOnly = `msg="loading plugin" entrypoint=file://${expected.pluginDirs[0]}/index.ts\n`;
    expect(pluginEvidenceFaults(entrypointOnly, expected)).toHaveLength(1);
  });
});

describe("opencode-hermetic: createHermeticHome", () => {
  it("creates HOME and every XDG dir under the disposable root", () => {
    const parent = tmp("arggon-hermetic-unit-");
    const home = createHermeticHome(parent, "home");
    expect(home.root).toBe(join(parent, "home"));
    for (const dir of Object.values(home.env)) {
      expect(dir.startsWith(home.root)).toBe(true);
      expect(existsSync(dir)).toBe(true);
    }
    expect(home.env.HOME).toBe(home.root);
  });
});

describe("opencode-hermetic: seedHermeticCredentials", () => {
  /** A stub `opencode` answering `auth export` and recording `auth import`. */
  function stubOpencode(dir: string): { bin: string; imports: string } {
    const bin = join(dir, "opencode-stub");
    const imports = join(dir, "imports.txt");
    writeFileSync(
      bin,
      [
        "#!/bin/sh",
        'case "$1 $2" in',
        '  "auth export")',
        `    printf '%s' '[{"id":"cred_1","integrationID":"opencode-go","value":{"type":"key","key":"sk-x"}},{"id":"cred_2","integrationID":"other","value":{"type":"key","key":"sk-y"}}]'`,
        "    ;;",
        '  "auth import")',
        `    cat "$4" >> ${imports}`,
        // The real receipt is on stderr and singular by count (2.0.26).
        '    printf "Imported 1 credential\\n" >&2',
        "    ;;",
        "  *) exit 1 ;;",
        "esac",
        "",
      ].join("\n"),
      "utf8",
    );
    chmodSync(bin, 0o755);
    return { bin, imports };
  }

  it("exports under the host env, filters to the requested provider and imports into the hermetic home", () => {
    const dir = tmp("arggon-hermetic-seed-");
    const { bin, imports } = stubOpencode(dir);
    const home = createHermeticHome(dir, "home");
    const seed = seedHermeticCredentials(bin, home, { providers: ["opencode-go"] });
    expect(seed).toEqual({ ok: true, credentials: 1 });
    const imported = JSON.parse(readFileSync(imports.trim(), "utf8")) as Array<
      Record<string, unknown>
    >;
    expect(imported).toHaveLength(1);
    expect(imported[0]?.integrationID).toBe("opencode-go");
    // The seed file never outlives the import.
    expect(existsSync(join(home.root, "credential-seed.json"))).toBe(false);
  });

  it("reports a missing provider as a failed seed instead of importing nothing silently", () => {
    const dir = tmp("arggon-hermetic-seed-missing-");
    const { bin } = stubOpencode(dir);
    const home = createHermeticHome(dir, "home");
    const seed = seedHermeticCredentials(bin, home, { providers: ["not-configured"] });
    expect(seed.ok).toBe(false);
    expect(seed.error).toContain("not-configured");
  });
});
