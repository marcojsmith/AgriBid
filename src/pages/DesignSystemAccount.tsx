import { useEffect, useRef, useState, type ReactNode } from "react";
import { ConvexProviderWithAuth } from "convex/react";
import { api } from "convex/_generated/api";
import { getFunctionName, type FunctionReference } from "convex/server";
import { MemoryRouter } from "react-router-dom";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";

import { UserDropdown } from "@/components/header/UserDropdown";
import { BrandingProvider } from "@/contexts/BrandingProvider";
import {
  PushStatusOverride,
  type PushState,
  type PushStatus,
} from "@/hooks/usePushStatus";
import { SignOutOverride } from "@/hooks/useSignOut";
import { UserProfileContext, type UserProfile } from "@/hooks/useUserProfile";
import type { Registration } from "@/lib/registrationCopy";
import Account from "@/pages/account/Account";
import DepositPage from "@/pages/account/DepositPage";
import NotificationsPage from "@/pages/account/NotificationsPage";
import SellerDetails from "@/pages/account/SellerDetails";

import { fixtureClient, useFixtureAuth } from "./fixtureClient";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type Deposit = NonNullable<Registration["deposit"]>;
type Page = "account" | "deposit" | "notifications" | "seller" | "menu";

/** One frame of `profile-r2`: the page, the push state and what queries answer. */
interface Frame {
  id: string;
  label: string;
  page: Page;
  push: PushState;
  answers: Record<string, unknown>;
}

/**
 * Names a query for the answers map.
 *
 * @param ref - The query reference
 * @returns Its function name
 */
const nameOf = (ref: FunctionReference<"query">): string =>
  getFunctionName(ref);

/**
 * The signed-in user of every frame (Thandi Naidoo, as in the mockup).
 *
 * @returns The profile as `getMyProfile` returns it
 */
function fixtureUser(): NonNullable<UserProfile> {
  return {
    _id: "fixture-user",
    userId: "user_thandi",
    name: "Thandi Naidoo",
    email: "thandi@example.co.za",
    profile: {
      userId: "user_thandi",
      role: "seller" as const,
      isVerified: true,
      companyName: "Naidoo Landbou",
      location: "Malmesbury",
      vatRegistered: true,
      sellerType: "farming_business" as const,
      createdAt: 0,
      updatedAt: 0,
    },
  } as unknown as NonNullable<UserProfile>;
}

/**
 * The frames of `profile-r2.html` that belong to Account, with times relative
 * to now so every date reads as in the mockup.
 *
 * @param now - The clock (ms)
 * @returns The frames
 */
