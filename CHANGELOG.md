<!-- arggon:generated template="CHANGELOG.md" -->
# Changelog

All notable changes to ArggonManager are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Self-hosted governance stack (story-dogfood-self-host): convention v3 with `branch_patterns` and `x-tracker.auto-commit` in `tasks/.convention.yml`; bundled agent skill at `.agents/skills/arggon-cli/SKILL.md`; generated adopter docs (`.editorconfig`, `.github/CODEOWNERS`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/copilot-instructions.md`, `SECURITY.md`, `SUPPORT.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `docs/tracking.md`, `docs/runbooks/README.md`); technology playbooks for node/typescript/vitest under `docs/playbooks/`; a local pre-commit hook running `arggon validate`.

### Changed

- `cli/src/cli.test.ts`: the `hello` envelope test now reads the tree's convention version instead of hardcoding the default 0.
