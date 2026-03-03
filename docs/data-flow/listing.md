# Listing Creation Data Flow

This document describes the listing creation workflow, data flows, and processes in AgriBid.

## Listing Lifecycle

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Listing Lifecycle                                │
│                                                                             │
│  ┌─────────┐      ┌────────────┐      ┌────────────┐      ┌───────────┐     │
│  │ Draft  │───┐──▶│  Pending   │──┬──▶│   Active   │──┬──▶│  Sold/    │     │
│  │        │─┐ │   │  Review    │  │   │            │  │   │  Unsold   │     │
│  └─────────┘ │ │   └────────────┘  │   └────────────┘  │   └─────┬─────┘     │
│       │      │ │         │         │          │        │         │           │
│       ▼      ▼ ▼         ▼         ▼          ▼        ▼         ▼           │
│   Edit/Save Deleted Approve/Reject Rejected Live Bidding      Archive        │
│                                    │                             ▲           │
│                                    └─────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Listing Wizard Flow

### Multi-Step Form Process

```text
User Clicks "Create Listing"
           │
           ▼
    Step 1: General Info
    ┌────────────────────────┐
    │ • Title               │
    │ • Make (dropdown)     │
    │ • Model (dropdown)    │
    │ • Year                │
    │ • Category            │
    └────────────────────────┘
           │
           ▼
    Step 2: Technical Specs
    ┌────────────────────────┐
    │ • Operating Hours     │
    │ • Location            │
    │ • Condition Checklist │
    │ • Description         │
    └────────────────────────┘
           │
           ▼
    Step 3: Media Gallery
    ┌────────────────────────┐
    │ • Front (required)    │
    │ • Engine (optional)   │
    │ • Cabin (optional)    │
    │ • Rear (optional)     │
    │ • Additional (up to 10)│
    └────────────────────────┘
           │
           ▼
    Step 4: Review & Submit
    ┌────────────────────────┐
    │ • Starting Price      │
    │ • Reserve Price       │
    │ • Minimum Increment   │
    │ • Duration            │
    │ • Review All Details  │
    └────────────────────────┘
           │
           ▼
    Submit → Pending Review
```

---

## Step-by-Step Flow

### Step 1: General Information

**Fields:**
- Title: Auction title
- Make: Equipment manufacturer (from `equipmentMetadata`)
- Model: Equipment model (filtered by make)
- Year: Manufacturing year (dropdown)
- Category: Equipment category

**Data Validation:**
- All fields required
- Make/Model from predefined list
- Year within reasonable range (1950-current+1)

**Actions:**
- Auto-save draft on navigation
- Load model options based on make selection

---

### Step 2: Technical Specifications

**Fields:**
- Operating Hours: Number (0-99999)
- Location: String (city/region)
- Condition Checklist:
  - Engine: boolean
  - Hydraulics: boolean
  - Tires: boolean
  - Service History: boolean
  - Notes: optional text
- Description: optional text area

**Actions:**
- Location autocomplete (future enhancement)
- Condition checklist saves as object

---

### Step 3: Media Gallery

**Image Requirements:**
**Image Requirements:**

| Slot | Required | Description |
|------|----------|-------------|
| Front | Yes | Primary equipment photo |
| Engine | No | Engine compartment |
| Cabin | No | Operator cab interior |
| Rear | No | Rear view |
| Additional | No | Up to 10 extra photos |

**Upload Process:**
```text
User Selects Image File
           │
           ▼
    Client-Side Validation
    (type: jpg/png/webp)
    (size: < 10MB)
           │
           ▼
    Request Upload URL
    (ctx.storage.generateUploadUrl())
           │
           ▼
    HTTP POST to URL
    (Allocates Storage ID)
           │
           ▼
    Receive Storage ID
           │
           ▼
    Display Preview
           │
           ▼
    Save to Form State
```

**Image Storage Flow:**
```typescript
// In MediaGalleryStep component
const handleImageUpload = async (file: File) => {
  // Validate file
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    throw new Error('Invalid file type');
  }
  
  // Get upload URL from server action
  const uploadUrl = await generateUploadUrl();
  
  // Upload directly to Convex storage
  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: file,
    headers: { 'Content-Type': file.type }
  });
  
  const { storageId } = await response.json();
  return storageId;
};

// Server action for getting upload URL
export const generateUploadUrl = action({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  }
});
```

---

### Step 4: Review & Submit

**Pricing Fields:**
- Starting Price: Minimum bid starting amount
- Reserve Price: Minimum acceptable price (hidden from bidders)
- Minimum Increment: Minimum bid increase
- Duration: Days (1, 3, 5, 7, 10, 14, 21, 30)

**Validation:**
- Starting price > 0
- Reserve price >= starting price
- Minimum increment > 0
- Duration in allowed values

**Final Review:**
- Display all entered information
- Edit buttons to return to previous steps
- Submit button to create listing

---

## Submit Process

### Create Listing Mutation

