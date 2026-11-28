import { Link } from "react-router-dom";

import { Banner } from "@/components/ds/Banner";
import { Button } from "@/components/ui/button";
import { WhatsAppGlyph } from "@/components/ds/WhatsAppButton";
import {
  ACCOUNT_PATH,
  depositSummary,
  detailsEditable,
  idEndsIn,
  listingsSummary,
  notificationsSummary,
  registrationSummary,
  replacePath,
  sellerDetailsSummary,
  type AccountBannerModel,
  type AlertPrefs,
  type DepositView,
  type ListingStats,
} from "@/lib/account";
import { registerPath, type Registration } from "@/lib/registrationCopy";
import type { PushState } from "@/hooks/usePushStatus";

import { AccountSection, RowList, SettingsRow } from "./AccountLayout";

/**
 * The one thing that needs doing, with its action button. Rendered only when
 * something does.
 *
 * @param props - Component props
 * @param props.model - The banner
 * @returns The banner and button
 */
export function ActionBanner({ model }: { model: AccountBannerModel }) {
  return (
    <div className="space-y-3">
      <Banner kind={model.kind}>{model.text}</Banner>
      <Button asChild className="w-full">
        <Link to={model.to}>{model.label}</Link>
      </Button>
    </div>
  );
}

interface SellingProps {
  stats: ListingStats;
  profile: { companyName?: string; vatRegistered?: boolean };
  /** The public seller page slug, or null (the link is hidden). */
  slug: string | null | undefined;
}

/**
 * Selling for a user who has listed: My listings, Sell equipment, Seller
 * details and a link to the public page.
 *
 * @param props - Component props
 * @param props.stats - Listing counts
 * @param props.profile - Seller facts
 * @param props.slug - Public page slug
 * @returns The section
 */
export function SellingSection({ stats, profile, slug }: SellingProps) {
  return (
    <AccountSection id="selling" title="Selling" className="mt-5">
      <RowList>
        <SettingsRow
          label="My listings"
          value={listingsSummary(stats)}
          to="/dashboard/listings"
        />
        <SellEquipmentRow />
        <SettingsRow
          label="Seller details"
          value={sellerDetailsSummary(profile)}
          to="/account/seller"
        />
      </RowList>
      {slug ? (
        <Link
          to={`/sellers/${slug}`}
          className="mt-1 inline-flex min-h-11 items-center gap-1 text-[15px] font-semibold"
        >
          View my public page
          <span aria-hidden="true">›</span>
        </Link>
      ) : null}
    </AccountSection>
  );
}

/**
 * The "Sell equipment" row.
 *
 * @returns The list item
 */
export function SellEquipmentRow() {
  return (
    <SettingsRow label="Sell equipment" value="Send us a machine" to="/sell" />
  );
}

interface BiddingProps {
  registration: Registration;
  deposit: DepositView;
  /** Shows the "Sell equipment" row under Bidding (a buyer who never sold). */
  withSell: boolean;
}

/**
 * Bidding: registration and deposit merged into two rows. A buyer who has
 * never sold gets "Sell equipment" as a third row, so the dividers stay one
 * line with no gap.
 *
 * @param props - Component props
 * @param props.registration - The buyer's registration
 * @param props.deposit - The deposit state
 * @param props.withSell - Add the Sell equipment row
 * @returns The section
 */
export function BiddingSection({
  registration,
  deposit,
  withSell,
}: BiddingProps) {
  const { eligibility } = registration;
  const replace = replacePath(registration);
  const depositText = depositSummary(deposit);
  const registrationLink =
    eligibility.kind === "incomplete"
      ? registerPath("", { callbackUrl: ACCOUNT_PATH })
      : "/register/status";
  return (
    <AccountSection id="bidding" title="Bidding" className="mt-5">
      <RowList>
        {eligibility.kind === "needs_replacing" && replace ? (
          <SettingsRow
            label="Registration"
            value={registrationSummary(eligibility)}
            action={
              <Link
                to={replace}
                className="inline-flex min-h-11 shrink-0 items-center text-[15px] font-semibold underline"
              >
                Replace
              </Link>
            }
          />
        ) : (
          <SettingsRow
            label="Registration"
            value={registrationSummary(eligibility)}
            to={registrationLink}
          />
        )}
        {depositText ? (
          <SettingsRow
            label="Deposit"
            value={depositText}
            to={
              deposit.kind === "not_started"
                ? registerPath("deposit", { callbackUrl: ACCOUNT_PATH })
                : "/account/deposit"
            }
          />
        ) : null}
        {withSell ? <SellEquipmentRow /> : null}
      </RowList>
    </AccountSection>
  );
}

/**
 * Notifications: one row to the page with the switches.
 *
 * @param props - Component props
 * @param props.state - Push state of this browser
 * @param props.prefs - Saved switches
 * @returns The section
 */
export function NotificationsSection({
  state,
  prefs,
}: {
  state: PushState;
  prefs: AlertPrefs | null | undefined;
}) {
  return (
    <AccountSection id="notifications" title="Notifications" className="mt-5">
      <RowList>
        <SettingsRow
          label="On this phone"
          value={notificationsSummary(state, prefs)}
          to="/account/notifications"
        />
      </RowList>
    </AccountSection>
  );
}

interface DetailsProps {
  registration: Registration | null;
  /** The name and email Clerk knows, used when registration has none. */
  fallbackName: string | undefined;
  email: string | undefined;
  /** Business WhatsApp link, when one is set. */
  whatsappHref: string | undefined;
}

/**
 * Details: name, mobile, email, address and the end of the ID number. While
 * registration is unfinished the rows open the register step and return here;
 * afterwards they are read-only with a line on how to change them.
 *
 * @param props - Component props
 * @param props.registration - The buyer's registration
 * @param props.fallbackName - Name from the sign-in account
 * @param props.email - Email from the sign-in account
 * @param props.whatsappHref - The business WhatsApp link
 * @returns The section
 */
export function DetailsSection({
  registration,
  fallbackName,
  email,
  whatsappHref,
}: DetailsProps) {
  const details = registration?.details;
  const editable = detailsEditable(registration?.eligibility);
  const link = editable
    ? registerPath("details", { callbackUrl: ACCOUNT_PATH })
    : undefined;
  const address = [
    details?.streetAddress,
    [details?.town, details?.postalCode].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <AccountSection id="details" title="Details" className="mt-5">
      <RowList>
        <SettingsRow
          label="Name"
          value={details?.fullName ?? fallbackName ?? "Not added"}
          to={link}
        />
        <SettingsRow
          label="Mobile number"
          value={details?.phoneNumber ?? "Not added"}
          to={link}
        />
        <SettingsRow label="Email" value={email ?? "Not added"} />
        <SettingsRow
          label="Address"
          value={address === "" ? "Not added" : address}
          to={link}
        />
        <SettingsRow
          label="ID number"
          value={idEndsIn(details?.idNumberLast3)}
        />
      </RowList>
      {editable ? (
        <p className="mt-3 text-[15px] text-muted-foreground">
          Changing your name or ID number means we check your documents again.
        </p>
      ) : registration ? (
        <p className="mt-3 text-[15px] text-muted-foreground">
          To change these,{" "}
          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-foreground underline"
            >
              <WhatsAppGlyph className="size-[18px]" />
              WhatsApp us.
            </a>
          ) : (
            <Link
              to="/support"
              className="inline-flex min-h-11 items-center font-semibold text-foreground underline"
            >
              contact support.
            </Link>
          )}
        </p>
      ) : null}
    </AccountSection>
  );
}
