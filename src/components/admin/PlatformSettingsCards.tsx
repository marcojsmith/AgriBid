import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/lib/utils";

import {
  MAX_DEPOSIT_AMOUNT,
  MAX_DEPOSIT_REFUND_DAYS,
  MAX_FINANCE_CONTACT_FIELD_LENGTH,
  MAX_MIN_PHOTOS_PER_LOT,
  MAX_SELLER_PAYOUT_DAYS,
} from "../../../convex/constants";

type PlatformSettings = FunctionReturnType<
  typeof api.admin.platformSettings.getPlatformSettings
>;

/** Mirrors the server's finance contact phone pattern. */
const PHONE_PATTERN = /^[+\d][\d\s()-]{6,24}$/;

/** Range rule for a numeric setting; mirrors the server validation. */
interface NumberRule {
  label: string;
  min: number;
  max: number;
  integer: boolean;
}

/**
 * Validates a numeric text input against a rule.
 *
 * @param raw - Raw input text
 * @param rule - Range rule to apply
 * @returns The parsed number (NaN when invalid) and an error message when invalid
 */
function checkNumber(
  raw: string,
  rule: NumberRule
): { value: number; error: string | null } {
  const value = raw.trim() === "" ? Number.NaN : Number(raw);
  if (
    !Number.isFinite(value) ||
    value < rule.min ||
    value > rule.max ||
    (rule.integer && !Number.isInteger(value))
  ) {
    return {
      value: Number.NaN,
      error: `${rule.label} must be ${rule.integer ? "a whole number" : "a number"} between ${String(rule.min)} and ${String(rule.max)}.`,
    };
  }
  return { value, error: null };
}

/** Props for {@link SettingsSection}. */
interface SettingsSectionProps {
  /** Unique id prefix for the section. */
  id: string;
  /** Section heading. */
  title: string;
  /** Short helper line under the heading. */
  description: string;
  /** The form inputs. */
  children: ReactNode;
  /** Validation message, or null when the form is valid. */
  error: string | null;
  /** True when nothing changed since the stored values. */
  unchanged: boolean;
  /** Label of the save button. */
  saveLabel: string;
  /** Performs the save; rejections surface as an error toast. */
  onSave: () => Promise<unknown>;
  /** Toast shown after a successful save. */
  successMessage: string;
}

/**
 * Flat settings section with labelled inputs, validation message and save feedback.
 *
 * @param props - Component props
 * @param props.id - Unique id prefix for the section
 * @param props.title - Section heading
 * @param props.description - Short helper line under the heading
 * @param props.children - The form inputs
 * @param props.error - Validation message, or null when valid
 * @param props.unchanged - True when nothing changed since the stored values
 * @param props.saveLabel - Label of the save button
 * @param props.onSave - Performs the save
 * @param props.successMessage - Toast shown after a successful save
 * @returns The section element
 */
function SettingsSection({
  id,
  title,
  description,
  children,
  error,
  unchanged,
  saveLabel,
  onSave,
  successMessage,
}: SettingsSectionProps) {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (): Promise<void> => {
    if (error !== null || isSaving) return;
    setIsSaving(true);
    try {
      await onSave();
      toast.success(successMessage);
    } catch (err) {
      toast.error(getErrorMessage(err, `Failed to save: ${title}`));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="space-y-3 border-t pt-4"
    >
      <div>
        <h2 id={`${id}-heading`} className="text-sm font-semibold">
          {title}
        </h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave();
        }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{children}</div>
        {error && (
          <p
            id={`${id}-error`}
            role="alert"
            className="text-xs text-destructive"
          >
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={error !== null || unchanged || isSaving}
        >
          {isSaving ? "Saving..." : saveLabel}
        </Button>
      </form>
    </section>
  );
}

/** Props for {@link NumberField}. */
interface NumberFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  step?: string;
  invalid: boolean;
  describedBy?: string;
}

/**
 * Labelled numeric input.
 *
 * @param props - Component props
 * @param props.id - Input id
 * @param props.label - Visible label
 * @param props.value - Current text value
 * @param props.onChange - Called with the new text
 * @param props.step - Step attribute
 * @param props.invalid - Whether the value fails validation
 * @param props.describedBy - Id of the error message element, if any
 * @returns The field element
 */
function NumberField({
  id,
  label,
  value,
  onChange,
  step = "1",
  invalid,
  describedBy,
}: NumberFieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </div>
  );
}

