---
description: Create or refresh a technology playbook with dated research
---

Handle the technology playbook for $ARGUMENTS (pipeline: explore → ADR →
playbook, details in `references/methodology.md` in the `arggon-cli` skill).

1. Scaffold with the CLI: `arggon playbook new <tech> --version <v>` →
   `docs/playbooks/<tech>.md` (never hand-create it). Research is your job:
   current version and best practices with dated sources.
2. Fill the template sections: Setup, Conventions, Testing, Security, Upgrade
   policy.
3. Freshness: `arggon playbook status` flags playbooks older than the
   threshold (default 90 days); `--file-task <story-id>` files one re-research
   task per stale playbook.
4. After re-researching: `arggon playbook refresh <tech> --version <v>`
   (frontmatter only — the body keeps the curated content).
5. Report the path, the pinned version and the freshness state.
