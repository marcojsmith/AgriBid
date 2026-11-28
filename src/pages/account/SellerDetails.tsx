import {
  useState,
  type KeyboardEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { Helmet } from "react-helmet-async";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";

import { SubPage } from "@/components/account/AccountLayout";
import { Banner } from "@/components/ds/Banner";
import { showToast } from "@/components/ds/showToast";
import { TextField } from "@/components/ds/TextField";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useUserProfile } from "@/hooks/useUserProfile";
import { buildTitle } from "@/lib/seo";
import { getErrorMessage } from "@/lib/utils";

import {
  SELLER_TYPE_LABELS,
  type SellerType,
} from "../../../convex/lib/lotSpecs";
import {
  MAX_COLLECTION_ADDRESS_LENGTH,
  MAX_PROFILE_BIO_LENGTH,
  MAX_PROFILE_FIELD_LENGTH,
} from "../../../convex/constants";

const SELLER_TYPES = Object.keys(SELLER_TYPE_LABELS) as SellerType[];

interface FormProps {
  profile: {
    companyName?: string;
    location?: string;
    vatRegistered?: boolean;
    sellerType?: SellerType;
  };
  collectionAddress: string;
  bio: {
    bio?: string;
    bioPending?: string;
    bioStatus?: string;
    bioRejectionReason?: string;
  } | null;
}

/**
 * A labelled block with help text under it.
 *
 * @param props - Component props
 * @param props.id - Control id
 * @param props.label - Label
 * @param props.hint - Help text
 * @param props.children - The control
 * @returns The block
 */