/**
 * Buyer's premium percentage form.
 *
 * @param props - Component props
 * @param props.settings - Stored settings
 * @returns The section element
 */
function BuyerPremiumForm({ settings }: { settings: PlatformSettings }) {
  const update = useMutation(api.admin.platformSettings.updateBuyerPremium);
  const [pct, setPct] = useState(String(settings.buyerPremiumPct));
  const check = checkNumber(pct, {
    label: "Buyer's premium",
    min: 0,
    max: 100,
    integer: false,
  });

  return (
    <SettingsSection
      id="buyer-premium"
      title="Buyer's premium"
      description="Default percentage added to the hammer price for auctions without their own."
      error={check.error}
      unchanged={check.value === settings.buyerPremiumPct}
      saveLabel="Save buyer's premium"
      successMessage="Buyer's premium saved"
      onSave={() => update({ pct: check.value })}
    >
      <NumberField
        id="buyer-premium-pct"
        label="Buyer's premium (%)"
        step="0.01"
        value={pct}
        onChange={setPct}
        invalid={check.error !== null}
        describedBy={check.error ? "buyer-premium-error" : undefined}
      />
    </SettingsSection>
  );
}

/**
 * Registration deposit rules form.
 *
 * @param props - Component props
 * @param props.settings - Stored settings
 * @returns The section element
 */
function DepositForm({ settings }: { settings: PlatformSettings }) {
  const update = useMutation(
    api.admin.platformSettings.updateRegistrationDeposit
  );
  const [enabled, setEnabled] = useState(settings.deposit.enabled);
  const [amount, setAmount] = useState(String(settings.deposit.amount));
  const [days, setDays] = useState(String(settings.deposit.refundDays));
  const amountCheck = checkNumber(amount, {
    label: "Deposit amount",
    min: 0,
    max: MAX_DEPOSIT_AMOUNT,
    integer: true,
  });
  const daysCheck = checkNumber(days, {
    label: "Refund days",
    min: 1,
    max: MAX_DEPOSIT_REFUND_DAYS,
    integer: true,
  });
  const error = amountCheck.error ?? daysCheck.error;

  return (
    <SettingsSection
      id="deposit"
      title="Registration deposit"
      description="Refundable deposit a buyer pays before bidding."
      error={error}
      unchanged={
        enabled === settings.deposit.enabled &&
        amountCheck.value === settings.deposit.amount &&
        daysCheck.value === settings.deposit.refundDays
      }
      saveLabel="Save deposit"
      successMessage="Registration deposit saved"
      onSave={() =>
        update({
          enabled,
          amount: amountCheck.value,
          refundDays: daysCheck.value,
        })
      }
    >
      <div className="flex items-center gap-3 sm:pt-6">
        <Switch
          id="deposit-enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
        <Label htmlFor="deposit-enabled">Deposit required</Label>
      </div>
      <NumberField
        id="deposit-amount"
        label="Deposit amount (R)"
        value={amount}
        onChange={setAmount}
        invalid={amountCheck.error !== null}
        describedBy={error ? "deposit-error" : undefined}
      />
      <NumberField
        id="deposit-refund-days"
        label="Refund within (working days)"
        value={days}
        onChange={setDays}
        invalid={daysCheck.error !== null}
        describedBy={error ? "deposit-error" : undefined}
      />
    </SettingsSection>
  );
}

/**
 * Seller cost terms form (commission, listing fee, payout days).
 *
 * @param props - Component props
 * @param props.settings - Stored settings
 * @returns The section element
 */
