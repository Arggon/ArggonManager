---
type: task
status: blocked
id: task-google-provider
title: Add Google OAuth provider
parent: story-oauth
labels: [auth]
assignee: arggon
blocked_reason: Waiting on OAuth app credentials from ops
created: "2026-09-03"
updated: "2026-09-03"
---

# Add Google OAuth provider

## Context

Support “Sign in with Google” using the standard authorization-code flow.

## Acceptance

- [ ] Configure client id/secret via env
- [ ] Link or create local user on first login
- [ ] Cover happy path in an integration test
