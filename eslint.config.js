import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      // Generated single-file plugin bundle (rebuilt by `npm run build:plugin`)
      // and its derived, gitignored vendored copy.
      "opencode/plugins/arggon/index.bundle.ts",
      ".opencode/**",
    ],
  },
  ...tseslint.configs.recommended,
);
