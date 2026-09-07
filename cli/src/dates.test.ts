import { describe, expect, it } from "vitest";
import { formatDate } from "./dates.js";

describe("dates", () => {
  it("formats UTC calendar dates as YYYY-MM-DD", () => {
    expect(formatDate(new Date("2026-09-03T12:00:00Z"))).toBe("2026-09-03");
    expect(formatDate(new Date("2026-09-03T00:00:00Z"))).toBe("2026-09-03");
  });
});