import { useState, type SyntheticEvent } from "react";

import { BottomSheet } from "@/components/ds/BottomSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { normalizeSaPhone } from "@/lib/phone";
import {
  PROVINCES,
  PROVINCE_LABELS,
  isProvince,
  type Province,
} from "@/lib/provinces";

import {
  TRANSPORT_QUOTE_MAX_NAME_LENGTH,
  TRANSPORT_QUOTE_MAX_NOTES_LENGTH,
  TRANSPORT_QUOTE_MAX_PICKUP_LENGTH,
  TRANSPORT_QUOTE_MAX_TOWN_LENGTH,
} from "../../../convex/constants";

const FORM_ID = "transport-quote-form";

/** The values a valid transport quote form submits. */
export interface TransportQuoteValues {
  /** Where to collect from; only set when the request is not about a lot. */
  pickup?: string;
  deliveryTown: string;
  deliveryProvince: Province;
  name: string;
  /** As typed; the server normalises it. */
  phone: string;
  notes?: string;
}

interface TransportQuoteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The lot the quote is for. Without it the sheet asks where to collect from. */
  lot?: { label: string; place: string };
  /** Prefilled name (from the signed-in profile). */
  defaultName?: string;
  /** Prefilled phone (from the signed-in profile). */
  defaultPhone?: string;
  /** True while the request is being sent. */
  busy: boolean;
  /** A server error to show above the buttons. */
  error: string | null;
  onSubmit: (values: TransportQuoteValues) => void;
}

type FieldErrors = Partial<
  Record<"pickup" | "town" | "province" | "name" | "phone", string>
>;

interface FormProps {
  lot?: { label: string; place: string };
  defaultName?: string;
  defaultPhone?: string;
  error: string | null;
  onSubmit: (values: TransportQuoteValues) => void;
}

/**
 * The form body. It only mounts while the sheet is open, so closing the sheet
 * resets every field. A field the user has not touched shows its default, so a
 * profile that loads late still fills in.
 *
 * @param props - Component props
 * @param props.lot - The lot, when the request is about one
 * @param props.defaultName - Prefilled name
 * @param props.defaultPhone - Prefilled phone
 * @param props.error - A server error to show
 * @param props.onSubmit - Called with the trimmed values when they are valid
 * @returns The form
 */
