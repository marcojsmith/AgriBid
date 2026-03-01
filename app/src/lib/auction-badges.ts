import { badgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

export const AUCTION_STATUS_BADGE_VARIANTS: Record<string, BadgeVariant> = {
  draft: "secondary",
  pending_review: "outline",
  active: "default",
  sold: "default",
  unsold: "destructive",
  rejected: "destructive",
};

export const FLAG_REASON_BADGE_VARIANTS: Record<string, BadgeVariant> = {
  misleading: "destructive",
  suspicious: "destructive",
  inappropriate: "secondary",
  other: "outline",
};

export const EDITABLE_AUCTION_STATUSES = ["draft", "pending_review"] as const;
export type EditableAuctionStatus = (typeof EDITABLE_AUCTION_STATUSES)[number];

export function isEditableStatus(status: string): boolean {
  return EDITABLE_AUCTION_STATUSES.includes(status as EditableAuctionStatus);
}

export function getAuctionStatusLabel(status: string): string {
  return status.replace(/_/g, " ");
}
