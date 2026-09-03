---
type: task
status: in_progress
id: task-session-cookies
title: Secure session cookies
parent: story-login
labels: [security]
assignee: arggon
created: 2026-09-03
updated: 2026-09-03
---

# Secure session cookies

## Context

Sessions should use HttpOnly, Secure, SameSite cookies with a sane TTL.

## Acceptance

- [ ] Cookie flags set correctly in production
- [ ] Logout clears the session cookie
