import { useParams, Link } from "react-router-dom";
import { useQuery, usePaginatedQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { LucideIcon } from "lucide-react";
import {
  UserCheck,
  ShieldCheck,
  Calendar,
  Gavel,
  Award,
  ArrowLeft,
  MapPin,
  Star,
  AlertTriangle,
  Plus,
  MessageSquare,
  Flag,
  ShieldAlert,
  Phone,
  Mail,
  CreditCard,
  FileText,
  Pencil,
  X,
  Check,
  Building2,
} from "lucide-react";
import { useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { ProfileSkeleton } from "@/components/ProfileSkeleton";
import { Button } from "@/components/ui/button";
import { AuctionCard } from "@/components/auction/AuctionCard";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface ActivityItem {
  id: string;
  type: "account_created" | "verification_requested" | "role_changed";
  title: string;
  description: string;
  date: string;
}

interface TrustItem {
  id: string;
  icon: LucideIcon;
  label: string;
  value: string;
  verified: boolean;
}

const formatPrice = (price?: number): string => {
  if (price === undefined || price === null) return "—";
  return `R ${price.toLocaleString("en-ZA")}`;
};

const formatMemberSince = (timestamp?: number): string => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
};

const getInitials = (name?: string): string => {
  if (!name) return "??";
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const formatActivityDate = (timestamp?: number): string => {
  if (!timestamp) return "Unknown";
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-ZA", { month: "short", year: "numeric" });
};

const getActivityItems = (role: string, createdAt?: number): ActivityItem[] => {
  const memberSince = formatActivityDate(createdAt);
  const items: ActivityItem[] = [
    {
      id: "1",
      type: "account_created",
      title: "Account created",
      description: "Profile set up — verification pending",
      date: memberSince,
    },
    {
      id: "2",
      type: "verification_requested",
      title: "Verification requested",
      description: "Identity documents submitted for review",
      date: memberSince,
    },
  ];
  if (role === "admin") {
    items.push({
      id: "3",
      type: "role_changed",
      title: "Admin role assigned",
      description: "Granted administrative access to platform",
      date: memberSince,
    });
  }
  return items;
};

const getTrustItems = (
  isVerified: boolean,
  kycStatus?: string
): TrustItem[] => {
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
      value: "Not linked",
      verified: false,
    },
    {
      id: "phone",
      icon: Phone,
      label: "Phone",
      value: "Pending",
      verified: false,
    },
    {
      id: "email",
      icon: Mail,
      label: "Email",
      value: "Pending",
      verified: false,
    },
    {
      id: "tax",
      icon: FileText,
      label: "Tax Number",
      value: "Pending",
      verified: false,
    },
    {
      id: "rating",
      icon: Star,
      label: "Seller Rating",
      value: "No reviews",
      verified: false,
    },
  ];
};

/**
 * Renders the seller profile page for the route parameter `userId`.
 *
 * Shows a full-page loading indicator while data is being fetched, a user-not-found view when the seller does not exist, or the complete profile when data is available. The profile includes a sidebar with seller metadata, stats, and action buttons, plus a main content area with active auctions, past sales, recent activity, and trust & compliance sections.
 *
 * @returns A React element containing the seller profile, a full-page loading indicator, or a user-not-found view.
 */
