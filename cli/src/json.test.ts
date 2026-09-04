import { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  JSON_SCHEMA_VERSION,
  bindJsonProgram,
  emitJson,
  failJson,
  jsonEnabled,
  successJson,
} from "./json.js";

describe("json helper", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
    bindJsonProgram(new Command());
  });

  it("emitJson writes compact JSON plus a newline to stdout", () => {
    const write = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    emitJson({ ok: true, schemaVersion: 1 });
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]?.[0]).toBe('{"ok":true,"schemaVersion":1}\n');
  });

  it("successJson writes ok:true envelope with payload", () => {
    const write = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    successJson("hello", { message: "hi" }, 0);
    const parsed = JSON.parse(String(write.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(parsed).toEqual({
      ok: true,
      schemaVersion: JSON_SCHEMA_VERSION,
      conventionVersion: 0,
      command: "hello",
      message: "hi",
    });
  });

  it("failJson writes ok:false envelope and sets exitCode 1", () => {
    const write = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    failJson({ command: "init", message: "boom", code: "INIT_FAILED" });
    expect(process.exitCode).toBe(1);
    const parsed = JSON.parse(String(write.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(parsed).toEqual({
      ok: false,
      schemaVersion: JSON_SCHEMA_VERSION,
      conventionVersion: 0,
      command: "init",
      error: { message: "boom", code: "INIT_FAILED" },
    });
  });

  it("jsonEnabled reads program.opts()", () => {
    const program = new Command();
    program.exitOverride();
    program.option("--json", "machine-readable JSON on stdout", false);
    program.command("noop").action(() => undefined);
    bindJsonProgram(program);

    program.parse(["noop"], { from: "user" });
    expect(jsonEnabled()).toBe(false);

    const withJson = new Command();
    withJson.exitOverride();
    withJson.option("--json", "machine-readable JSON on stdout", false);
    withJson.command("noop").action(() => undefined);
    bindJsonProgram(withJson);
    withJson.parse(["--json", "noop"], { from: "user" });
    expect(jsonEnabled()).toBe(true);
  });
});
