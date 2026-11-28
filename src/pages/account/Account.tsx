import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";

import { AccountSection } from "@/components/account/AccountLayout";
import {
  ActionBanner,
  BiddingSection,
  DetailsSection,
  NotificationsSection,
  SellingSection,
} from "@/components/account/AccountSections";
import { SignOutButton } from "@/components/account/SignOutButton";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { useBranding } from "@/hooks/useBranding";
import { useNow } from "@/hooks/useNow";
import { useDepositCredit } from "@/hooks/useDepositCredit";
import { usePushStatus } from "@/hooks/usePushStatus";
import { useUserProfile } from "@/hooks/useUserProfile";
import { accountBanner, depositView, hasListings } from "@/lib/account";
import { whatsappLink } from "@/lib/homeSales";
import { initialsOf } from "@/lib/initials";
import { buildTitle } from "@/lib/seo";
import { cn } from "@/lib/utils";

/** The ids of the sections the desktop list can point at. */
const SECTION_IDS = ["selling", "bidding", "sell", "notifications", "details"];

/**
 * A skeleton shaped like the page, for the first load.
 *
 * @returns The placeholder
 */
function AccountSkeleton() {
  return (
    <div role="status" aria-label="Loading account" className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-14 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

/**
 * The Account page: header, an action banner when something needs doing,
 * Selling, Bidding, Notifications, Details and Sign out. A buyer who has never
 * listed sees "Sell equipment" as a row under Bidding instead of a Selling
 * section. From `lg` a section list sticks to the left.
 *
 * @returns The page
 */
export default function Account() {
  const userData = useUserProfile();
  const registration = useQuery(api.registration.getMyRegistration);
  const summary = useQuery(api.lotPayments.getMyPaymentSummary);
  const stats = useQuery(api.auctions.getMyListingsStats);
  const prefs = useQuery(api.userPreferences.getMyPreferences);
  const userId = userData?.profile?.userId;
  const sellerView = hasListings(stats);
  const slug = useQuery(
    api.sellers.getSellerSlugByUserId,
    userId && sellerView ? { userId } : "skip"
  );
  const push = usePushStatus();
  const [active, setActive] = useState<string | null>(null);
  const loaded =
    userData !== undefined &&
    registration !== undefined &&
    stats !== undefined &&
    summary !== undefined &&
    prefs !== undefined;

  // Marks the section in view in the desktop list (scroll-spy).
  useEffect(() => {
    if (!loaded || typeof IntersectionObserver === "undefined") return;
    const targets = SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null
    );
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
          .at(0);
        if (first) setActive(first.target.id);
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );
    for (const target of targets) observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [loaded]);
  const branding = useBranding();
  const now = useNow();
  const credit = useDepositCredit(registration?.deposit?.status === "received");

  if (!loaded) {
    return (
      <div className="mx-auto max-w-[640px]">
        <h1 className="font-display text-[28px] leading-tight font-semibold">
          Account
        </h1>
        <div className="mt-4">
          <AccountSkeleton />
        </div>
      </div>
    );
  }

  const profile = userData?.profile ?? null;
  const name =
    registration?.details.fullName ?? userData?.name?.trim() ?? "Your account";
  const clerkName = userData?.name?.trim();
  const email = userData?.email ?? undefined;
  const initials = initialsOf(name, email);
  const banner = accountBanner({ summary, registration, now });
  const deposit = registration ? depositView(registration, credit?.lot) : null;
  const sections = [
    sellerView ? { id: "selling", label: "Selling" } : null,
    registration ? { id: "bidding", label: "Bidding" } : null,
    !registration && !sellerView ? { id: "sell", label: "Selling" } : null,
    { id: "notifications", label: "Notifications" },
    { id: "details", label: "Details" },
  ].filter((s): s is { id: string; label: string } => s !== null);

  return (
    <>
      <Helmet>
        <title>{buildTitle("Account")}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="mx-auto max-w-[1200px] lg:grid lg:grid-cols-[220px_minmax(0,640px)] lg:justify-center lg:gap-20">
        <nav
          aria-label="Account sections"
          className="sticky top-24 hidden self-start pt-14 lg:block"
        >
          <ul className="space-y-1">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  aria-current={
                    section.id === (active ?? sections[0]?.id)
                      ? "location"
                      : undefined
                  }
                  onClick={() => {
                    setActive(section.id);
                  }}
                  className={cn(
                    "flex min-h-11 items-center rounded-md px-3 text-[15px] hover:bg-primary-soft",
                    section.id === (active ?? sections[0]?.id) &&
                      "bg-primary-soft font-semibold"
                  )}
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">
          <h1 className="font-display text-[28px] leading-tight font-semibold">
            Account
          </h1>
          <div className="mt-3 flex items-center gap-3">
            <div
              aria-hidden="true"
              className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground"
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{name}</p>
              {email ? (
                <p className="truncate text-sm text-muted-foreground">
                  {email}
                </p>
              ) : null}
            </div>
          </div>
          {banner ? (
            <div className="mt-3">
              <ActionBanner model={banner} />
            </div>
          ) : null}
          <RouteErrorBoundary>
            {sellerView && stats ? (
              <SellingSection
                stats={stats}
                profile={profile ?? {}}
                slug={slug}
                userId={userId}
              />
            ) : null}
            {registration && deposit ? (
              <BiddingSection
                registration={registration}
                deposit={deposit}
                withSell={!sellerView}
              />
            ) : !sellerView ? (
              <AccountSection id="sell" title="Selling" className="mt-5">
                <p className="mt-2 text-[17px]">
                  <Link to="/sell" className="font-semibold underline">
                    Sell equipment
                  </Link>
                </p>
              </AccountSection>
            ) : null}
            <NotificationsSection state={push.state} prefs={prefs} />
            <DetailsSection
              registration={registration}
              fallbackName={clerkName === "" ? undefined : clerkName}
              email={email}
              whatsappHref={whatsappLink(branding?.businessInfo?.whatsapp)}
            />
          </RouteErrorBoundary>
          <SignOutButton />
        </div>
      </div>
    </>
  );
}
