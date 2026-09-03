---
type: bug
status: todo
id: bug-empty-password-500
title: Empty password returns HTTP 500
parent: story-login
labels: [bug, auth]
created: 2026-09-03
updated: 2026-09-03
---

# Empty password returns HTTP 500

## Repro

1. POST `/login` with a valid email and an empty password field.
2. Observe `500 Internal Server Error` instead of a validation error.

## Expected

Return `400` with a field error: password is required.