function SellerCostsForm({ settings }: { settings: PlatformSettings }) {
  const update = useMutation(api.admin.platformSettings.updateSellerCosts);
  const [commission, setCommission] = useState(
    String(settings.sellerCosts.commissionPct)
  );
  const [fee, setFee] = useState(String(settings.sellerCosts.listingFee));
  const [days, setDays] = useState(String(settings.sellerCosts.payoutDays));
  const commissionCheck = checkNumber(commission, {
    label: "Commission",
    min: 0,
    max: 100,
    integer: false,
  });
  const feeCheck = checkNumber(fee, {
    label: "Listing fee",
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
    integer: false,
  });
  const daysCheck = checkNumber(days, {
    label: "Payout days",
    min: 1,
    max: MAX_SELLER_PAYOUT_DAYS,
    integer: true,
  });
  const error = commissionCheck.error ?? feeCheck.error ?? daysCheck.error;

  return (
    <SettingsSection
      id="seller-costs"
      title="Seller costs"
      description="Shown to sellers; not used in settlement."
      error={error}
      unchanged={
        commissionCheck.value === settings.sellerCosts.commissionPct &&
        feeCheck.value === settings.sellerCosts.listingFee &&
        daysCheck.value === settings.sellerCosts.payoutDays
      }
      saveLabel="Save seller costs"
      successMessage="Seller costs saved"
      onSave={() =>
        update({
          commissionPct: commissionCheck.value,
          listingFee: feeCheck.value,
          payoutDays: daysCheck.value,
        })
      }
    >
      <NumberField
        id="seller-commission"
        label="Commission (%)"
        step="0.01"
        value={commission}
        onChange={setCommission}
        invalid={commissionCheck.error !== null}
        describedBy={error ? "seller-costs-error" : undefined}
      />
      <NumberField
        id="seller-listing-fee"
        label="Listing fee (R)"
        step="0.01"
        value={fee}
        onChange={setFee}
        invalid={feeCheck.error !== null}
        describedBy={error ? "seller-costs-error" : undefined}
      />
      <NumberField
        id="seller-payout-days"
        label="Payout within (days)"
        value={days}
        onChange={setDays}
        invalid={daysCheck.error !== null}
        describedBy={error ? "seller-costs-error" : undefined}
      />
    </SettingsSection>
  );
}

/**
 * Finance contact form; leaving every field empty hides the contact from buyers.
 *
 * @param props - Component props
 * @param props.settings - Stored settings
 * @returns The section element
 */
function FinanceContactForm({ settings }: { settings: PlatformSettings }) {
  const update = useMutation(api.admin.platformSettings.updateFinanceContact);
  const stored = settings.financeContact;
  const [name, setName] = useState(stored.name ?? "");
  const [company, setCompany] = useState(stored.company ?? "");
  const [phone, setPhone] = useState(stored.phone ?? "");

  const tooLong = [name, company, phone].some(
    (text) => text.trim().length > MAX_FINANCE_CONTACT_FIELD_LENGTH
  );
  let error: string | null = null;
  if (tooLong) {
    error = `Each field must be at most ${String(MAX_FINANCE_CONTACT_FIELD_LENGTH)} characters.`;
  } else if (phone.trim() !== "" && !PHONE_PATTERN.test(phone.trim())) {
    error = "Enter a valid phone number, for example +27 11 555 0100.";
  }

  const fields: {
    id: string;
    label: string;
    value: string;
    set: (value: string) => void;
    type?: string;
  }[] = [
    { id: "finance-name", label: "Name", value: name, set: setName },
    {
      id: "finance-company",
      label: "Company",
      value: company,
      set: setCompany,
    },
    {
      id: "finance-phone",
      label: "Phone",
      value: phone,
      set: setPhone,
      type: "tel",
    },
  ];

  return (
    <SettingsSection
      id="finance-contact"
      title="Finance contact"
      description="Shown to buyers for payments. Leave all fields empty to hide it."
      error={error}
      unchanged={
        name.trim() === (stored.name ?? "") &&
        company.trim() === (stored.company ?? "") &&
        phone.trim() === (stored.phone ?? "")
      }
      saveLabel="Save finance contact"
      successMessage="Finance contact saved"
      onSave={() => update({ name, company, phone })}
    >
      {fields.map((field) => (
        <div key={field.id} className="space-y-1">
          <Label htmlFor={field.id}>{field.label}</Label>
          <Input
            id={field.id}
            type={field.type ?? "text"}
            value={field.value}
            aria-describedby={error ? "finance-contact-error" : undefined}
            onChange={(event) => {
              field.set(event.target.value);
            }}
          />
        </div>
      ))}
    </SettingsSection>
  );
}