```typescript
// app/convex/auctions/mutations.ts

export const createAuction = mutation({
  args: {
    title: v.string(),
    make: v.string(),
    model: v.string(),
    year: v.number(),
    operatingHours: v.number(),
    location: v.string(),
    startingPrice: v.number(),
    reservePrice: v.number(),
    minIncrement: v.number(),
    durationDays: v.number(),
    images: v.object({
      front: v.optional(v.string()),
      engine: v.optional(v.string()),
      cabin: v.optional(v.string()),
      rear: v.optional(v.string()),
      additional: v.optional(v.array(v.string()))
    }),
    description: v.optional(v.string()),
    conditionChecklist: v.optional(v.object({
      engine: v.boolean(),
      hydraulics: v.boolean(),
      tires: v.boolean(),
      serviceHistory: v.boolean(),
      notes: v.optional(v.string())
    }))
  },
  handler: async (ctx, args) => {
    // Require authenticated user
    const { profile, userId } = await requireProfile(ctx);
    
    // Validate role allows listing
    if (profile.role !== 'seller' && profile.role !== 'buyer') {
      throw new Error('Not authorized to create listings');
    }
    
    // Calculate times
    const now = Date.now();
    const startTime = now;
    const endTime = now + (args.durationDays * 24 * 60 * 60 * 1000);
    
    // Create auction
    const auctionId = await ctx.db.insert('auctions', {
      ...args,
      sellerId: userId,
      currentPrice: args.startingPrice,
      startTime,
      endTime,
      status: 'pending_review', // Default to pending review
      isExtended: false
    });
    
    // Update global counters
    await updateCounter(ctx, "auctions", "total", 1);
    await updateCounter(ctx, "auctions", "pending", 1);
    
    return auctionId;
  }
});
```

---

## Admin Review Flow

### Listing Approval Process

```text
Listing Submitted (Pending Review)
           │
           ▼
    Admin Views Listing
    (Admin Moderation Page)
           │
           ▼
    ┌────────────────────────┐
    │ Admin Decision:        │
    │ • Approve              │
    │ • Reject               │
    │ • Request Changes      │
    └────────────────────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
  Approve     Reject
     │           │
     ▼           ▼
┌─────────────────┐  ┌─────────────────────┐
│ Status: Active │  │ Status: Rejected    │
│ Set endTime    │  │ Store rejection     │
│ Notify seller  │  │ reason              │
└─────────────────┘  │ Notify seller       │
                     └─────────────────────┘
```

### Approval Mutation

```typescript
// app/convex/admin/index.ts

export const approveAuction = mutation({
  args: {
    auctionId: v.id("auctions")
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    
    const auction = await ctx.db.get(args.auctionId);
    if (!auction) throw new Error("Auction not found");
    
    // Calculate active period
    const now = Date.now();
    const durationDays = auction.durationDays || 7;
    const endTime = now + (durationDays * 24 * 60 * 60 * 1000);
    
    // Update status
    await ctx.db.patch(args.auctionId, {
      status: "active",
      startTime: now,
      endTime
    });
    
    // Log action
    await ctx.db.insert("auditLogs", {
      adminId: admin.userId,
      action: "approve_auction",
      targetId: args.auctionId,
      targetType: "auction",
      timestamp: now
    });
    
    // Notify seller
    await ctx.db.insert("notifications", {
      recipientId: auction.sellerId,
      type: "success",
      title: "Listing Approved",
      message: "Your listing is now live!",
      isRead: false,
      createdAt: now
    });
  }
});
```

---

## Listing State Transitions

| From State | To State | Trigger |
|-------------|-----------|---------|
| Draft | Pending Review | User submits listing |
| Draft | Deleted | User deletes draft |
| Pending Review | Active | Admin approves |
| Pending Review | Rejected | Admin rejects |
| Active | Sold | Auction ends, reserve met |
| Active | Unsold | Auction ends, no bids/reserve not met |
| Active | Rejected | Admin rejects active listing |
| Sold | Archive | System archives after 30 days |
| Unsold | Archive | System archives after 30 days |
| Rejected | Archive | User/Admin archives rejected listing |

---

## Editing Listings

### Draft Editing

- Users can edit draft listings freely
- All form fields editable
- Re-saves as draft

### Active Listing Restrictions

- Cannot edit core details (price, duration)
- Can add additional images
- Can update description
- Can cancel (ends auction)

### Cancellation Flow

```text
Seller Requests Cancellation
           │
           ▼
    Check for Bids
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
  Has Bids    No Bids
     │           │
     ▼           ▼
┌──────────────────┐  ┌─────────────────┐
│ Cannot Cancel   │  │ Status: unsold  │
│ Notify Seller   │  │ Refund if paid │ (future)
└──────────────────┘  └─────────────────┘
```

---

## Image Management

### Storage IDs

Images stored in Convex File Storage:
```typescript
// Image object structure
{
  front: "storageId" | undefined,
  engine: "storageId" | undefined,
  cabin: "storageId" | undefined,
  rear: "storageId" | undefined,
  additional: ["storageId1", "storageId2", ...] | undefined
}
```

### Image Retrieval

```typescript
// Getting image URL from storage ID
const imageUrl = await ctx.storage.getUrl(storageId);
```

### Image Deletion

When listing is deleted or images replaced:
```typescript
// Delete old images from storage
await ctx.storage.delete(oldStorageId);
```

---

*Last Updated: 2026-03-02*
