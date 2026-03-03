# Security: Data Protection

This document describes data protection policies, PII handling, encryption, and compliance measures in AgriBid.

## Data Classification

### Data Categories

| Category | Examples | Protection Level |
|----------|----------|------------------|
| Public | Auction listings, images, descriptions | None required |
| Private | User profile data, bid history | Authentication required |
| Sensitive (PII) | ID numbers, phone numbers, addresses | Encryption required |
| Confidential | Admin actions, audit logs | Access control |

---

## Personally Identifiable Information (PII)

### PII Fields

The following fields in the `profiles` table are encrypted:

| Field | Description | Encryption |
|-------|-------------|------------|
| `firstName` | User's first name | AES-256-GCM |
| `lastName` | User's last name | AES-256-GCM |
| `idNumber` | Government ID number | AES-256-GCM |
| `phoneNumber` | Contact phone number | AES-256-GCM |
| `kycEmail` | KYC submission email | AES-256-GCM |

### Non-PII Fields (Stored Plaintext)

| Field | Description |
|-------|-------------|
| `userId` | Auth user reference |
| `role` | User role (buyer/seller/admin) |
| `isVerified` | Verification status |
| `kycStatus` | KYC status |
| `bio` | User bio (user-provided) |
| `companyName` | Business name |
| `createdAt` | Creation timestamp |
| `updatedAt` | Last update timestamp |

---

## Encryption Implementation

### Algorithm

- **Method**: AES-256-GCM (Galois/Counter Mode)
- **Key Derivation**: Web Crypto API
- **IV**: 12 bytes, randomly generated per encryption

### Key Management

```typescript
// app/convex/lib/encryption.ts

const ENCRYPTION_KEY_STR = process.env.PII_ENCRYPTION_KEY;

// Validation: Key must be exactly 32 bytes
if (IS_PRODUCTION && !ENCRYPTION_KEY_STR) {
  throw new Error("PII_ENCRYPTION_KEY is required in production");
}
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PII_ENCRYPTION_KEY` | Production: Yes | 32-byte encryption key |
| `APP_ENV` | Production: Yes | Set to "production" |
| `ALLOW_PII_DEV_FALLBACK` | Development only | Enable dev encryption |

### Encryption Flow

```text
Plaintext PII
      │
      ▼
Generate Random IV (12 bytes)
      │
      ▼
Import AES-256 Key
      │
      ▼
Encrypt with AES-GCM
(plaintext + key + IV)
      │
      ▼
Combine: IV + Ciphertext
      │
      ▼
Base64 Encode
      │
      ▼
Store in Database
```

### Decryption Flow

```text
Encrypted String
(IV + Ciphertext, Base64)
      │
      ▼
Base64 Decode
      │
      ▼
Split: IV + Ciphertext
      │
      ▼
Import AES-256 Key
      │
      ▼
Decrypt with AES-GCM
(ciphertext + key + IV)
      │
      ▼
Return Plaintext
```

---

## Data Access Control

### Access Patterns

| Data Type | Who Can Access | Method |
|-----------|----------------|--------|
| Own Profile | Self | Authenticated query |
| Other Profiles | Admins only | Admin queries |
| Own Bids | Self | Authenticated query |
| All Bids (auction) | Authenticated users | Public query |
| PII Fields | Admin/Self | Accessed server-side only |

### Server-Side Processing

All PII encryption/decryption happens server-side:

```typescript
// Example: Getting user profile with decrypted PII
export const getUserProfile = query({
  args: { userId: v.id("profiles") },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.userId);
    
    // Decrypt PII server-side only
    const decryptedProfile = {
      ...profile,
      firstName: await decryptPII(profile.firstName),
      lastName: await decryptPII(profile.lastName),
      idNumber: await decryptPII(profile.idNumber),
      phoneNumber: await decryptPII(profile.phoneNumber)
    };
    
    return decryptedProfile;
  }
});
```

---

## Data Retention

### Retention Periods

| Data Type | Retention | Reason |
|-----------|-----------|--------|
| Active auctions | Until sold + 30 days | Transaction records |
| Closed auctions | Indefinite | Historical reference |
| Bids | Indefinite | Audit trail |
| Profiles | While active | Service provision |
| Deleted profiles | 90 days | Grace period for recovery |
| Audit logs | 2 years | Compliance requirement |
| Support tickets | Resolution + 1 year | Dispute resolution |

### Deletion Process

```text
User Requests Deletion
          │
          ▼
Soft Delete (mark as deleted)
          │
          ▼
Notify user of deletion
          │
          ▼
After 90 days:
Permanent deletion
(anonymize or remove)
```

---

## Secure Data Transmission

### HTTPS

- All production traffic over HTTPS
- TLS 1.3 preferred
- Certificate managed by Vercel

### API Security

- All Convex functions over HTTPS
- No sensitive data in URLs
- No sensitive data in logs

---

## Privacy Compliance

### User Consent

1. **Registration**: Privacy policy acceptance required
2. **KYC**: Explicit consent for document handling
3. **Marketing**: Opt-in only (future feature)

### Data Subject Rights

| Right | Implementation |
|-------|----------------|
| Access | Profile viewing in app |
| Correction | Edit profile functionality |
| Deletion | Account deletion request |
| Portability | Data export (future) |

---

## Security Logging

### Events Logged

- Authentication attempts (success/failure)
- Profile modifications
- Admin actions
- Data access to PII
- Failed decryption attempts

### Log Format

```typescript
{
  timestamp: number,
  adminId: string,
  action: string,
  targetId?: string,
  targetType?: string,
  details?: string
}
```

---

## Environment-Specific Security

### Development

- Encryption key optional (with warning)
- Fallback key for testing
- Verbose logging allowed

### Production

- Encryption key required
- Strict validation
- Minimal logging
- Alerts on errors

---

## Vulnerability Protection

### Input Validation

- All user inputs validated server-side
- Type checking via Convex schema
- SQL injection prevention (handled by Convex)

### XSS Prevention

- React handles auto-escaping
- No dangerouslySetInnerHTML usage
- Content Security Policy (via Vercel)

### CSRF Protection

- Convex handles CSRF automatically
- Same-site cookies

---

## Incident Response

### Data Breach Response

1. **Detection**: Automated alerts on anomalies
2. **Containment**: Isolate affected systems
3. **Assessment**: Determine scope of breach
4. **Notification**: Notify affected users (GDPR requirement)
5. **Remediation**: Fix vulnerability
6. **Review**: Update security measures

### Encryption Key Compromise

If encryption key is compromised:
1. Rotate key immediately
2. Re-encrypt all PII with new key
3. Audit access logs
4. Notify affected users

---

## Best Practices

### For Developers

1. Never log PII
2. Never include PII in URLs
3. Use server-side decryption only
4. Validate environment variables
5. Follow principle of least privilege

### For Users

1. Use strong, unique passwords
2. Enable two-factor authentication (future)
3. Review profile data regularly
4. Report suspicious activity

---

*Last Updated: 2026-03-02*