/**
 * Push reminders switch.
 *
 * @param props - Component props
 * @param props.settings - Stored settings
 * @returns The section element
 */
function PushRemindersForm({ settings }: { settings: PlatformSettings }) {
  const update = useMutation(api.admin.platformSettings.updatePushReminders);
  const [enabled, setEnabled] = useState(settings.pushRemindersEnabled);

  return (
    <SettingsSection
      id="push-reminders"
      title="Push reminders"
      description="Auction-end reminders. Stays off until push notifications ship."
      error={null}
      unchanged={enabled === settings.pushRemindersEnabled}
      saveLabel="Save push reminders"
      successMessage="Push reminders saved"
      onSave={() => update({ enabled })}
    >
      <div className="flex items-center gap-3">
        <Switch
          id="push-reminders-enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
        <Label htmlFor="push-reminders-enabled">Send push reminders</Label>
      </div>
    </SettingsSection>
  );
}

/**
 * Watched-lot alerts switch (outbid and closing in 1 hour).
 *
 * @param props - Component props
 * @param props.settings - Stored settings
 * @returns The section element
 */
function WatchAlertsForm({ settings }: { settings: PlatformSettings }) {
  const update = useMutation(api.admin.platformSettings.updateWatchAlerts);
  const [enabled, setEnabled] = useState(settings.watchAlertsEnabled);

  return (
    <SettingsSection
      id="watch-alerts"
      title="Watched-lot alerts"
      description="Push and in-app alerts to people who watch a lot: outbid, and 1 hour before close."
      error={null}
      unchanged={enabled === settings.watchAlertsEnabled}
      saveLabel="Save watched-lot alerts"
      successMessage="Watched-lot alerts saved"
      onSave={() => update({ enabled })}
    >
      <div className="flex items-center gap-3">
        <Switch
          id="watch-alerts-enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
        <Label htmlFor="watch-alerts-enabled">
          Watched-lot alerts (outbid, closing in 1 hour)
        </Label>
      </div>
    </SettingsSection>
  );
}

/**
 * Minimum photos per lot form.
 *
 * @param props - Component props
 * @param props.settings - Stored settings
 * @returns The section element
 */
function MinPhotosForm({ settings }: { settings: PlatformSettings }) {
  const update = useMutation(api.admin.platformSettings.updateMinPhotos);
  const [count, setCount] = useState(String(settings.minPhotosPerLot));
  const check = checkNumber(count, {
    label: "Minimum photos",
    min: 1,
    max: MAX_MIN_PHOTOS_PER_LOT,
    integer: true,
  });

  return (
    <SettingsSection
      id="min-photos"
      title="Minimum photos per lot"
      description="Photos a seller must upload before a lot can be submitted."
      error={check.error}
      unchanged={check.value === settings.minPhotosPerLot}
      saveLabel="Save minimum photos"
      successMessage="Minimum photos saved"
      onSave={() => update({ count: check.value })}
    >
      <NumberField
        id="min-photos-count"
        label="Minimum photos"
        value={count}
        onChange={setCount}
        invalid={check.error !== null}
        describedBy={check.error ? "min-photos-error" : undefined}
      />
    </SettingsSection>
  );
}

/**
 * Admin sections for the platform settings: buyer's premium, registration
 * deposit, seller costs, finance contact, push reminders and minimum photos.
 *
 * @returns The settings sections, or a loading line while they load
 */
export function PlatformSettingsCards() {
  const settings = useQuery(api.admin.platformSettings.getPlatformSettings);

  if (settings === undefined) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading platform settings…
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <BuyerPremiumForm key={settings.buyerPremiumPct} settings={settings} />
      <DepositForm key={JSON.stringify(settings.deposit)} settings={settings} />
      <SellerCostsForm
        key={JSON.stringify(settings.sellerCosts)}
        settings={settings}
      />
      <FinanceContactForm
        key={JSON.stringify(settings.financeContact)}
        settings={settings}
      />
      <PushRemindersForm
        key={String(settings.pushRemindersEnabled)}
        settings={settings}
      />
      <WatchAlertsForm
        key={String(settings.watchAlertsEnabled)}
        settings={settings}
      />
      <MinPhotosForm key={settings.minPhotosPerLot} settings={settings} />
    </div>
  );
}
