import type { Doc, Id } from "../../convex/_generated/dataModel";

const now = Date.now();

/**
 * Creates a mock profile document for testing.
 * @param userId - The user ID
 * @param role - The user role (buyer, seller, admin)
 * @param overrides - Optional field overrides
 * @returns Mock profile document
 */
export const createMockProfile = (
  userId: string = "user123",
  role: "buyer" | "seller" | "admin" = "buyer",
  overrides: Partial<Doc<"profiles">> = {}
): Doc<"profiles"> => {
  const base: Doc<"profiles"> = {
    _id: `profile_${userId}` as Id<"profiles">,
    _creationTime: now,
    userId,
    role,
    isVerified: true,
    kycStatus: "verified",
    firstName: "Test",
    lastName: "User",
    bio: "Test bio",
    companyName: undefined,
    phoneNumber: undefined,
    createdAt: now,
    updatedAt: now,
  };
  return { ...base, ...overrides };
};

/**
 * Creates a mock auction document for testing.
 * @param overrides - Optional field overrides
 * @returns Mock auction document
 */
export const createMockAuction = (
  overrides: Partial<Doc<"auctions">> = {}
): Doc<"auctions"> => {
  const base: Doc<"auctions"> = {
    _id: "auction123" as Id<"auctions">,
    _creationTime: now,
    title: "Test Auction",
    make: "John Deere",
    model: "5075E",
    year: 2020,
    operatingHours: 1500,
    location: "Iowa, USA",
    categoryId: undefined,
    reservePrice: 50000,
    startingPrice: 45000,
    currentPrice: 47500,
    minIncrement: 100,
    startTime: now - 86400000,
    endTime: now + 86400000,
    durationDays: 7,
    sellerId: "seller123",
    status: "active",
    winnerId: undefined,
    images: {
      front: "storage123",
      engine: undefined,
      cabin: undefined,
      rear: undefined,
      additional: undefined,
    },
    description: "Test auction description",
    conditionReportUrl: undefined,
    isExtended: false,
    hiddenByFlags: false,
    seedId: undefined,
    conditionChecklist: undefined,
  };
  return { ...base, ...overrides };
};

/**
 * Creates a mock bid document for testing.
 * @param auctionId - The auction ID
 * @param bidderId - The bidder ID
 * @param amount - The bid amount
 * @param overrides - Optional field overrides
 * @returns Mock bid document
 */
export const createMockBid = (
  auctionId: string = "auction123",
  bidderId: string = "bidder123",
  amount: number = 50000,
  overrides: Partial<Doc<"bids">> = {}
): Doc<"bids"> => {
  const base: Doc<"bids"> = {
    _id: `bid_${now}` as Id<"bids">,
    _creationTime: now,
    auctionId: auctionId as Id<"auctions">,
    bidderId,
    amount,
    timestamp: now,
    status: "valid",
  };
  return { ...base, ...overrides };
};

/**
 * Creates a mock proxy bid document for testing.
 * @param auctionId - The auction ID
 * @param bidderId - The bidder ID
 * @param maxBid - The maximum bid amount
 * @param overrides - Optional field overrides
 * @returns Mock proxy bid document
 */
export const createMockProxyBid = (
  auctionId: string = "auction123",
  bidderId: string = "bidder123",
  maxBid: number = 55000,
  overrides: Partial<Doc<"proxy_bids">> = {}
): Doc<"proxy_bids"> => {
  const base: Doc<"proxy_bids"> = {
    _id: `proxy_${now}` as Id<"proxy_bids">,
    _creationTime: now,
    auctionId: auctionId as Id<"auctions">,
    bidderId,
    maxBid,
    updatedAt: now,
  };
  return { ...base, ...overrides };
};

/**
 * Creates a mock notification document for testing.
 * @param recipientId - The recipient user ID
 * @param overrides - Optional field overrides
 * @returns Mock notification document
 */
export const createMockNotification = (
  recipientId: string = "user123",
  overrides: Partial<Doc<"notifications">> = {}
): Doc<"notifications"> => {
  const base: Doc<"notifications"> = {
    _id: `notif_${now}` as Id<"notifications">,
    _creationTime: now,
    recipientId,
    type: "info",
    title: "Test Notification",
    message: "This is a test notification",
    link: undefined,
    isRead: false,
    createdAt: now,
  };
  return { ...base, ...overrides };
};

/**
 * Creates a mock support ticket document for testing.
 * @param userId - The user ID who created the ticket
 * @param overrides - Optional field overrides
 * @returns Mock support ticket document
 */
export const createMockSupportTicket = (
  userId: string = "user123",
  overrides: Partial<Doc<"supportTickets">> = {}
): Doc<"supportTickets"> => {
  const base: Doc<"supportTickets"> = {
    _id: `ticket_${now}` as Id<"supportTickets">,
    _creationTime: now,
    userId,
    auctionId: undefined,
    subject: "Test Ticket",
    message: "This is a test support ticket",
    status: "open",
    priority: "medium",
    createdAt: now,
    updatedAt: now,
    resolvedBy: undefined,
  };
  return { ...base, ...overrides };
};

/**
 * Creates a mock audit log document for testing.
 * @param adminId - The admin ID who performed the action
 * @param overrides - Optional field overrides
 * @returns Mock audit log document
 */
