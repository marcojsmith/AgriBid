import {
  UserCheck,
  ShieldCheck,
  ShieldAlert,
  Tag,
  Award,
  Gavel,
  Trophy,
  Phone,
  Mail,
  CreditCard,
  FileText,
  Star,
} from "lucide-react";

import { formatCurrency } from "@/lib/currency";
import type {
  ActivityMeta,
  ActivityType,
  TrustItem,
  VerificationStatus,
  SellerRating,
} from "@/types/profile";

export const ACTIVITY_META: Record<ActivityType, ActivityMeta> = {
  account_created: {
    icon: UserCheck,
    bgClass: "bg-primary/10",
    iconColor: "text-primary",
    title: "Account created",
  },
  verification_requested: {
    icon: ShieldAlert,
    bgClass: "bg-warning/10",
    iconColor: "text-warning",
    title: "Verification requested",
  },
  verification_approved: {
    icon: ShieldCheck,
    bgClass: "bg-success/10",
    iconColor: "text-success",
    title: "Verification approved",
  },
  verification_rejected: {
    icon: ShieldAlert,
    bgClass: "bg-destructive/10",
    iconColor: "text-destructive",
    title: "Verification rejected",
  },
  role_changed: {
    icon: ShieldCheck,
    bgClass: "bg-primary/10",
    iconColor: "text-primary",
    title: "Role changed",
  },
  listing_created: {
    icon: Tag,
    bgClass: "bg-primary/10",
    iconColor: "text-primary",
    title: "Listing created",
  },
  listing_sold: {
    icon: Award,
    bgClass: "bg-success/10",
    iconColor: "text-success",
    title: "Listing sold",
  },
  bid_placed: {
    icon: Gavel,
    bgClass: "bg-warning/10",
    iconColor: "text-warning",
    title: "Bid placed",
  },
  bid_won: {
    icon: Trophy,
    bgClass: "bg-success/10",
    iconColor: "text-success",
    title: "Auction won",
  },
};

/**
 * Formats a ZAR price, or an em dash when the price is unknown.
 * @param price - Amount in rand, if known.
 * @returns The formatted price string.
 */
export const formatPrice = (price?: number): string => {
  if (price === undefined) return "—";
  return formatCurrency(price);
};

/**
 * Formats a member-since timestamp as a long month and year.
 * @param timestamp - Epoch milliseconds, if known.
 * @returns The formatted date, or an empty string when unknown.
 */
export const formatMemberSince = (timestamp?: number): string => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
};

/**
 * Derives up to two letters of initials from a display name.
 * @param name - The display name, if known.
 * @returns Upper-case initials, or `??` when the name is missing.
 */
export const getInitials = (name?: string): string => {
  if (!name) return "??";
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

/**
 * Formats an activity timestamp as a short month and year.
 * @param timestamp - Epoch milliseconds, if known.
 * @returns The formatted date, or `Unknown`.
 */
export const formatActivityDate = (timestamp?: number): string => {
  if (!timestamp) return "Unknown";
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-ZA", { month: "short", year: "numeric" });
};

/**
 * Builds the trust and compliance checklist shown on a profile.
 * @param isVerified - Whether the profile is verified.
 * @param kycStatus - The KYC status, if any.
 * @param verification - Per-channel verification flags.
 * @param rating - Seller rating summary, if any.
 * @returns The ordered list of trust items.
 */
export const getTrustItems = (
  isVerified: boolean,
  kycStatus?: string,
  verification?: VerificationStatus,
  rating?: SellerRating
): TrustItem[] => {
  const { emailVerified, phoneVerified, bankingVerified, taxNumberVerified } =
    verification ?? {};
  return [
    {
      id: "identity",
      icon: ShieldAlert,
      label: "Identity",
      value: isVerified || kycStatus === "verified" ? "Verified" : "Pending",
      verified: isVerified || kycStatus === "verified",
    },
    {
      id: "banking",
      icon: CreditCard,
      label: "Banking",
      value: bankingVerified ? "Linked" : "Not linked",
      verified: bankingVerified ?? false,
    },
    {
      id: "phone",
      icon: Phone,
      label: "Phone",
      value: phoneVerified ? "Verified" : "Pending",
      verified: phoneVerified ?? false,
    },
    {
      id: "email",
      icon: Mail,
      label: "Email",
      value: emailVerified ? "Verified" : "Pending",
      verified: emailVerified ?? false,
    },
    {
      id: "tax",
      icon: FileText,
      label: "Tax Number",
      value: taxNumberVerified ? "Verified" : "Pending",
      verified: taxNumberVerified ?? false,
    },
    {
      id: "rating",
      icon: Star,
      label: "Seller Rating",
      value:
        rating?.avgRating !== undefined
          ? `${rating.avgRating.toFixed(1)} (${String(rating.reviewCount)})`
          : "No reviews",
      verified: (rating?.reviewCount ?? 0) > 0,
    },
  ];
};
