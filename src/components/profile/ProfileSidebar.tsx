import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "convex/react";
import {
  Calendar,
  Plus,
  AlertTriangle,
  Pencil,
  X,
  Check,
  Building2,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { api } from "convex/_generated/api";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  formatPrice,
  formatMemberSince,
  getInitials,
} from "@/lib/profile-utils";

import { MessageDialog } from "./MessageDialog";
import { ReportDialog } from "./ReportDialog";

interface ProfileData {
  name?: string;
  isVerified: boolean;
  kycStatus?: "pending" | "verified" | "rejected";
  role: string;
  createdAt?: number;
  itemsSold: number;
  totalListings: number;
  bio?: string;
  companyName?: string;
  location?: string;
  activeListings: number;
  bidsPlaced: number;
  avgSalePrice?: number;
  avgRating?: number;
  reviewCount: number;
}

interface ProfileSidebarProps {
  /** Profile data to display */
  profileData: ProfileData;
  /** The profile user's ID (used for messaging/reporting) */
  userId: string;
  /** Whether the current user owns this profile */
  isOwner: boolean;
  /** Initial data for the edit form */
  initialEditData?: { bio?: string; location?: string; companyName?: string };
}

/**
 * Renders the profile sidebar with user info, stats, and action buttons.
 *
 * @param props - Component props
 * @param props.profileData - Profile data to display
 * @param props.userId - The profile user's ID (used for messaging/reporting)
 * @param props.isOwner - Whether the current user owns this profile
 * @param props.initialEditData - Initial data for the edit form
 * @returns A sidebar card with profile information
 */