function TransportQuoteForm({
  lot,
  defaultName,
  defaultPhone,
  error,
  onSubmit,
}: FormProps) {
  const [pickup, setPickup] = useState("");
  const [town, setTown] = useState("");
  const [province, setProvince] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const nameValue = name ?? defaultName ?? "";
  const phoneValue = phone ?? defaultPhone ?? "";

  const handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
    const next: FieldErrors = {};
    const values = {
      pickup: pickup.trim(),
      town: town.trim(),
      name: nameValue.trim(),
      phone: phoneValue.trim(),
      notes: notes.trim(),
    };
    if (!lot && !values.pickup) next.pickup = "Enter where to collect from.";
    if (!values.town) next.town = "Enter the delivery town.";
    if (!isProvince(province)) next.province = "Choose a province.";
    if (!values.name) next.name = "Enter your name.";
    if (!normalizeSaPhone(values.phone)) {
      next.phone = "Enter a South African phone number, like 083 700 0000.";
    }
    setErrors(next);
    if (!isProvince(province) || Object.keys(next).length > 0) return;
    onSubmit({
      ...(lot ? {} : { pickup: values.pickup }),
      deliveryTown: values.town,
      deliveryProvince: province,
      name: values.name,
      phone: values.phone,
      ...(values.notes ? { notes: values.notes } : {}),
    });
  };

  return (
    <form
      id={FORM_ID}
      noValidate
      onSubmit={handleSubmit}
      className="flex flex-col gap-3"
    >
      {lot ? (
        <div className="text-[15px]">
          <p className="text-muted-foreground">{lot.label}</p>
          <p className="font-medium">Collect from {lot.place}</p>
        </div>
      ) : (
        <Field
          id="tq-pickup"
          label="Collect from"
          error={errors.pickup}
          input={
            <Input
              id="tq-pickup"
              value={pickup}
              maxLength={TRANSPORT_QUOTE_MAX_PICKUP_LENGTH}
              aria-invalid={!!errors.pickup}
              onChange={(e) => {
                setPickup(e.target.value);
              }}
            />
          }
        />
      )}
      <Field
        id="tq-town"
        label="Deliver to (town)"
        error={errors.town}
        input={
          <Input
            id="tq-town"
            value={town}
            maxLength={TRANSPORT_QUOTE_MAX_TOWN_LENGTH}
            aria-invalid={!!errors.town}
            onChange={(e) => {
              setTown(e.target.value);
            }}
          />
        }
      />
      <Field
        id="tq-province"
        label="Province"
        error={errors.province}
        input={
          <Select value={province} onValueChange={setProvince}>
            <SelectTrigger
              id="tq-province"
              className="w-full"
              aria-invalid={!!errors.province}
            >
              <SelectValue placeholder="Choose a province" />
            </SelectTrigger>
            <SelectContent>
              {PROVINCES.map((key) => (
                <SelectItem key={key} value={key}>
                  {PROVINCE_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <Field
        id="tq-name"
        label="Your name"
        error={errors.name}
        input={
          <Input
            id="tq-name"
            autoComplete="name"
            value={nameValue}
            maxLength={TRANSPORT_QUOTE_MAX_NAME_LENGTH}
            aria-invalid={!!errors.name}
            onChange={(e) => {
              setName(e.target.value);
            }}
          />
        }
      />
      <Field
        id="tq-phone"
        label="Phone"
        error={errors.phone}
        input={
          <Input
            id="tq-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phoneValue}
            maxLength={20}
            aria-invalid={!!errors.phone}
            onChange={(e) => {
              setPhone(e.target.value);
            }}
          />
        }
      />
      <Field
        id="tq-notes"
        label="Notes (optional)"
        input={
          <Textarea
            id="tq-notes"
            value={notes}
            maxLength={TRANSPORT_QUOTE_MAX_NOTES_LENGTH}
            onChange={(e) => {
              setNotes(e.target.value);
            }}
          />
        }
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}

interface FieldProps {
  id: string;
  label: string;
  input: React.ReactNode;
  error?: string;
}

/**
 * A label, its control and an inline error.
 *
 * @param props - Component props
 * @param props.id - The control id the label points at
 * @param props.label - The label text
 * @param props.input - The control
 * @param props.error - The inline error, when any
 * @returns The field
 */
function Field({ id, label, input, error }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {input}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The "Request a transport quote" bottom sheet. Presentational: it validates
 * the form and hands the trimmed values to `onSubmit`; sending, prefill and the
 * toast live in `useTransportQuote`. With a lot it shows the lot and where it
 * stands; without one it asks where to collect from. Fields reset when it
 * closes.
 *
 * @param props - Component props
 * @param props.open - Whether the sheet is open
 * @param props.onOpenChange - Called when the sheet asks to open or close
 * @param props.lot - The lot label and place, when the request is about a lot
 * @param props.defaultName - Prefilled name
 * @param props.defaultPhone - Prefilled phone
 * @param props.busy - True while the request is being sent
 * @param props.error - A server error to show
 * @param props.onSubmit - Called with the trimmed values when they are valid
 * @returns The sheet
 */
export function TransportQuoteSheet({
  open,
  onOpenChange,
  lot,
  defaultName,
  defaultPhone,
  busy,
  error,
  onSubmit,
}: TransportQuoteSheetProps) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Request a transport quote"
      actions={
        <div className="flex w-full flex-col gap-2">
          <Button
            type="submit"
            form={FORM_ID}
            className="w-full"
            disabled={busy}
          >
            Send request
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
        </div>
      }
    >
      <TransportQuoteForm
        lot={lot}
        defaultName={defaultName}
        defaultPhone={defaultPhone}
        error={error}
        onSubmit={onSubmit}
      />
    </BottomSheet>
  );
}
