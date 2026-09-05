# Phase 2 viewer / board spike

- **Status:** Proposed (spike notes — **not** an accepted ADR)
- **Epic:** [#19](https://github.com/Arggon/ArggonManager/issues/19) — Viewer / board UI over the task tree
- **Author:** Software Developer 6
- **Date:** 2026-09-05

A later **ADR is required** before adding any viewer/board package (see [ADR process](./engineering.md#adr-process) — “Adding a new top-level package”). This document only locks product/engineering **constraints** so a UI PR can start cleanly once Phase 1 CLI is stable.

---

## 1. Goal

Ship a **read-only board first**, then **thin edits**, over the **same** git-native `tasks/` tree defined in [`docs/convention.md`](./convention.md).

- **Git files remain the source of truth** — no parallel schema, no SaaS board that drifts from the repo.
- The viewer renders and (later) edits work items that already live under `tasks/`; it does not become a second store.

Matches epic #19 acceptance intent: render statuses/types from `tasks/`; still treat git files as source of truth.

---

## 2. Read path

**Reuse the CLI domain / JSON contract** — do not invent a second tree reader inside the viewer.

| Source | Role |
| --- | --- |
| [`docs/json-output.md`](./json-output.md) `WorkItem` | Stable shape for items (id, type, status, title, parent, path, …) |
| `arggon list --json` | Primary read path for v0 (envelope v1, `items: WorkItem[]`) |
| Future `arggon validate` ([#13](https://github.com/Arggon/ArggonManager/issues/13)) | Integrity / diagnostics for the same tree — viewer may surface results, not re-implement rules |

Any shared parsing should live with the CLI kernel (or a future extracted package **after** an ADR), not duplicated in UI code.

---

## 3. Render (v0)

- **Statuses and types** come from YAML frontmatter (convention v0 enums):  
  types `initiative` \| `epic` \| `story` \| `task` \| `bug`;  
  statuses `todo` \| `in_progress` \| `blocked` \| `done` \| `cancelled`.
- **Hierarchy:** initiative → epic → story → task/bug (folder tree + `parent` / path as in convention).
- **No status rollup in v0** — parent status is not computed from children; show each item’s own `status`.

---

## 4. Out of scope until Phase 1 CLI is stable

Do **not** start a viewer package while these are still in flight:

| Issue | Topic |
| --- | --- |
| [#12](https://github.com/Arggon/ArggonManager/issues/12) | `arggon update` |
| [#13](https://github.com/Arggon/ArggonManager/issues/13) | `arggon validate` |
| [#16](https://github.com/Arggon/ArggonManager/issues/16) | Claim / concurrency |
| [#15](https://github.com/Arggon/ArggonManager/issues/15) | Agent playbook |

Also aligns with [`docs/engineering.md`](./engineering.md) Phase 2 boundary notes: no pre-building viewer packages in Phase 1.

---

## 5. Non-goals

- **Agent SDK / hooks** — epic [#20](https://github.com/Arggon/ArggonManager/issues/20) (Phase 3); out of this spike.
- **New frontmatter keys** for the viewer — convention v0 stays locked; no UI-only schema fork.
- **Write API that bypasses convention / CLI** — edits must go through the same rules humans/agents use (CLI or equivalent file writes that `validate` would accept), not a private board dialect.

---

## 6. Open questions (Architect / PM)

1. **Stack for the viewer** — which UI stack (and package layout) once an ADR is written?
2. **Local-only vs hosted** — desktop/local static app over a checkout, vs any hosted UI?
3. **Edit path** — thin edits via **CLI** (`update` / claim) vs **direct file write** in the working tree (still git-native, still convention-valid)?

These decisions belong in a follow-up ADR before code lands.

---

## 7. Acceptance mapping (this PR)

| Epic #19 acceptance | This PR |
| --- | --- |
| Can render statuses/types from `tasks/` | **Not implemented** — constraints locked so a later UI PR can |
| Still treats git files as source of truth | Affirmed: same tree, CLI/`WorkItem` read path, no parallel schema |

**This PR does not close #19.** It is spike notes only (`Towards #19`). Closing the epic requires a later viewer implementation after Phase 1 stability and an accepted package ADR.