import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AdminProfile } from "@/hooks/admin/useUserManagement";
import {
  SELLER_TYPES,
  SELLER_TYPE_LABELS,
  parseSellerType,
  type SellerType,
} from "@/lib/lotSpecs";

/** Tri-state VAT choice: an unknown status must never be saved as "private". */
type VatChoice = "unset" | "registered" | "not_registered";

/**
 * Maps a stored VAT flag to the dialog choice.
 *
 * @param value - The stored flag, undefined when never set.
 * @returns The matching choice.
 */
function toVatChoice(value: boolean | undefined): VatChoice {
  if (value === undefined) return "unset";
  return value ? "registered" : "not_registered";
}

/**
 * Narrows a raw select value to a VAT choice, defaulting to "unset".
 *
 * @param value - The raw select value.
 * @returns The matching choice.
 */
function parseVatChoice(value: string): VatChoice {
  if (value === "registered" || value === "not_registered") return value;
  return "unset";
}

/**
 * Maps the dialog choice to the value sent to the server.
 *
 * @param choice - The chosen VAT status.
 * @returns undefined while unset, so the server leaves the field untouched.
 */
function fromVatChoice(choice: VatChoice): boolean | undefined {
  if (choice === "unset") return undefined;
  return choice === "registered";
}

/** Values saved by {@link SellerVatProfileDialog}. */
export interface SellerVatProfileValues {
  /** Whether the seller is VAT registered; omitted while the status is not set. */
  vatRegistered?: boolean;
  /** The seller type, when chosen. */
  sellerType?: SellerType;
}

/** Props for {@link SellerVatProfileDialog}. */
export interface SellerVatProfileDialogProps {
  /** The seller being edited; the dialog is closed when null. */
  user: AdminProfile | null;
  /** Whether a save is in flight. */
  isSaving: boolean;
  /** Called when the dialog is dismissed. */
  onClose: () => void;
  /** Called with the chosen values. */
  onSave: (values: SellerVatProfileValues) => void;
}

/**
 * Inner form, remounted per seller so its draft starts from the stored values.
 *
 * @param props - Component props.
 * @param props.user - The seller being edited.
 * @param props.isSaving - Whether a save is in flight.
 * @param props.onClose - Dismiss handler.
 * @param props.onSave - Save handler.
 * @returns The dialog body.
 */
function VatProfileForm({
  user,
  isSaving,
  onClose,
  onSave,
}: SellerVatProfileDialogProps & { user: AdminProfile }) {
  const [vatChoice, setVatChoice] = useState<VatChoice>(
    toVatChoice(user.vatRegistered)
  );
  const [sellerType, setSellerType] = useState<SellerType | undefined>(
    user.sellerType
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>Seller VAT and type</DialogTitle>
        <DialogDescription>
          {user.name?.trim() ? user.name : (user.email ?? "This seller")}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor="seller-vat-registered"
            className="text-xs font-semibold text-muted-foreground"
          >
            VAT registered
          </label>
          <select
            id="seller-vat-registered"
            value={vatChoice}
            onChange={(event) => {
              setVatChoice(parseVatChoice(event.target.value));
            }}
            className="border-input bg-background h-11 rounded-md border px-3 text-base md:text-sm"
          >
            <option value="unset">Not set</option>
            <option value="registered">VAT registered</option>
            <option value="not_registered">Not VAT registered</option>
          </select>
        </div>
        <div className="space-y-2">
          <label
            htmlFor="seller-type"
            className="text-xs font-semibold text-muted-foreground"
          >
            Seller type
          </label>
          <select
            id="seller-type"
            value={sellerType ?? ""}
            onChange={(event) => {
              setSellerType(parseSellerType(event.target.value));
            }}
            className="border-input bg-background h-11 w-full rounded-md border px-3 text-base md:text-sm"
          >
            <option value="">Not set</option>
            {SELLER_TYPES.map((type) => (
              <option key={type} value={type}>
                {SELLER_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            onSave({ vatRegistered: fromVatChoice(vatChoice), sellerType });
          }}
          disabled={isSaving}
        >
          Save
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Admin dialog to set a seller's VAT registration and seller type.
 *
 * @param props - Component props.
 * @returns The dialog element.
 */
export function SellerVatProfileDialog(props: SellerVatProfileDialogProps) {
  const { user, onClose } = props;
  return (
    <Dialog
      open={user !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        {user && <VatProfileForm key={user.userId} {...props} user={user} />}
      </DialogContent>
    </Dialog>
  );
}
