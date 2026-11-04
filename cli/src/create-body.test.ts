/**
 * #870 / task-create-needs-a-body-flag-to-author-a-live-contract.
 * Real CLI subprocesses, real git commits, and the documented validate hook.
 * Setup alone uses the kernel; no hook, git, or command outcome is mocked.
 */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  liveAcceptanceRegion,
  liveContextRegion,
  parseFrontmatter,
  runCreate,
} from "@arggondev/lib";
import { runInit } from "./init.js";
import { cliNodeArgs, readEnvelope, runCli } from "./test-spawn.js";
import { initFixtureRepo, removeFixtureTree } from "./test-tmp.js";

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) removeFixtureTree(dir);
});

function git(dir: string, args: string[]): string {
  const proc = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  expect(proc.status, `git ${args.join(" ")}: ${proc.stderr}\n${proc.stdout}`).toBe(0);
  return proc.stdout.trim();
}

function jsonCli(dir: string, args: string[], status = 0): Record<string, unknown> {
  const proc = runCli(["--json", ...args], dir, { timeout: 60_000 });
  expect(proc.status, `${args.join(" ")}: ${proc.stderr}\n${proc.stdout}`).toBe(status);
  const parsed = readEnvelope({
    surface: "CLI",
    command: `arggon ${args.join(" ")}`,
    text: proc.stdout,
    stderr: proc.stderr,
  });
  expect(parsed.exact, "--json stdout must contain only its envelope").toBe(true);
  expect(parsed.envelope.ok).toBe(status === 0);
  return parsed.envelope;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function hookReceipt(dir: string): string {
  const path = join(dir, ".git", "create-body-hook.log");
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function installHook(dir: string, command = "npm run arggon -- validate"): void {
  const path = join(dir, ".git", "hooks", "pre-commit");
  // The receipt proves git actually invoked the hook, including on success.
  // The validation command is the playbook's real pre-commit recipe.
  writeFileSync(path, `#!/bin/sh\nprintf 'hook\\n' >> .git/create-body-hook.log\n${command}\n`);
  chmodSync(path, 0o755);
}

function fixture(gitBacked = true): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-create-body-"));
  tmpDirs.push(dir);
  if (gitBacked) {
    // Shared helper supplies a local git identity and disables detached maintenance.
    initFixtureRepo(dir);
    git(dir, ["config", "core.hooksPath", join(dir, ".git", "hooks")]);
    git(dir, ["config", "commit.gpgsign", "false"]);
  }
  runInit({ dir, force: false });
  const body =
    "## Context\n\nFixture containers hold the contract authoring scenarios.\n\n## Acceptance\n\n- [ ] Exercise the leaf lifecycle.\n";
  // Containers intentionally retain their templates in this ticket. Seed real
  // prose so a container placeholder cannot masquerade as a leaf regression.
  runCreate({ cwd: dir, type: "initiative", title: "Launch", body, commit: false });
  runCreate({ cwd: dir, type: "epic", title: "Authoring", parent: "launch", body, commit: false });
  runCreate({
    cwd: dir,
    type: "story",
    title: "Contracts",
    parent: "authoring",
    body,
    commit: false,
  });
  if (gitBacked) {
    // npm runs the same source CLI/kernel resolver as runCli, from the fixture
    // cwd. This exercises the documented hook without depending on global bins.
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        private: true,
        scripts: { arggon: [process.execPath, ...cliNodeArgs()].map(shellQuote).join(" ") },
      }),
    );
    git(dir, ["add", "-A"]);
    git(dir, ["commit", "--quiet", "-m", "fixture contracts"]);
    installHook(dir);
  }
  return dir;
}

function leafPath(dir: string, id: string): string {
  return join(dir, "ArggonManager", "launch", "authoring", "contracts", `${id}.md`);
}

function bodyAt(path: string): string {
  return parseFrontmatter(readFileSync(path, "utf8")).body;
}

