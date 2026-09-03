---
type: task
status: todo
id: task-rate-limit
title: Add login rate limiting
parent: story-login
labels: [security]
created: 2026-09-03
updated: 2026-09-03
---

# Add login rate limiting

## Context

Brute-force attempts against `/login` should be throttled.

## Acceptance

- [ ] Limit failed attempts per IP and per account
- [ ] Return a clear error when limited
- [ ] Document defaults in ops notes
