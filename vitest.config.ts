import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["cli/**/*.test.ts", "labs/**/*.test.ts"] },
});