export default function Profile() {
  const { userId } = useParams<{ userId: string }>();
  const myProfile = useQuery(api.users.getMyProfile);
  const isProfileLoading = myProfile === undefined;
  const isOwner =
    !isProfileLoading &&
    (myProfile?.userId === userId || myProfile?._id === userId);

  const updateMyProfile = useMutation(api.users.updateMyProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    bio: myProfile?.profile?.bio ?? "",
    location: myProfile?.profile?.location ?? "",
    companyName: myProfile?.profile?.companyName ?? "",
  });

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateMyProfile({
        bio: editForm.bio || undefined,
        location: editForm.location || undefined,
        companyName: editForm.companyName || undefined,
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const sellerInfo = useQuery(api.auctions.getSellerInfo, {
    sellerId: userId ?? "",
  });

  const watchedAuctionIds = useQuery(api.watchlist.getWatchedAuctionIds, {});

  const {
    results: listings,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.auctions.getSellerListings,
    { userId: userId ?? "" },
    { initialNumItems: 6 }
  );

  if (sellerInfo === undefined || status === "LoadingFirstPage") {
    return (
      <div className="flex h-[60vh] items-center justify-center bg-background">
        <ProfileSkeleton />
      </div>
    );
  }

  if (sellerInfo === null) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center space-y-6">
        <h1 className="text-4xl font-black uppercase">User Not Found</h1>
        <p className="text-muted-foreground font-bold">
          The profile you are looking for does not exist or has been
          deactivated.
        </p>
        <Button asChild variant="outline" className="rounded-md border-2">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Marketplace
          </Link>
        </Button>
      </div>
    );
  }

  const activeListings = listings.filter((l) => l.status === "active");
  const soldListings = listings.filter((l) => l.status === "sold");
  const activityItems = getActivityItems(sellerInfo.role, sellerInfo.createdAt);
  const trustItems = getTrustItems(sellerInfo.isVerified);

  return (
    <div className="max-w-7xl mx-auto space-y-8 px-4 py-4 sm:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 lg:gap-8">
        {/* Sidebar — single merged card */}
        <aside>
          <Card className="bg-card border border-primary/10 rounded-lg overflow-hidden">
            {/* Profile header */}
            <div className="h-14 sm:h-20 bg-gradient-to-br from-primary to-accent" />
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-4 -mt-10 mb-4">
                <div className="h-16 w-16 rounded-md bg-primary/10 flex items-center justify-center border-4 border-card shadow-md">
                  <span className="text-xl font-black text-primary">
                    {getInitials(sellerInfo.name)}
                  </span>
                </div>
              </div>

              <div className="flex items-start justify-between">
                <h1 className="text-2xl font-black text-primary uppercase leading-none mb-2">
                  {sellerInfo.name}
                </h1>
                {isOwner && !isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditForm({
                        bio: myProfile?.profile?.bio ?? "",
                        location: myProfile?.profile?.location ?? "",
                        companyName: myProfile?.profile?.companyName ?? "",
                      });
                      setIsEditing(true);
                    }}
                    className="h-8 px-2 rounded-md font-bold uppercase text-xs"
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {sellerInfo.role === "admin" && (
                  <Badge className="bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px]">
                    Admin
                  </Badge>
                )}
                {sellerInfo.isVerified ? (
                  <Badge className="bg-green-600 hover:bg-green-700 font-black uppercase tracking-widest text-[10px] flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    Verified
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500 hover:bg-amber-600 font-black uppercase tracking-widest text-[10px] flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Unverified
                  </Badge>
                )}
              </div>

              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mb-4">
                <Calendar className="h-4 w-4" />
                Member since {formatMemberSince(sellerInfo.createdAt)}
              </p>

              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="profile-bio"
                      className="text-[10px] font-black uppercase text-muted-foreground tracking-widest"
                    >
                      Bio
                    </label>
                    <Textarea
                      id="profile-bio"
                      value={editForm.bio}
                      onChange={(e) =>
                        setEditForm({ ...editForm, bio: e.target.value })
                      }
                      placeholder="Tell us about yourself..."
                      className="mt-1 min-h-[80px] rounded-xl border-2 font-bold text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="profile-location"
                      className="text-[10px] font-black uppercase text-muted-foreground tracking-widest"
                    >
                      Location
                    </label>
                    <Input
                      id="profile-location"
                      value={editForm.location}
                      onChange={(e) =>
                        setEditForm({ ...editForm, location: e.target.value })
                      }
                      placeholder="City, Province"
                      className="mt-1 rounded-xl border-2 font-bold text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="profile-company-name"
                      className="text-[10px] font-black uppercase text-muted-foreground tracking-widest"
                    >
                      Company Name
                    </label>
                    <Input
                      id="profile-company-name"
                      value={editForm.companyName}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          companyName: e.target.value,
                        })
                      }
                      placeholder="Your company name"
                      className="mt-1 rounded-xl border-2 font-bold text-sm"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className="flex-1 h-9 rounded-xl font-black uppercase text-xs"
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
                      onClick={() => {
                        setEditForm({
                          bio: myProfile?.profile?.bio ?? "",
                          location: myProfile?.profile?.location ?? "",
                          companyName: myProfile?.profile?.companyName ?? "",
                        });
                        setIsEditing(false);
                      }}
                      disabled={isSaving}
                      className="flex-1 h-9 rounded-xl font-black uppercase text-xs border-2"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {sellerInfo.bio && (
                    <>
                      <div className="h-px bg-border my-4" />
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {sellerInfo.bio}
                      </p>
                    </>
                  )}

                  {sellerInfo.location && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-3">
                      <MapPin className="h-4 w-4" />
                      {sellerInfo.location}
                    </p>
                  )}

                  {sellerInfo.companyName && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-3">
                      <Building2 className="h-4 w-4" />
                      {sellerInfo.companyName}
                    </p>
                  )}
                </>
              )}
            </CardContent>

            {/* Stats */}
            <div className="h-px bg-border" />
            <div className="grid grid-cols-4 divide-x divide-border">
              <div className="p-3 text-center">
                <p className="text-xl font-black text-primary">
                  {sellerInfo.activeListings}
                </p>
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                  Active
                </p>
              </div>
              <div className="p-3 text-center">
                <p className="text-xl font-black text-green-600">
                  {sellerInfo.itemsSold}
                </p>
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                  Sold
                </p>
              </div>
              <div className="p-3 text-center">
                <p className="text-xl font-black text-primary">
                  {formatPrice(sellerInfo.avgSalePrice)}
                </p>
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                  Avg Sale
                </p>
              </div>
              <div className="p-3 text-center">
                <p className="text-xl font-black text-primary">
                  {sellerInfo.bidsPlaced}
                </p>
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                  Bids
                </p>
              </div>
            </div>

            {/* Rating row */}
            <div className="h-px bg-border" />
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-amber-500 tracking-widest">★★★★★</p>
                <p className="text-[10px] text-muted-foreground">
                  No reviews yet
                </p>
              </div>
              <p className="text-xl font-black text-muted-foreground">—</p>
            </div>

            {/* Action buttons */}
            <div className="h-px bg-border" />
            <div className="p-4 space-y-2">
              {isOwner && !sellerInfo.isVerified && (
                // TODO(#219): Implement granular verification status fields in backend
                <Button
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-wider text-xs h-10 rounded-md"
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
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-wider text-xs h-10 rounded-md"
                >
                  <Link to="/sell">
                    <Plus className="h-4 w-4 mr-2" />
                    List Equipment
                  </Link>
                </Button>
              )}
              {!isOwner && (
                <>
                  {/* TODO(#220): Implement messaging system in backend */}
                  <Button
                    variant="outline"
                    className="w-full border-2 border-border hover:border-primary/30 bg-transparent font-black uppercase tracking-wider text-xs h-10 rounded-md"
                    disabled
                    title="Coming soon - see issue #220"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Contact Seller
                  </Button>
                  {/* TODO(#221): Implement report functionality in backend */}
                  <Button
                    variant="ghost"
                    className="w-full text-muted-foreground hover:text-destructive font-bold uppercase tracking-wider text-xs h-10 rounded-md"
                    disabled
                    title="Coming soon - see issue #221"
                  >
                    <Flag className="h-4 w-4 mr-2" />
                    Report Profile
                  </Button>
                </>
              )}
            </div>
          </Card>
        </aside>

        {/* Main Content */}
        <main className="space-y-6">
          {/* Active Auctions */}
          <Card className="bg-card border border-primary/10 rounded-lg">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Gavel className="h-4 w-4 text-primary" />
                  <h2 className="text-lg font-black uppercase tracking-wide text-primary">
                    Active Auctions
                  </h2>
                </div>
                {/* TODO: Create filtered listings page (e.g., /auctions?seller=${userId}) */}
                <span className="text-xs font-bold uppercase tracking-widest text-primary opacity-60 cursor-default">
                  View all →
                </span>
              </div>

              {activeListings.length === 0 && status === "Exhausted" ? (
                <div className="border-2 border-dashed border-border rounded p-12 text-center">
                  <p className="text-4xl mb-3">🚜</p>
                  <p className="text-muted-foreground font-bold uppercase tracking-widest italic text-sm">
                    No active auctions at this time.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeListings.map((auction) => (
                    <AuctionCard
                      key={auction._id}
                      auction={auction}
                      isWatched={
                        watchedAuctionIds?.includes(auction._id) ?? false
                      }
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Past Sales */}
          {soldListings.length > 0 && (
            <Card className="bg-card border border-primary/10 rounded-lg">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-green-600" />
                    <h2 className="text-lg font-black uppercase tracking-wide text-green-700">
                      Sales History
                    </h2>
                  </div>
                  {/* TODO: Create filtered sales history page (e.g., /sales?seller=${userId}) */}
                  <span className="text-xs font-bold uppercase tracking-widest text-green-600 opacity-60 cursor-default">
                    View all →
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {soldListings.map((auction) => (
                    <AuctionCard
                      key={auction._id}
                      auction={auction}
                      isWatched={
                        watchedAuctionIds?.includes(auction._id) ?? false
                      }
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Activity */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <UserCheck className="h-4 w-4 text-blue-600" />
              <h2 className="text-lg font-black uppercase tracking-wide text-primary">
                Recent Activity
              </h2>
            </div>

            <div className="space-y-0">
              {activityItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 py-3 border-b border-border last:border-0"
                >
                  <div
                    className={`h-9 w-9 rounded flex items-center justify-center flex-shrink-0 ${
                      item.type === "account_created"
                        ? "bg-blue-500/10"
                        : item.type === "verification_requested"
                          ? "bg-amber-500/10"
                          : "bg-green-500/10"
                    }`}
                  >
                    <UserCheck
                      className={`h-4 w-4 ${
                        item.type === "account_created"
                          ? "text-blue-600"
                          : item.type === "verification_requested"
                            ? "text-amber-600"
                            : "text-green-600"
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {item.date}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Trust & Compliance */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-black uppercase tracking-wide text-primary">
                Trust & Compliance
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {trustItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    className="border border-border rounded p-4 text-center"
                  >
                    <Icon
                      className={`h-5 w-5 mx-auto mb-2 ${
                        item.verified ? "text-green-600" : "text-amber-600"
                      }`}
                    />
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">
                      {item.label}
                    </p>
                    <p
                      className={`text-xs font-bold ${
                        item.verified ? "text-green-600" : "text-amber-600"
                      }`}
                    >
                      {item.value}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </main>
      </div>

      {/* Pagination */}
      {(status === "CanLoadMore" || status === "LoadingMore") && (
        <div className="flex flex-col items-center gap-4 pt-4 pb-8">
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">
            Showing {listings.length} of {sellerInfo.totalListings} Listings
          </p>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              loadMore(6);
            }}
            disabled={status === "LoadingMore"}
            className="rounded-md border-2 px-12 font-black uppercase tracking-widest"
          >
            {status === "LoadingMore" ? (
              <>
                <LoadingIndicator size="sm" className="mr-2" />
                Loading...
              </>
            ) : (
              "Load More Listings"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