export function ProfileSidebar({
  profileData,
  userId,
  isOwner,
  initialEditData,
}: ProfileSidebarProps) {
  const updateMyProfile = useMutation(api.users.updateMyProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    bio: initialEditData?.bio ?? "",
    location: initialEditData?.location ?? "",
    companyName: initialEditData?.companyName ?? "",
  });

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await updateMyProfile({
        bio: editForm.bio || undefined,
        location: editForm.location || undefined,
        companyName: editForm.companyName || undefined,
      });
      setIsEditing(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save profile";
      setSaveError(message);
      console.error("Failed to save profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditForm({
      bio: initialEditData?.bio ?? "",
      location: initialEditData?.location ?? "",
      companyName: initialEditData?.companyName ?? "",
    });
    setIsEditing(false);
  };

  return (
    <aside>
      <Card className="bg-card border border-primary/10 rounded-md overflow-hidden">
        <div className="h-14 sm:h-20 bg-gradient-to-br from-primary to-accent" />
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-4 -mt-10 mb-4">
            <div className="h-16 w-16 rounded-md bg-primary/10 flex items-center justify-center border-4 border-card shadow-md">
              <span className="text-xl font-bold text-primary">
                {getInitials(profileData.name)}
              </span>
            </div>
          </div>

          <div className="flex items-start justify-between">
            <h1 className="text-2xl font-bold text-primary leading-none mb-2">
              {profileData.name}
            </h1>
            {isOwner && !isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditForm({
                    bio: initialEditData?.bio ?? "",
                    location: initialEditData?.location ?? "",
                    companyName: initialEditData?.companyName ?? "",
                  });
                  setIsEditing(true);
                }}
                className="h-8 px-2 rounded-md font-bold text-xs"
              >
                <Pencil className="h-3 w-3 mr-1" />
                Edit
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            {profileData.role === "admin" && (
              <Badge className="bg-primary text-primary-foreground font-semibold text-xs">
                Admin
              </Badge>
            )}
            {profileData.isVerified ? (
              <Badge className="bg-success hover:bg-success/90 text-success-foreground font-semibold text-xs flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                Verified
              </Badge>
            ) : (
              <Badge className="bg-warning hover:bg-warning/90 text-warning-foreground font-semibold text-xs flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Unverified
              </Badge>
            )}
          </div>

          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mb-4">
            <Calendar className="h-4 w-4" />
            Member since {formatMemberSince(profileData.createdAt)}
          </p>

          {isEditing ? (
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="profile-bio"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Bio
                </label>
                <Textarea
                  id="profile-bio"
                  value={editForm.bio}
                  onChange={(e) => {
                    setEditForm({ ...editForm, bio: e.target.value });
                  }}
                  placeholder="Tell us about yourself..."
                  className="mt-1 min-h-[80px] rounded-md border font-bold text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="profile-location"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Location
                </label>
                <Input
                  id="profile-location"
                  value={editForm.location}
                  onChange={(e) => {
                    setEditForm({ ...editForm, location: e.target.value });
                  }}
                  placeholder="City, Province"
                  className="mt-1 rounded-md border font-bold text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="profile-company-name"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Company Name
                </label>
                <Input
                  id="profile-company-name"
                  value={editForm.companyName}
                  onChange={(e) => {
                    setEditForm({
                      ...editForm,
                      companyName: e.target.value,
                    });
                  }}
                  placeholder="Your company name"
                  className="mt-1 rounded-md border font-bold text-sm"
                />
              </div>
              {saveError && (
                <p className="text-sm text-destructive mt-2">{saveError}</p>
              )}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex-1 h-9 rounded-md font-semibold text-xs"
                >
                  {isSaving ? (
                    <>
                      <span className="animate-pulse">Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Save
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="flex-1 h-9 rounded-md font-semibold text-xs border"
                >
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              {profileData.bio && (
                <>
                  <div className="h-px bg-border my-4" />
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {profileData.bio}
                  </p>
                </>
              )}

              {profileData.location && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-3">
                  <MapPin className="h-4 w-4" />
                  {profileData.location}
                </p>
              )}

              {profileData.companyName && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-3">
                  <Building2 className="h-4 w-4" />
                  {profileData.companyName}
                </p>
              )}
            </>
          )}
        </CardContent>

        <div className="h-px bg-border" />
        <div className="grid grid-cols-4 divide-x divide-border">
          <div className="p-3 text-center">
            <p className="text-xl font-bold text-primary">
              {profileData.activeListings}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              Active
            </p>
          </div>
          <div className="p-3 text-center">
            <p className="text-xl font-bold text-success">
              {profileData.itemsSold}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">Sold</p>
          </div>
          <div className="p-3 text-center">
            <p className="text-xl font-bold text-primary">
              {formatPrice(profileData.avgSalePrice)}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              Avg Sale
            </p>
          </div>
          <div className="p-3 text-center">
            <p className="text-xl font-bold text-primary">
              {profileData.bidsPlaced}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">Bids</p>
          </div>
        </div>

        <div className="h-px bg-border" />
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            {profileData.avgRating !== undefined ? (
              <p className="text-warning tracking-widest">
                {"★".repeat(Math.round(profileData.avgRating))}
                {"☆".repeat(5 - Math.round(profileData.avgRating))}
              </p>
            ) : (
              <p className="text-muted-foreground tracking-widest">★★★★★</p>
            )}
            <p className="text-[10px] text-muted-foreground">
              {profileData.reviewCount > 0
                ? `${String(profileData.reviewCount)} review${
                    profileData.reviewCount === 1 ? "" : "s"
                  }`
                : "No reviews yet"}
            </p>
          </div>
          <p className="text-xl font-semibold text-muted-foreground">—</p>
        </div>

        <div className="h-px bg-border" />
        <div className="p-4 space-y-2">
          {isOwner && !profileData.isVerified && (
            <Button
              className="w-full bg-warning hover:bg-warning/90 text-warning-foreground font-semibold text-xs h-10 rounded-md"
              disabled
              title="Coming soon - see issue #219"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Complete Verification
            </Button>
          )}
          {isOwner && (
            <Button
              asChild
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-10 rounded-md"
            >
              <Link to="/sell">
                <Plus className="h-4 w-4 mr-2" />
                List Equipment
              </Link>
            </Button>
          )}
          {!isOwner && (
            <>
              <MessageDialog userId={userId} />
              <ReportDialog userId={userId} />
            </>
          )}
        </div>
      </Card>
    </aside>
  );
}
