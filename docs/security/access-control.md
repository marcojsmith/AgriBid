# Security: Access Control

This document describes role-based access control (RBAC), permissions, and authorization in AgriBid.

## Role-Based Access Control (RBAC)

### User Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| `buyer` | Standard user who can bid | View auctions, place bids, create watchlist, and create own listings |
| `seller` | User with advanced equipment inventory | All buyer permissions plus seller-specific tools like viewing all active auctions and managing large inventories |
| `admin` | Platform administrator | Full system access |

---

## Role Hierarchy

```text
          ┌─────────────┐
          │    Admin    │
          │  (Full)     │
          └──────┬──────┘
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
┌───────────┐       ┌───────────┐
│  Seller  │       │   Buyer   │
│(Extended)│       │  (Basic)  │
└───────────┘       └───────────┘
```

> **Note:** Seller inherits all Buyer permissions. Admins have full system access and bypass role restrictions.

---

## Permission Matrix

### Auction Permissions

| Action | Guest | Buyer | Seller | Admin |
|--------|-------|-------|--------|-------|
| View active auctions | Yes | Yes | Yes | Yes |
| View auction details | Yes | Yes | Yes | Yes |
| Search auctions | Yes | Yes | Yes | Yes |
| Place bid | No | Yes | Yes | Yes |
| Create auction | No | Yes | Yes | Yes |
| Edit own auction (draft) | No | Yes | Yes | Yes |
| Cancel own auction | No | Yes | Yes | Yes |
| View all auctions | No | No | Yes | Yes |
| Moderation actions | No | No | No | Yes |

### Profile Permissions

| Action | Self | Other User | Admin |
|--------|------|------------|-------|
| View own profile | Yes | No | Yes |
| Edit own profile | Yes | No | Yes |
| View other profile | No | No* | Yes |
| Change own role | No | No | Yes |

*Except public fields (company name, bio)

### Bid Permissions

| Action | Self | Other | Admin |
|--------|------|-------|-------|
| View own bids | Yes | No | Yes |
| Place bid | Yes | No | Yes |
| Cancel bid | No | No | Yes* |

*Only in cases of fraud/dispute

### Admin Permissions

| Action | Non-Admin | Admin |
|--------|-----------|-------|
| Access admin dashboard | No | Yes |
| View all users | No | Yes |
| Approve/reject listings | No | Yes |
| Manage KYC | No | Yes |
| View audit logs | No | Yes |
| Manage support tickets | No | Yes |
| Create announcements | No | Yes |
| Modify user roles | No | Yes |

---

## Implementation

### Authorization Utilities

Located in `app/convex/lib/auth.ts`. Choose the utility that matches your required access level:

**1. Optional Authentication (Guests allowed)**
```typescript
// returns user object or null
const authUser = await getAuthUser(ctx);
```

**2. Mandatory Authentication (Guests blocked)**
```typescript
// returns user object or throws "Not authenticated"
const user = await requireAuth(ctx);
```

**3. Role & Verification Checks**
```typescript
// Throws if not admin
const admin = await requireAdmin(ctx);

// Throws if not KYC verified
const verified = await requireVerified(ctx);

// Returns { profile, userId } or throws
const { profile, userId } = await requireProfile(ctx);
```

### Usage in Mutations

```typescript
// Example: Place bid mutation
export const placeBid = mutation({
  args: { auctionId: v.id("auctions"), amount: v.number() },
  handler: async (ctx, args) => {
    // 1. Require authentication
    const { profile, userId } = await requireProfile(ctx);
    
    // 2. Get auction
    const auction = await ctx.db.get(args.auctionId);
    if (!auction) {
      throw new Error("Auction not found");
    }
    
    // 3. Prevent self-bidding
    if (auction.sellerId === userId) {
      throw new Error("Cannot bid on your own auction");
    }
    
    // 4. Validate bid amount
    // ... rest of logic
  }
});
```

### Usage in Queries

```typescript
// Example: Get user profile
export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await getAuthUser(ctx);
    if (!authUser) return null;
    
    const userId = resolveUserId(authUser);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", q => q.eq("userId", userId))
      .unique();
    
    return profile;
  }
});
```

---

