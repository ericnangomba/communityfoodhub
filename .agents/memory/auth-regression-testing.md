---
name: Auth regression runner
description: How critical role-gated browser checks are kept runnable in this workspace
---

Use the checked-in Chromium-based auth/RBAC regression runner for critical sign-in and role-navigation verification. Interactive browser testing may be unavailable in the workspace's current model tier, so the regression must remain runnable from the scripts workspace without depending on an external test agent or hard-coded credentials.

**Why:** Super Admin sign-in and role redirects are security-sensitive and require real browser session behavior, while this workspace may not provide the interactive testing subagent.

**How to apply:** Keep credentials runtime-only through the existing environment secrets, provision temporary role accounts through the real API, assert final browser paths and `/api/auth/me`, and always remove generated records in teardown.