function expectCommitted(dir: string, envelope: Record<string, unknown>, id: string): void {
  expect(envelope).toMatchObject({
    command: "create",
    path: `ArggonManager/launch/authoring/contracts/${id}.md`,
    item: { id, status: "todo" },
    commit: { message: `chore(tasks): created ${id}` },
  });
  const commit = envelope.commit as { hash: string };
  expect(commit.hash).toMatch(/^[0-9a-f]{7,40}$/);
  expect(git(dir, ["rev-parse", "HEAD"]).startsWith(commit.hash)).toBe(true);
  expect(git(dir, ["show", "--name-only", "--format=", "HEAD"])).toBe(envelope.path);
  expect(git(dir, ["status", "--porcelain"])).toBe("");
}

describe("create body and auto-commit command contract", () => {
  it.each(["task", "bug"] as const)(
    "default %s has title-derived live prose and an unchecked criterion, validates and commits",
    (type) => {
      const dir = fixture();
      const title = "Preserve the authored contract";
      const id = `${type}-preserve-the-authored-contract`;
      const envelope = jsonCli(dir, ["create", type, title, "--parent", "contracts"]);
      const body = bodyAt(leafPath(dir, id));
      const context = liveContextRegion(body);
      const acceptance = liveAcceptanceRegion(body);
      expect(context).toContain(title);
      expect(context).not.toContain("<!--");
      expect(acceptance).toMatch(/^- \[ \] .+/m);
      expect(acceptance).toContain(title);
      expect(acceptance).not.toContain("<!--");
      expect(acceptance).not.toMatch(/- \[[xX]\]/);
      expectCommitted(dir, envelope, id);
      expect(hookReceipt(dir)).toBe("hook\n");
      expect(jsonCli(dir, ["validate"]).command).toBe("validate");
    },
  );

  it.each(["task", "bug"] as const)(
    "authored %s is created, claimed and completed with no body edit, cascade or waiver",
    (type) => {
      const dir = fixture();
      const body =
        "## Context\n\nCréation publishes the real contract — no later hand-edit is needed.\n\n## Acceptance\n\n- [x] The authored criterion is already satisfied.\n";
      const source = join(dir, ".git", "authored body.md");
      writeFileSync(source, body, "utf8");
      const id = `${type}-author-a-live-contract`;
      const created = jsonCli(dir, [
        "create",
        type,
        "Author a live contract",
        "--parent",
        "contracts",
        "--body",
        source,
      ]);
      const path = leafPath(dir, id);
      expect(bodyAt(path)).toBe(body);
      expectCommitted(dir, created, id);
      jsonCli(dir, ["update", id, "--status", "in_progress", "--assignee", "fixture"]);
      expect(bodyAt(path)).toBe(body);
      const done = jsonCli(dir, ["update", id, "--status", "done", "--no-cascade"]);
      expect(done).toMatchObject({ item: { id, status: "done" }, autoCompleted: [] });
      expect(parseFrontmatter(readFileSync(path, "utf8")).data.status).toBe("done");
      expect(bodyAt(path)).toBe(body);
      expect(bodyAt(path)).not.toMatch(/### Waiver/);
      expect(
        parseFrontmatter(
          readFileSync(join(dir, "ArggonManager/launch/authoring/contracts/contracts.md"), "utf8"),
        ).data.status,
      ).toBe("todo");
      expect(hookReceipt(dir)).toBe("hook\nhook\nhook\n");
      expect(git(dir, ["status", "--porcelain"])).toBe("");
      jsonCli(dir, ["validate"]);
    },
  );

  it("authors acceptance criteria from the repeatable flag, validates and commits", () => {
    const dir = fixture();
    const id = "task-acceptance-flag";
    const created = jsonCli(dir, [
      "create",
      "task",
      "Rate limit requests",
      "--parent",
      "contracts",
      "--id",
      "acceptance-flag",
      "--acceptance",
      "Requests are limited per client",
      "--acceptance",
      "A 429 response is documented",
    ]);
    const body = bodyAt(leafPath(dir, id));
    expect(liveContextRegion(body)).toContain("Rate limit requests");
    const acceptance = liveAcceptanceRegion(body) ?? "";
    expect(acceptance).toContain("- [ ] Requests are limited per client");
    expect(acceptance).toContain("- [ ] A 429 response is documented");
    expect(acceptance).not.toContain("- [ ] Rate limit requests");
    expect(acceptance).not.toContain("<!--");
    expectCommitted(dir, created, id);
    expect(hookReceipt(dir)).toBe("hook\n");
    expect(jsonCli(dir, ["validate"]).command).toBe("validate");
  });

  it("refuses body plus acceptance before writing anything", () => {
    const dir = fixture();
    const source = join(dir, ".git", "both inputs.md");
    writeFileSync(source, "## Context\n\nReal.\n\n## Acceptance\n\n- [ ] Real.\n", "utf8");
    const failed = jsonCli(
      dir,
      [
        "create",
        "task",
        "Both inputs",
        "--parent",
        "contracts",
        "--body",
        source,
        "--acceptance",
        "A criterion",
      ],
      1,
    );
    expect(failed).toMatchObject({ command: "create", error: { code: "CREATE_FAILED" } });
    expect(JSON.stringify(failed)).toContain("mutually exclusive");
    expect(existsSync(leafPath(dir, "task-both-inputs"))).toBe(false);
    expect(git(dir, ["status", "--porcelain"])).toBe("");
    expect(hookReceipt(dir)).toBe("");
  });

  it("reports actual validate hook rejection as typed JSON failure and retains the authored item", () => {
    const dir = fixture();
    jsonCli(dir, ["validate"]);
    const head = git(dir, ["rev-parse", "HEAD"]);
    const body =
      "## Context\n\n<!-- Why this task exists. -->\n\n## Acceptance\n\n- [ ] Replace the placeholder with real context.\n";
    const source = join(dir, ".git", "placeholder.md");
    writeFileSync(source, body, "utf8");
    const id = "task-rejected-placeholder";
    const failed = jsonCli(
      dir,
      ["create", "task", "Rejected placeholder", "--parent", "contracts", "--body", source],
      1,
    );
    expect(failed).toMatchObject({
      command: "create",
      error: { code: "CREATE_COMMIT_FAILED" },
      path: "ArggonManager/launch/authoring/contracts/task-rejected-placeholder.md",
      item: { id, status: "todo", title: "Rejected placeholder" },
      commit: {
        failure: "git-commit-failed",
        skipped: expect.stringMatching(/git commit failed/i),
      },
    });
    expect(bodyAt(leafPath(dir, id))).toBe(body);
    expect(hookReceipt(dir)).toBe("hook\n");
    expect(git(dir, ["rev-parse", "HEAD"])).toBe(head);
    expect(git(dir, ["status", "--porcelain"])).toContain(`${id}.md`);
    const validation = jsonCli(dir, ["validate"], 1);
    expect(JSON.stringify(validation)).toContain("PLACEHOLDER_BODY");
  });

  it("returns exit 1 with retained path and hook diagnostic in human output on arbitrary hook rejection", () => {
    const dir = fixture();
    installHook(dir, "echo fixture-arbitrary-hook-rejected >&2\nexit 1");
    const head = git(dir, ["rev-parse", "HEAD"]);
    const proc = runCli(["create", "bug", "Hook refused", "--parent", "contracts"], dir);
    expect(proc.status, `${proc.stderr}\n${proc.stdout}`).toBe(1);
    const output = proc.stdout + proc.stderr;
    expect(output).toContain("fixture-arbitrary-hook-rejected");
    expect(output).toContain(leafPath(dir, "bug-hook-refused"));
    expect(existsSync(leafPath(dir, "bug-hook-refused"))).toBe(true);
    expect(hookReceipt(dir)).toBe("hook\n");
    expect(git(dir, ["rev-parse", "HEAD"])).toBe(head);
  });

  it.each([true, false])("missing body file fails before writing (json=%s)", (json) => {
    const dir = fixture();
    const before = git(dir, ["status", "--porcelain"]);
    const head = git(dir, ["rev-parse", "HEAD"]);
    const source = join(dir, "missing body.md");
    const args = ["create", "task", "Missing source", "--parent", "contracts", "--body", source];
    if (json) {
      const failed = jsonCli(dir, args, 1);
      expect(failed).toMatchObject({ command: "create", error: { code: "CREATE_FAILED" } });
      expect(JSON.stringify(failed)).toContain("missing body.md");
    } else {
      const proc = runCli(args, dir);
      expect(proc.status, proc.stderr + proc.stdout).toBe(1);
      expect(proc.stderr + proc.stdout).toContain("missing body.md");
    }
    expect(existsSync(leafPath(dir, "task-missing-source"))).toBe(false);
    expect(git(dir, ["status", "--porcelain"])).toBe(before);
    expect(git(dir, ["rev-parse", "HEAD"])).toBe(head);
    expect(hookReceipt(dir)).toBe("");
  });

  it("--no-commit is successful, keeps the item, and never invokes a rejecting hook", () => {
    const dir = fixture();
    installHook(dir, "echo must-not-run >&2\nexit 1");
    const head = git(dir, ["rev-parse", "HEAD"]);
    const created = jsonCli(dir, [
      "create",
      "task",
      "Keep dirty",
      "--parent",
      "contracts",
      "--no-commit",
    ]);
    expect(created).toMatchObject({ commit: { skipped: "auto-commit disabled" } });
    expect(created.commit).not.toHaveProperty("failure");
    expect(existsSync(leafPath(dir, "task-keep-dirty"))).toBe(true);
    expect(git(dir, ["rev-parse", "HEAD"])).toBe(head);
    expect(hookReceipt(dir)).toBe("");
  });

  it("non-git create remains successful with an explicitly benign commit skip", () => {
    const dir = fixture(false);
    const created = jsonCli(dir, ["create", "bug", "No git needed", "--parent", "contracts"]);
    expect(created).toMatchObject({ commit: { skipped: "not a git repository" } });
    expect(created.commit).not.toHaveProperty("failure");
    expect(existsSync(leafPath(dir, "bug-no-git-needed"))).toBe(true);
  });

  it.each([
    { name: "empty", input: "", expected: "" },
    {
      name: "multiline UTF-8 and CRLF",
      input:
        "## Context\r\n\r\nCafé — 雪\r\n  keep spacing and <title> literally\r\n\r\n## Acceptance\r\n\r\n- [x] Preserve <story-id>.\r\n",
      expected:
        "## Context\r\n\r\nCafé — 雪\r\n  keep spacing and <title> literally\r\n\r\n## Acceptance\r\n\r\n- [x] Preserve <story-id>.\r\n",
    },
    // Existing frontmatter serialization supplies a terminal newline. The body
    // payload is not trimmed, templated or interpreted as another frontmatter.
    {
      name: "no terminal newline",
      input: "  literal <title>  ",
      expected: "  literal <title>  \n",
    },
  ])("explicit $name body overrides a repository-local template", ({ input, expected }) => {
    const dir = fixture();
    writeFileSync(join(dir, "templates", "task.md"), "# LOCAL TEMPLATE MUST NOT WIN\n");
    const source = join(dir, ".git", "override body.md");
    writeFileSync(source, input, "utf8");
    const created = jsonCli(dir, [
      "create",
      "task",
      "Explicit override",
      "--parent",
      "contracts",
      "--body",
      ".git/override body.md",
      "--no-commit",
    ]);
    expect(created).toMatchObject({ item: { id: "task-explicit-override" } });
    expect(bodyAt(leafPath(dir, "task-explicit-override"))).toBe(expected);
    expect(hookReceipt(dir)).toBe("");
  });
});