function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The seller details form, mounted once the saved values are known: business
 * name, town, VAT, seller type, collection address and the About text. The
 * About text is moderated: an edit waits for approval (shown as "Waiting for
 * approval") and a refusal shows the reason. `bio` is sent only when it
 * changed.
 *
 * @param props - Component props
 * @param props.profile - Saved seller fields
 * @param props.collectionAddress - Saved collection address
 * @param props.bio - Saved About text and its review state
 * @returns The form
 */
function SellerForm({ profile, collectionAddress, bio }: FormProps) {
  const updateProfile = useMutation(api.users.updateMyProfile);
  const updateAddress = useMutation(api.lotPayments.updateMyCollectionAddress);
  const startBio = bio?.bioPending ?? bio?.bio ?? "";
  const [company, setCompany] = useState(profile.companyName ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const [vat, setVat] = useState(profile.vatRegistered === true);
  const [type, setType] = useState<SellerType | undefined>(profile.sellerType);
  const [address, setAddress] = useState(collectionAddress);
  const [about, setAbout] = useState(startBio);
  const [saving, setSaving] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = bio?.bioPending !== undefined && bio.bioStatus === "pending";
  const rejected = bio?.bioStatus === "rejected";

  /**
   * Arrow keys move the selection through the seller types.
   *
   * @param event - The key press on a seller type button
   */
  const moveType = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) return;
    event.preventDefault();
    const from = type ? SELLER_TYPES.indexOf(type) : -1;
    const next =
      SELLER_TYPES[(from + step + SELLER_TYPES.length) % SELLER_TYPES.length];
    setType(next);
    document.getElementById(`seller-type-${next}`)?.focus();
  };

  const save = async (event: SyntheticEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const bioChanged = about.trim() !== startBio.trim();
      // Clearing the text, or going back to the live text, needs no approval.
      const waits =
        bioChanged &&
        about.trim() !== "" &&
        about.trim() !== (bio?.bio ?? "").trim();
      // Back to the live text while an edit waits (or was refused): the server
      // only drops the review entry when asked to withdraw it.
      const backToLive =
        bio?.bioStatus !== undefined &&
        about.trim() !== "" &&
        about.trim() === (bio.bio ?? "").trim();
      await updateProfile({
        companyName: company.trim(),
        location: location.trim(),
        vatRegistered: vat,
        ...(type ? { sellerType: type } : {}),
        ...(bioChanged ? { bio: about.trim() } : {}),
        ...(bioChanged && backToLive ? { withdrawPendingBio: true } : {}),
      });
      if (address.trim() !== collectionAddress.trim()) {
        try {
          await updateAddress({ address });
        } catch (err) {
          throw new Error(
            `Your other details were saved, but not the collection address. ${getErrorMessage(err, "Try again.")}`,
            { cause: err }
          );
        }
      }
      showToast(
        waits
          ? "Saved. Your About text is waiting for approval."
          : "Seller details saved."
      );
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save your details."));
    } finally {
      setSaving(false);
    }
  };

  const withdraw = async () => {
    setWithdrawing(true);
    try {
      await updateProfile({
        bio: bio?.bio ?? "",
        withdrawPendingBio: true,
      });
      setAbout(bio?.bio ?? "");
      showToast("Edit withdrawn.");
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't withdraw the edit."), "error");
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        void save(event);
      }}
    >
      {error ? <Banner kind="warn">{error}</Banner> : null}
      <TextField
        id="seller-company"
        label="Business name"
        value={company}
        onChange={setCompany}
        maxLength={MAX_PROFILE_FIELD_LENGTH}
        hint="Shown on your public page. Leave empty to use your name."
      />
      <TextField
        id="seller-location"
        label="Town or area"
        value={location}
        onChange={setLocation}
        maxLength={MAX_PROFILE_FIELD_LENGTH}
      />
      <div className="flex min-h-14 items-center justify-between gap-3 border-y border-border py-2">
        <label htmlFor="seller-vat" className="text-[17px] font-semibold">
          VAT registered
        </label>
        <Switch
          id="seller-vat"
          checked={vat}
          onCheckedChange={setVat}
          className="h-8 w-[52px] [&>span]:ml-0.5 [&>span]:size-6"
        />
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Seller type</legend>
        <div
          className="grid gap-2 sm:grid-cols-3"
          role="radiogroup"
          aria-label="Seller type"
        >
          {SELLER_TYPES.map((value) => (
            <button
              key={value}
              id={`seller-type-${value}`}
              type="button"
              role="radio"
              aria-checked={type === value}
              tabIndex={
                type === value ||
                (type === undefined && value === SELLER_TYPES[0])
                  ? 0
                  : -1
              }
              onKeyDown={moveType}
              onClick={() => {
                setType(value);
              }}
              className={
                type === value
                  ? "min-h-11 rounded-md border border-primary bg-primary-soft px-3 text-[15px] font-semibold"
                  : "min-h-11 rounded-md border border-border px-3 text-[15px]"
              }
            >
              {SELLER_TYPE_LABELS[value]}
            </button>
          ))}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Only you and our team see this.
        </p>
      </fieldset>
      <Field
        id="seller-address"
        label="Collection address"
        hint="Only shown to a buyer after we confirm their payment."
      >
        <Textarea
          id="seller-address"
          value={address}
          maxLength={MAX_COLLECTION_ADDRESS_LENGTH}
          aria-describedby="seller-address-hint"
          onChange={(e) => {
            setAddress(e.target.value);
          }}
          className="min-h-24 text-[17px]"
        />
      </Field>
      <Field
        id="seller-about"
        label="About"
        hint="We read it before it shows on your public page."
      >
        {pending ? (
          <p className="mb-1 inline-flex items-center rounded-sm px-2.5 py-1 text-sm font-semibold text-muted-foreground ring-1 ring-border ring-inset">
            Waiting for approval
          </p>
        ) : null}
        {rejected ? (
          <Banner kind="warn" className="mb-2">
            Not approved
            {bio?.bioRejectionReason ? `: ${bio.bioRejectionReason}` : "."}
          </Banner>
        ) : null}
        <Textarea
          id="seller-about"
          value={about}
          maxLength={MAX_PROFILE_BIO_LENGTH}
          aria-describedby="seller-about-hint"
          onChange={(e) => {
            setAbout(e.target.value);
          }}
          className="min-h-32 text-[17px]"
        />
        {pending ? (
          <Button
            type="button"
            variant="outline"
            className="mt-2 w-full"
            disabled={withdrawing}
            onClick={() => {
              void withdraw();
            }}
          >
            Withdraw edit
          </Button>
        ) : null}
      </Field>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

/**
 * Seller details: the fields that describe the seller (business name, town,
 * VAT, seller type), the private collection address and the moderated About
 * text.
 *
 * @returns The page
 */
export default function SellerDetails() {
  const userData = useUserProfile();
  const address = useQuery(api.lotPayments.getMyCollectionAddress);
  const bio = useQuery(api.users.getMyBio);
  const profile = userData?.profile;

  return (
    <SubPage title="Seller details">
      <Helmet>
        <title>{buildTitle("Seller details")}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      {userData === undefined || address === undefined || bio === undefined ? (
        <div
          role="status"
          aria-label="Loading seller details"
          className="space-y-3"
        >
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <SellerForm
          profile={profile ?? {}}
          collectionAddress={address ?? ""}
          bio={bio}
        />
      )}
    </SubPage>
  );
}
