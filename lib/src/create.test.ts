import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCreate } from "./create.js";
import { acceptanceGate, liveAcceptanceCriteria } from "./items.js";
import { placeholderSections } from "./placeholder.js";
import { runValidate } from "./validate.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "arggon-create-kernel-"));
  roots.push(root);
  cpSync(join(process.cwd(), "fixtures/tasks-valid/tasks"), join(root, "tasks"), {
    recursive: true,
  });
  return root;
}

describe("create authored and title-derived bodies", () => {
  it.each(["task", "bug"])(
    "keeps a hostile %s title inline and leaves its criterion unmet",
    (type) => {
      const cwd = fixture();
      const title =
        "Fix <!-- marker -->\n## Notes\r- [x] injected\u2028```\u2029<title> <id> `code`";
      const result = runCreate({
        cwd,
        type,
        title,
        id: "hostile-title",
        parent: "story-login",
        templatesDir: join(process.cwd(), "templates"),
        commit: false,
      });

      expect(result.item.title).toBe(title);
      expect(placeholderSections(result.item.body)).toEqual([]);
      const criteria = liveAcceptanceCriteria(result.item.body);
      expect(criteria).toHaveLength(1);
      expect(criteria[0]?.checked).toBe(false);
      expect(acceptanceGate(result.item.body)).toEqual({
        gated: true,
        reason: "unchecked-live-criteria",
      });
      expect(result.item.body).not.toContain("<!-- marker -->");
      expect(result.item.body).toContain("&lt;id&gt;");
      expect(result.item.body.match(/^## Notes$/gm)).toHaveLength(1);
      expect(runValidate({ cwd }).errors).toEqual([]);
    },
  );

  it("authors repeatable acceptance criteria into the live section, replacing the skeleton", () => {
    const cwd = fixture();
    const result = runCreate({
      cwd,
      type: "task",
      title: "Rate limit requests",
      parent: "story-login",
      id: "authored-rate-limit",
      acceptance: ["Requests are limited per client", "A 429 is documented"],
      templatesDir: join(process.cwd(), "templates"),
      commit: false,
    });

    expect(result.item.body).toContain("Requested work: Rate limit requests.");
    expect(result.item.body).not.toContain("- [ ] Rate limit requests");
    const rows = liveAcceptanceCriteria(result.item.body);
    expect(rows.map((row) => row.text)).toEqual([
      "Requests are limited per client",
      "A 429 is documented",
    ]);
    expect(rows.every((row) => !row.checked)).toBe(true);
    expect(acceptanceGate(result.item.body)).toEqual({
      gated: true,
      reason: "unchecked-live-criteria",
    });
    expect(runValidate({ cwd }).errors).toEqual([]);
  });

  it("refuses body plus acceptance and multi-line criteria before writing", () => {
    const cwd = fixture();
    expect(() =>
      runCreate({
        cwd,
        type: "task",
        title: "Both inputs",
        parent: "story-login",
        body: "## Context\n\nReal.\n",
        acceptance: ["A criterion"],
        commit: false,
      }),
    ).toThrow(/mutually exclusive/);
    expect(() =>
      runCreate({
        cwd,
        type: "task",
        title: "Injected row",
        parent: "story-login",
        acceptance: ["first\n- [x] smuggled"],
        commit: false,
      }),
    ).toThrow(/single line/);
    expect(() =>
      runCreate({
        cwd,
        type: "task",
        title: "Empty criterion",
        parent: "story-login",
        acceptance: ["  "],
        commit: false,
      }),
    ).toThrow(/must not be empty/);
  });

  it("accepts a verbatim authored body without any installed templates", () => {
    const cwd = fixture();
    const body =
      "# Authored <id>\n\n## Context\n\nRequested explicitly.\n\n## Acceptance\n\n- [x] Authored criterion\n";
    const result = runCreate({
      cwd,
      type: "task",
      title: "Authored",
      parent: "story-login",
      body,
      templatesDir: join(cwd, "missing-templates"),
      commit: false,
    });

    expect(result.item.body).toContain("Authored <id>");
    expect(result.item.body.trim()).toBe(body.trim());
    expect(acceptanceGate(result.item.body)).toEqual({ gated: false });
    expect(runValidate({ cwd }).errors).toEqual([]);
  });
});