function buildFrames(now: number): Frame[] {
  const details: Registration["details"] = {
    idType: "sa_id",
    fullName: "Thandi Naidoo",
    phoneNumber: "+27825550147",
    idNumber: undefined,
    passportNumber: undefined,
    idNumberLast3: "084",
    countryOfIssue: undefined,
    streetAddress: "14 Kerk Street",
    town: "Malmesbury",
    postalCode: "7300",
  };
  const received: Deposit = {
    reference: "AB-DEP-1",
    status: "received",
    amount: 5000,
    receivedAt: now - 3 * DAY,
    refundRequestedAt: undefined,
    refundedAt: undefined,
    refundableAmount: 5000,
  };
  const registration = (over: Partial<Registration> = {}): Registration => ({
    eligibility: { kind: "ok" },
    details,
    documents: [],
    deposit: received,
    depositSettings: { enabled: true, amount: 5000, refundDays: 3 },
    submittedAt: now - 4 * DAY,
    ...over,
  });
  const noneToPay = {
    unpaidCount: 0,
    awaitingCount: 0,
    claimedCount: 0,
    nextPayBy: null,
    nextAmountDue: null,
    nextLotId: null,
  };
  const toPay = {
    unpaidCount: 1,
    awaitingCount: 1,
    claimedCount: 0,
    nextPayBy: now + 1 * DAY,
    nextAmountDue: 113_496,
    nextLotId: null,
  };
  const creditedLot = {
    lotNumber: 1,
    title: "JCB 3CX 4×4 TLB",
    depositCredit: 5000,
    amountDue: 113_496,
  };
  const base = {
    [nameOf(api.registration.getMyRegistration)]: registration(),
    [nameOf(api.lotPayments.getMyPaymentSummary)]: toPay,
    [nameOf(api.auctions.getMyListingsStats)]: { all: 3, active: 2, sold: 1 },
    [nameOf(api.userPreferences.getMyPreferences)]: null,
    [nameOf(api.sellers.getSellerSlugByUserId)]: "naidoo-landbou",
    [nameOf(api.lotPayments.getMyWonLots)]: [creditedLot],
    [nameOf(api.admin.platformSettings.getPlatformSettings)]: {
      watchAlertsEnabled: true,
      pushRemindersEnabled: true,
    },
    [nameOf(api.messages.getUnreadConversationCount)]: 2,
    [nameOf(api.registration.getMyBidEligibility)]: { kind: "ok" },
    [nameOf(api.lotPayments.getMyCollectionAddress)]:
      "Rietfontein Farm, R27, Malmesbury",
    [nameOf(api.users.getMyBio)]: {
      bio: "Fourth-generation grain and wool farm outside Malmesbury.",
    },
  };
  const quiet = {
    ...base,
    [nameOf(api.lotPayments.getMyPaymentSummary)]: noneToPay,
    [nameOf(api.lotPayments.getMyWonLots)]: [],
  };
  const refundable = (deposit: Deposit) => ({
    ...quiet,
    [nameOf(api.registration.getMyRegistration)]: registration({ deposit }),
  });
  return [
    {
      id: "menu",
      label:
        "Account menu (tap the avatar; a sheet on a phone, a dropdown from 768px)",
      page: "menu",
      push: "on",
      answers: base,
    },
    {
      id: "account",
      label: "Account: seller, payment due",
      page: "account",
      push: "on",
      answers: base,
    },
    {
      id: "account-buyer",
      label: "Account: a buyer who never sold",
      page: "account",
      push: "on",
      answers: {
        ...base,
        [nameOf(api.auctions.getMyListingsStats)]: {
          all: 0,
          active: 0,
          sold: 0,
        },
      },
    },
    {
      id: "account-clear",
      label: "Account: nothing to do",
      page: "account",
      push: "on",
      answers: quiet,
    },
    {
      id: "account-doc",
      label: "Account: a rejected document",
      page: "account",
      push: "on",
      answers: {
        ...quiet,
        [nameOf(api.auctions.getMyListingsStats)]: {
          all: 0,
          active: 0,
          sold: 0,
        },
        [nameOf(api.registration.getMyRegistration)]: registration({
          eligibility: { kind: "needs_replacing", count: 1 },
          documents: [
            {
              id: "doc1" as never,
              kind: "id_front",
              status: "rejected",
              fileName: "id-front.jpg",
              fileSize: 120_000,
              contentType: "image/jpeg",
              rejectionReason: "The photo is blurred.",
              reviewedAt: now - DAY,
            },
          ],
        }),
      },
    },
    {
      id: "account-unfinished",
      label: "Account: registration unfinished (details can be edited)",
      page: "account",
      push: "off",
      answers: {
        ...quiet,
        [nameOf(api.auctions.getMyListingsStats)]: {
          all: 0,
          active: 0,
          sold: 0,
        },
        [nameOf(api.registration.getMyRegistration)]: registration({
          eligibility: { kind: "incomplete", step: 2, totalSteps: 4 },
          deposit: null,
        }),
      },
    },
    {
      id: "deposit",
      label: "Deposit: credited to a lot, a payment is due",
      page: "deposit",
      push: "on",
      answers: base,
    },
    {
      id: "deposit-refund",
      label: "Deposit: can ask for a refund",
      page: "deposit",
      push: "on",
      answers: refundable(received),
    },
    {
      id: "deposit-requested",
      label: "Deposit: refund requested",
      page: "deposit",
      push: "on",
      answers: refundable({
        ...received,
        status: "refund_requested",
        refundRequestedAt: now - 2 * HOUR,
      }),
    },
    {
      id: "deposit-refunded",
      label: "Deposit: refunded",
      page: "deposit",
      push: "on",
      answers: refundable({
        ...received,
        status: "refunded",
        refundedAt: now - 3 * HOUR,
        refundableAmount: 0,
      }),
    },
    {
      id: "notifications",
      label: "Notifications: on",
      page: "notifications",
      push: "on",
      answers: base,
    },
    {
      id: "notifications-off",
      label: "Notifications: off on this phone",
      page: "notifications",
      push: "off",
      answers: base,
    },
    {
      id: "notifications-blocked",
      label: "Notifications: blocked in the browser",
      page: "notifications",
      push: "blocked",
      answers: base,
    },
    {
      id: "seller",
      label: "Seller details",
      page: "seller",
      push: "on",
      answers: base,
    },
  ];
}

