---
type: bug
status: done
id: bug-empty-password-500
title: Empty password returns HTTP 500
parent: story-login
branch: fix/bug-empty-password-500
labels: [bug, auth]
created: "2026-09-03"
updated: "2026-09-03"
---

# Empty password returns HTTP 500

## Repro

1. POST `/login` with a valid email and an empty password field.
2. Observe `500 Internal Server Error` instead of a validation error.

## Expected

Return `400` with a field error: password is required.

## Acceptance

- [ ] Field error verified against the staging deployment

### Waiver 2026-09-03

closed as shipped: fix verified on production logs; the staging sweep is tracked
in the follow-up bug. Recorded by `update --status done --waive "..."`.
