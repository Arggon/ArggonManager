<!--
  Pull request template for {{PROJECT_NAME}}.
  Work items live under ArggonManager/ — reference the item id (e.g. task-<slug>) below.
-->

## Summary

<!-- What does this PR change and why? One or two sentences. -->

## Work item

- Item id: `<!-- task-<slug> / bug-<slug> / story-<slug> -->`
- Status: <!-- claimed / in_progress; move to done only when this PR fully finishes it -->

## Risk triage

Does this hit a risk trigger? Which one?

<!-- risk-security / risk-destructive / risk-compatibility / risk-supply-chain / risk-safety-critical / none — see ArggonManager/docs/engineering.md §Review bar → Risk triage. A triggered change needs a recorded human acceptance and, for security/compatibility/supply-chain, an authenticated GitHub review before merge. -->

## Checklist

- [ ] Acceptance checklist in the work item body is complete
- [ ] The verification this project declares passes locally (software worked example: `npm test` or the project's equivalent)
- [ ] Docs updated in the same PR where behavior changed
- [ ] PR title or body references the work item id
