# 0006 - AES-256-GCM PII encryption

Date: undated | Status: Accepted

## Context

KYC collects `firstName`, `lastName`, `phoneNumber`, `kycEmail`, and `idNumber`, which must not be stored in plaintext.

## Decision

Encrypt these fields with AES-256-GCM via the Web Crypto API (helpers in `admin_utils.ts`; key in `PII_ENCRYPTION_KEY`, exactly 32 bytes). Production throws if the key is missing or invalid. Decryption happens only in role-restricted, audited admin mutations (e.g. `getProfileForKYC`). All admin mutations are recorded in `auditLogs` via `logAudit`.

## Consequences

- Auth-tag validation gives integrity checking on decrypt.
- Legacy plaintext values are tolerated during the transition period.
- Losing or rotating the key makes existing ciphertext unreadable.
