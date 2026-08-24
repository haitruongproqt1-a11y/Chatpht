# Public Export Sanitization

This repository export is based on ChatPHT checkpoint `0c08692d`.

The literal value previously asserted by `tests/admin-seed-secret.test.ts` was removed before publication because it is a credential. Deployments that intentionally seed an administrator must configure `ADMIN_SEED_PASSWORD` through their secret manager or host environment; never commit its value.

No `.env` files or private keys are included in this public export.
