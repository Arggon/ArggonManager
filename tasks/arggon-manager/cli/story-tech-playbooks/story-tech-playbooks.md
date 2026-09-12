---
type: story
status: todo
id: story-tech-playbooks
title: Technology playbooks with version-freshness tracking
parent: cli
labels: []
created: "2026-09-12"
updated: "2026-09-12"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-tech-playbooks/story-tech-playbooks.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Technology playbooks with version-freshness tracking

## Context

Technology playbooks: per-tech docs (docs/playbooks/<tech>.md) with the chosen version, researched date, and current best practices (setup, conventions, testing, security, upgrade policy), generated after a documented exploration. Research found no public standard combining exploration -> decision -> version-pinned playbooks -> staleness tracking — this is Arggon's differentiator: agents follow current best practices by default, and the tracker itself drives doc freshness (stale playbook files a task, like the container cascade drives completion).

## Acceptance

- [ ] `arggon stack explore` + `arggon playbook new/status` landed with docs
- [ ] Stale playbooks (>90d, configurable) are flagged and can file a re-research task into the tracker
