---
description: Close a finished item after verifying its gates
---

Close $ARGUMENTS following the done criteria:

1. Read the item with `arggon_show <id> --body` and verify every acceptance
   checkbox is honest and complete (tick the boxes in the file when the work is
   done).
2. Confirm the PR is merged (or the completing change is on the default branch)
   and `arggon_validate` is green.
3. `arggon_update` with status `done` — add `--no-cascade` when an
   administrative item must not auto-complete product containers.
4. If you are a worker subagent: stop at step 2 and report to the coordinator.
   Completion is the coordinator's call after merge.