export const createMockAuditLog = (
  adminId: string = "admin123",
  overrides: Partial<Doc<"auditLogs">> = {}
): Doc<"auditLogs"> => {
  const base: Doc<"auditLogs"> = {
    _id: `log_${now}` as Id<"auditLogs">,
    _creationTime: now,
    adminId,
    action: "test_action",
    targetId: "target123",
    targetType: "auction",
    details: "Test audit log entry",
    targetCount: undefined,
    timestamp: now,
  };
  return { ...base, ...overrides };
};

/**
 * Creates a mock watchlist item document for testing.
 * @param userId - The user ID
 * @param auctionId - The auction ID
 * @param overrides - Optional field overrides
 * @returns Mock watchlist item document
 */
export const createMockWatchlistItem = (
  userId: string = "user123",
  auctionId: string = "auction123",
  overrides: Partial<Doc<"watchlist">> = {}
): Doc<"watchlist"> => {
  const base: Doc<"watchlist"> = {
    _id: `watch_${now}` as Id<"watchlist">,
    _creationTime: now,
    userId,
    auctionId: auctionId as Id<"auctions">,
  };
  return { ...base, ...overrides };
};

/**
 * Creates a mock equipment category document for testing.
 * @param name - The category name
 * @param overrides - Optional field overrides
 * @returns Mock category document
 */
export const createMockCategory = (
  name: string = "Tractors",
  overrides: Partial<Doc<"equipmentCategories">> = {}
): Doc<"equipmentCategories"> => {
  const base: Doc<"equipmentCategories"> = {
    _id: `cat_${name.toLowerCase()}` as Id<"equipmentCategories">,
    _creationTime: now,
    name,
    isActive: true,
  };
  return { ...base, ...overrides };
};

/**
 * Creates a mock equipment metadata document for testing.
 * @param make - The equipment make
 * @param models - Array of model names
 * @param overrides - Optional field overrides
 * @returns Mock equipment metadata document
 */
export const createMockEquipmentMetadata = (
  make: string = "John Deere",
  models: string[] = ["5075E", "5085E"],
  overrides: Partial<Doc<"equipmentMetadata">> = {}
): Doc<"equipmentMetadata"> => {
  const base: Doc<"equipmentMetadata"> = {
    _id: `meta_${make.toLowerCase()}` as Id<"equipmentMetadata">,
    _creationTime: now,
    make,
    models,
    categoryId: undefined,
    category: "Tractors",
    isActive: true,
    updatedAt: now,
  };
  return { ...base, ...overrides };
};

/**
 * Creates a mock settings document for testing.
 * @param key - The settings key
 * @param value - The settings value
 * @param overrides - Optional field overrides
 * @returns Mock settings document
 */
export const createMockSettings = (
  key: string = "pagination_limit",
  value: string | number | boolean = 20,
  overrides: Partial<Doc<"settings">> = {}
): Doc<"settings"> => {
  const base: Doc<"settings"> = {
    _id: `setting_${key}` as Id<"settings">,
    _creationTime: now,
    key,
    value,
    description: `Setting for ${key}`,
    updatedAt: now,
  };
  return { ...base, ...overrides };
};

/**
 * Creates a mock counter document for testing.
 * @param name - The counter name
 * @param overrides - Optional field overrides
 * @returns Mock counter document
 */
export const createMockCounter = (
  name: string = "auctions",
  overrides: Partial<Doc<"counters">> = {}
): Doc<"counters"> => {
  const base: Doc<"counters"> = {
    _id: `counter_${name}` as Id<"counters">,
    _creationTime: now,
    name,
    total: 100,
    active: 50,
    pending: 10,
    verified: 40,
    open: 5,
    resolved: 95,
    draft: 0,
    soldCount: 30,
    salesVolume: 1500000,
    updatedAt: now,
  };
  return { ...base, ...overrides };
};

/**
 * Creates a mock auction flag document for testing.
 * @param auctionId - The auction ID being flagged
 * @param reporterId - The user ID who reported
 * @param overrides - Optional field overrides
 * @returns Mock auction flag document
 */
export const createMockAuctionFlag = (
  auctionId: string = "auction123",
  reporterId: string = "reporter123",
  overrides: Partial<Doc<"auctionFlags">> = {}
): Doc<"auctionFlags"> => {
  const base: Doc<"auctionFlags"> = {
    _id: `flag_${now}` as Id<"auctionFlags">,
    _creationTime: now,
    auctionId: auctionId as Id<"auctions">,
    reporterId,
    reason: "misleading",
    details: "Test flag reason",
    status: "pending",
    createdAt: now,
  };
  return { ...base, ...overrides };
};

/**
 * Creates a mock presence document for testing.
 * @param userId - The user ID
 * @param overrides - Optional field overrides
 *
 * @returns Mock document
 */
export const createMockPresence = (
  userId: string = "user123",
  overrides: Partial<Doc<"presence">> = {}
): Doc<"presence"> => {
  const base: Doc<"presence"> = {
    _id: `presence_${userId}` as Id<"presence">,
    _creationTime: now,
    userId,
    updatedAt: now,
  };
  return { ...base, ...overrides };
};
