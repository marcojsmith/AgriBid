import type { LucideIcon } from "lucide-react";

export type ReportReason =
  | "fake_account"
  | "fraudulent_listings"
  | "abusive_behaviour"
  | "identity_misrepresentation"
  | "other";

export type ActivityType =
  | "account_created"
  | "verification_requested"
  | "verification_approved"
  | "verification_rejected"
  | "role_changed"
  | "listing_created"
  | "listing_sold"
  | "bid_placed"
  | "bid_won";

export interface ActivityMeta {
  icon: LucideIcon;
  bgClass: string;
  iconColor: string;
  title: string;
}

export interface TrustItem {
  id: string;
  icon: LucideIcon;
  label: string;
  value: string;
  verified: boolean;
}

export interface VerificationStatus {
  emailVerified?: boolean;
  phoneVerified?: boolean;
  bankingVerified?: boolean;
  taxNumberVerified?: boolean;
}

export interface SellerRating {
  avgRating?: number;
  reviewCount: number;
}