## Frontend Route Protection

### RoleProtectedRoute Component

```typescript
// app/src/components/RoleProtectedRoute.tsx

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<"buyer" | "seller" | "admin">;
}

export function RoleProtectedRoute({ 
  children, 
  allowedRoles 
}: RoleProtectedRouteProps) {
  const { profile, isLoading } = useUserProfile();
  
  if (isLoading) {
    return <LoadingIndicator />;
  }
  
  if (!profile) {
    return <Navigate to="/login" replace />;
  }
  
  // Admins bypass role restrictions
  if (profile.role !== 'admin' && allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}
```

### Usage Examples

```typescript
// Protect routes
<Route path="/sell" element={
  <RoleProtectedRoute allowedRoles={["buyer", "seller", "admin"]}>
    <SellPage />
  </RoleProtectedRoute>
} />

<Route path="/admin" element={
  <RoleProtectedRoute allowedRoles={["admin"]}>
    <AdminDashboard />
  </RoleProtectedRoute>
} />
```

---

## Admin Operations

### Audit Logging

All admin actions are logged:

```typescript
// Example: Log admin action
await ctx.db.insert("auditLogs", {
  adminId: adminUserId,
  action: "approve_kyc",
  targetId: profileId,
  targetType: "profile",
  details: "KYC documents verified",
  timestamp: Date.now()
});
```

### Admin Actions List

| Action | Description |
|--------|-------------|
| `create_auction` | Create auction on behalf |
| `approve_auction` | Approve pending listing |
| `reject_auction` | Reject listing |
| `approve_kyc` | Approve KYC submission |
| `reject_kyc` | Reject KYC submission |
| `promote_admin` | Grant admin role |
| `resolve_ticket` | Resolve support ticket |
| `bulk_action` | Bulk status update |

---

## KYC Access Control

### KYC Data Access

| Actor | Access Level |
|-------|--------------|
| Subject user | View own KYC status |
| Admin | View all KYC data, documents |
| Other users | No access |

### Verification Flow

```typescript
// Admin reviews KYC
export const reviewKYC = mutation({
  args: {
    profileId: v.id("profiles"),
    action: v.union(v.literal("approve"), v.literal("reject")),
    reason: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    // Require admin
    await requireAdmin(ctx);
    
    // Update profile
    await ctx.db.patch(args.profileId, {
      kycStatus: args.action === "approve" ? "verified" : "rejected",
      kycRejectionReason: args.reason,
      isVerified: args.action === "approve"
    });
    
    // Log action
    // Create notification
  }
});
```

---

## Permission Check Examples

### Roles Allowed to Create Listings

```typescript
// Can user create listing?
const canCreate = profile.role === "seller" || 
                  profile.role === "buyer" || 
                  profile.role === "admin";
```

### Bidding on Auction

```typescript
// Can user bid?
const canBid = authUser !== null && 
               auction.status === "active" &&
               auction.sellerId !== userId;
```

### Viewing Admin Dashboard

```typescript
// Is user admin?
const isAdmin = profile?.role === "admin";
```

---

## Security Considerations

### Privilege Escalation Prevention

1. Role changes require admin privileges
2. Self-promotion is prevented
3. All role changes are audited

### Horizontal Privilege Escalation

Users can only access their own data:
- Profiles filtered by userId
- Bids filtered by bidderId
- Watchlist filtered by userId

### Vertical Privilege Escalation

- Admin checks enforced server-side
- Frontend routes not sufficient
- Multiple validation layers

---

## Testing Access Control

### Test Cases

| Scenario | Expected Result |
|----------|-----------------|
| Guest attempts to access /sell | Redirect to login |
| Buyer attempts to access /admin | Redirect to home |
| Seller attempts to bid on their own auction | Error message |
| Admin accesses all pages | Allowed |

---

## Best Practices

### For Developers

1. Always validate permissions server-side
2. Never trust client-side role checks
3. Log sensitive actions
4. Use require functions for critical operations
5. Follow principle of least privilege

### For Administrators

1. Use admin account only for admin tasks
2. Review audit logs regularly
3. Document admin actions
4. Limit admin users to necessary count

---

*Last Updated: 2026-03-02*
