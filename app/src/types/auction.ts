import type { Doc, Id } from "../../convex/_generated/dataModel";

/**
 * Auction document with optional denormalized category name for display.
 */
export type AuctionWithCategory = Doc<"auctions"> & {
  categoryName?: string;
};

/**
 * Represents the images associated with an auction.
 */
export interface AuctionImages {
  /** Front view image storage ID or URL */
  front?: string;
  /** Engine bay image storage ID or URL */
  engine?: string;
  /** Cabin/instrument cluster image storage ID or URL */
  cabin?: string;
  /** Rear/hitch image storage ID or URL */
  rear?: string;
  /** Additional photos array */
  additional?: string[];
}

/**
 * Represents a simplified auction summary for grid displays.
 */
export interface AuctionSummary {
  _id: Id<"auctions">;
  _creationTime: number;
  title: string;
  make: string;
  model: string;
  year: number;
  currentPrice: number;
  minIncrement: number;
  endTime?: number;
  status: string;
  images: AuctionImages | string[];
  location: string;
  operatingHours: number;
  sellerId: string;
  winnerId?: string;
  bidCount: number;
}
