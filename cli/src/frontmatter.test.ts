import { mkdtempSync as _mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  parseFrontmatter,
  runComment,
  runCreate,
  runUpdate,
  runValidate,
  stringifyFrontmatter,
} from "@arggondev/lib";

import { runInit } from "./init.js";

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string, options?: { encoding?: "utf8" }): string {
  const dir = _mkdtempSync(prefix, options);
  tmpDirs.push(dir);
  return dir;
}

const NOW = new Date("2026-09-11T12:00:00Z");
const LATER = new Date("2026-09-12T12:00:00Z");

/** The exact `title:` line of an item file (raw bytes, escapes intact). */
function rawTitleLine(path: string): string {
  const line = readFileSync(path, "utf8").match(/^title:.*$/m)?.[0];
  if (!line) throw new Error(`no title line in ${path}`);
  return line;
}

/** Raw (file-level) backslashes in one line. */
function rawBackslashes(line: string): number {
  return (line.match(/\\/g) ?? []).length;
}

/** Minimal story-seeded tree so a task can be created (mirrors comment.test.ts). */
function primedTask(): { dir: string } {
  const dir = mkdtempSync(join(tmpdir(), "arggon-frontmatter-"));
  runInit({ dir, force: false, commit: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch MVP", now: NOW, commit: false });
  runCreate({
    cwd: dir,
    type: "epic",
    title: "Auth",
    parent: "launch-mvp",
    now: NOW,
    commit: false,
  });
  runCreate({
    cwd: dir,
    type: "story",
    title: "Login",
    parent: "auth",
    id: "story-login",
    now: NOW,
    commit: false,
  });
  return { dir };
}

describe("frontmatter quoted-scalar round-trip (bug-tracker-title-rescape)", () => {
  it("unescapes a YAML double-quoted scalar instead of returning raw bytes", () => {
    // Raw file text has TWO backslashes (YAML escape for one literal `\`).
    const { data } = parseFrontmatter(String.raw`---
type: task
title: "nits: \\( here"
---`);
    expect(data.title).toBe("nits: \\( here"); // one literal backslash
  });

  it("decodes the full YAML double-quoted escape set", () => {
    const { data } = parseFrontmatter(
      String.raw`---
type: task
title: "a\tb \u0041 \x42 \\ \"q\" \q \ "
---`,
    );
    expect(data.title).toBe('a\tb A B \\ "q" \\q  ');
  });

  it("decodes doubled single quotes in a single-quoted scalar", () => {
    const { data } = parseFrontmatter(`---\ntype: task\ntitle: 'it''s fine'\n---\n`);
    expect(data.title).toBe("it's fine");
  });

  it("writes backslash-bearing values quoted and keeps the rewrite byte-stable", () => {
    const title = "nits: escaped \\\\( in command position"; // two literal backslashes
    const once = stringifyFrontmatter(
      { type: "task", status: "todo", id: "task-x", title },
      "# x\n",
    );
    expect(rawBackslashes(rawTitleLineFrom(once))).toBe(4); // JSON-escaped, quoted
    const reread = parseFrontmatter(once);
    expect(reread.data.title).toBe(title);
    const twice = stringifyFrontmatter(reread.data, reread.body);
    expect(twice).toBe(once);
  });

  it("does not grow an ALREADY-corrupted value on repeated rewrites", () => {
    // Eight raw backslashes decode to four; the rewrite must stay at eight.
    const corrupt = String.raw`---
type: task
status: todo
id: task-x
title: "nits: \\\\\\\\( here"
---
`;
    let out = corrupt;
    for (let i = 0; i < 3; i++) {
      const { data, body } = parseFrontmatter(out);
      out = stringifyFrontmatter(data, body);
      expect(rawBackslashes(rawTitleLineFrom(out))).toBe(8);
    }
    expect(parseFrontmatter(out).data.title).toBe("nits: \\\\\\\\( here"); // four literal backslashes
  });

  it("survives create/claim/comment/comment/update without backslash growth", () => {
    const { dir } = primedTask();
    const title = "Backslash nits: escaped \\\\( in command position";
    const created = runCreate({
      cwd: dir,
      type: "task",
      title,
      parent: "story-login",
      id: "escape-nits",
      now: NOW,
      commit: false,
    });
    const id = created.id;
    const path = created.path;

    const expectStable = (step: string) => {
      expect(rawBackslashes(rawTitleLine(path)), `after ${step}`).toBe(4);
      expect(parseFrontmatter(readFileSync(path, "utf8")).data.title, `after ${step}`).toBe(title);
    };
    expectStable("create");

    runUpdate({
      cwd: dir,
      id,
      status: "in_progress",
      assignee: "arggon",
      now: NOW,
    });
    expectStable("claim");

    runComment({ cwd: dir, id, text: "first note", author: "arggon", now: NOW, commit: false });
    expectStable("comment 1");

    runComment({ cwd: dir, id, text: "second note", author: "arggon", now: LATER, commit: false });
    expectStable("comment 2");

    runUpdate({ cwd: dir, id, priority: "p2", now: LATER });
    expectStable("update");

    // The tree stays valid throughout (validate reads the same parse path).
    expect(runValidate({ cwd: dir }).errors).toEqual([]);
  });

  it("escapes control characters so a hand-written \\n escape cannot corrupt the tree", () => {
    // Serializer: decoded control characters are escaped, never written raw.
    for (const value of ["a\nb", "\x00nul", "\x07bell", "\x1besc", "\u007fdel", "\u2028sep"]) {
      const once = stringifyFrontmatter({ type: "task", id: "task-x", title: value }, "");
      const reread = parseFrontmatter(once);
      expect(reread.data.title).toBe(value);
      expect(/[\u0000-\u001f\u007f\u2028\u2029]/.test(rawTitleLineFrom(once))).toBe(false);
      expect(stringifyFrontmatter(reread.data, reread.body)).toBe(once);
    }

    // Kernel: a hand-written YAML `\n` escape (raw bytes backslash+n, value =
    // newline) survives update, leaves the tree valid, and is byte-stable.
    const { dir } = primedTask();
    const created = runCreate({
      cwd: dir,
      type: "task",
      title: "escape probe",
      parent: "story-login",
      id: "control-escape",
      now: NOW,
      commit: false,
    });
    const path = created.path;
    writeFileSync(
      path,
      readFileSync(path, "utf8").replace(/^title:.*$/m, String.raw`title: "a\nb"`),
    );

    runUpdate({ cwd: dir, id: created.id, priority: "p1", now: LATER });
    expect(rawTitleLine(path)).toBe(String.raw`title: "a\nb"`);
    expect(parseFrontmatter(readFileSync(path, "utf8")).data.title).toBe("a\nb");
    expect(runValidate({ cwd: dir }).errors).toEqual([]);

    // Re-running the same update rewrites identical bytes.
    const after = readFileSync(path, "utf8");
    runUpdate({ cwd: dir, id: created.id, priority: "p1", now: LATER });
    expect(readFileSync(path, "utf8")).toBe(after);
  });
});

describe("frontmatter ambiguous plain scalars (bug-frontmatter-ambiguous-plain-scalar-loss)", () => {
  /** Tokens `parseValue`/`parseScalar` would decode as a NON-string when bare. */
  const TOKENS = [
    "null",
    "~",
    "true",
    "false",
    "0",
    "42",
    "-7",
    "00",
    "-0",
    "007",
    "0123",
    "-007",
    "9007199254740993",
    "12345678901234567890",
  ];

  it("quotes every token the reader would decode as a non-string, byte-stable", () => {
    for (const token of TOKENS) {
      const once = stringifyFrontmatter(
        { type: "task", status: "todo", id: "task-x", title: token },
        "# x\n",
      );
      expect(rawTitleLineFrom(once), `write "${token}"`).toBe(`title: "${token}"`);
      const reread = parseFrontmatter(once);
      expect(reread.data.title, `read "${token}"`).toBe(token);
      expect(stringifyFrontmatter(reread.data, reread.body), `rewrite "${token}"`).toBe(once);
    }
  });

  it("keeps an ambiguous token in labels and depends_on elements verbatim", () => {
    const data = {
      type: "task",
      status: "todo",
      id: "task-x",
      labels: ["06"],
      depends_on: ["007"],
    };
    const once = stringifyFrontmatter(data, "# x\n");
    expect(once).toContain('labels: ["06"]');
    expect(once).toContain('depends_on: ["007"]');
    const reread = parseFrontmatter(once);
    expect(reread.data.labels).toEqual(["06"]);
    expect(reread.data.depends_on).toEqual(["007"]);
    expect(stringifyFrontmatter(reread.data, reread.body)).toBe(once);
  });

  it("keeps REAL numbers bare in scalars and list elements", () => {
    // A genuine number keeps its bare token so the reader decodes the SAME
    // type back — the fix only quotes strings (and non-number list elements,
    // which the reader decodes as strings either way).
    const data = { type: "task", status: "todo", id: "task-x", "x-n": 6 };
    const once = stringifyFrontmatter(data, "# x\n");
    expect(once).toContain("x-n: 6");
    const reread = parseFrontmatter(once);
    expect(reread.data["x-n"]).toBe(6);
    expect(stringifyFrontmatter(reread.data, reread.body)).toBe(once);

    const listed = stringifyFrontmatter(
      { type: "task", status: "todo", id: "task-x", "x-list": [1, true, null] },
      "# x\n",
    );
    expect(listed).toContain('x-list: [1, "true", "null"]');
    const rereadList = parseFrontmatter(listed);
    expect(rereadList.data["x-list"]).toEqual([1, "true", "null"]);
    expect(stringifyFrontmatter(rereadList.data, rereadList.body)).toBe(listed);
  });

  it("still tolerates a file already written with a bare token (reader unchanged)", () => {
    // Old tree: `title: 0123` bare. It parses (as the number 123 — the loss is
    // already baked in), validate stays green, and the rewrite is a stable
    // fixed point: no throw, no new corruption.
    const legacy = `---
type: task
status: todo
id: task-legacy
title: 0123
labels: []
created: "2026-09-11"
---

# legacy
`;
    const first = parseFrontmatter(legacy);
    expect(first.data.title).toBe(123); // reader-side, unchanged
    const once = stringifyFrontmatter(first.data, first.body);
    expect(rawTitleLineFrom(once)).toBe("title: 123"); // bare number stays bare
    const twice = stringifyFrontmatter(parseFrontmatter(once).data, parseFrontmatter(once).body);
    expect(twice).toBe(once);
  });

  it("survives create/show/update through the kernel with a numeric title", () => {
    const { dir } = primedTask();
    const created = runCreate({
      cwd: dir,
      type: "task",
      title: "0123",
      parent: "story-login",
      id: "ambiguous-nits",
      now: NOW,
      commit: false,
    });
    const path = created.path;

    // create: the file already carries the lossless quoted form.
    expect(rawTitleLine(path)).toBe('title: "0123"');
    expect(parseFrontmatter(readFileSync(path, "utf8")).data.title).toBe("0123");

    // update: the rewrite cannot change bytes (no loss to bake in).
    runUpdate({ cwd: dir, id: created.id, labels: "probe", now: LATER });
    expect(rawTitleLine(path)).toBe('title: "0123"');
    expect(parseFrontmatter(readFileSync(path, "utf8")).data.title).toBe("0123");
    expect(parseFrontmatter(readFileSync(path, "utf8")).data.labels).toEqual(["probe"]);

    // The tree stays valid throughout (validate reads the same parse path).
    expect(runValidate({ cwd: dir }).errors).toEqual([]);
  });
});

/** `title:` line extracted from already-serialized frontmatter text. */
function rawTitleLineFrom(frontmatter: string): string {
  const line = frontmatter.match(/^title:.*$/m)?.[0];
  if (!line) throw new Error("no title line in serialized frontmatter");
  return line;
}