/**
 * The page a frame shows.
 *
 * @param props - Component props
 * @param props.page - Which page
 * @returns The page
 */
function PageFor({ page }: { page: Page }): ReactNode {
  switch (page) {
    case "account":
      return <Account />;
    case "deposit":
      return <DepositPage />;
    case "notifications":
      return <NotificationsPage />;
    case "seller":
      return <SellerDetails />;
    case "menu":
      return (
        <div className="flex justify-end">
          <UserDropdown
            userData={{ name: "Thandi Naidoo", email: "thandi@example.co.za" }}
            isLoadingProfile={false}
            isVerified
            kycStatus="verified"
            role="seller"
            onSignOut={() => Promise.resolve()}
          />
        </div>
      );
  }
}

/**
 * One frame: the real page inside a fixture client, a fixed push state and its
 * own in-memory router, so no frame touches the URL or any backend.
 *
 * @param props - Component props
 * @param props.frame - The frame to render
 * @returns The titled frame
 */
function FrameView({ frame }: { frame: Frame }): ReactNode {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const el = document.createElement("div");
    node.appendChild(el);
    const root = createRoot(el);
    const push: PushStatus = {
      state: frame.push,
      busy: false,
      turnOn: () => Promise.resolve("on"),
      turnOff: () => Promise.resolve(),
    };
    root.render(
      <ConvexProviderWithAuth
        client={fixtureClient(frame.answers)}
        useAuth={useFixtureAuth}
      >
        <BrandingProvider>
          <HelmetProvider>
            <UserProfileContext.Provider value={fixtureUser()}>
              <PushStatusOverride.Provider value={push}>
                <SignOutOverride.Provider value={() => Promise.resolve()}>
                  <MemoryRouter initialEntries={["/"]}>
                    <PageFor page={frame.page} />
                  </MemoryRouter>
                </SignOutOverride.Provider>
              </PushStatusOverride.Provider>
            </UserProfileContext.Provider>
          </HelmetProvider>
        </BrandingProvider>
      </ConvexProviderWithAuth>
    );
    return () => {
      setTimeout(() => {
        root.unmount();
        el.remove();
      }, 0);
    };
  }, [frame]);
  return (
    <section
      aria-label={frame.id}
      className="rounded-md border border-border p-4"
    >
      <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
        {frame.id}: {frame.label}
      </h3>
      <div ref={host} className="mx-auto max-w-[1200px]" />
    </section>
  );
}

/**
 * The "Account" section of the design-system page: every frame of `profile-r2`
 * that belongs to Account (the menu, Account in its states, the deposit pages,
 * the notifications pages and Seller details), rendered by the real pages with
 * fixture data. Dark mode: use the page's theme switch.
 *
 * @returns The frames
 */
export function DesignSystemAccount() {
  // The clock is fixed at mount so the frames stay stable while the page ticks.
  const [frames] = useState(() => buildFrames(Date.now()));
  return (
    <div className="space-y-8">
      {frames.map((frame) => (
        <FrameView key={frame.id} frame={frame} />
      ))}
    </div>
  );
}
