---
type: task
status: done
id: task-session-cookies
title: Secure session cookies
parent: story-login
labels: [security]
assignee: arggon
created: "2026-09-03"
updated: "2026-09-03"
---

# Secure session cookies

## Context

Sessions should use HttpOnly, Secure, SameSite cookies with a sane TTL.

## Acceptance

- [x] Cookie flags set correctly in production
- [x] Logout clears the session cookie
