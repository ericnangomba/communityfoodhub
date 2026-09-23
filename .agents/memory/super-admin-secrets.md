---
name: Secret-backed admin provisioning
description: Environment-specific behavior for provisioning the configured Super Admin account.
---

The API workflow must be restarted after the Super Admin secrets are added or corrected; startup reconciliation then creates or updates the database account.

**Why:** Replit secret changes are available to the next workflow process, not reliably to an already-running API process.

**How to apply:** Use the secure secrets flow for `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`, never source or display the values, then restart the API before testing sign-in.