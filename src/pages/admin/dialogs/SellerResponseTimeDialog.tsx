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
import {
  SELLER_RESPONSE_TIMES,
  SELLER_RESPONSE_TIME_LABELS,
  type SellerResponseTime,
} from "@/lib/provinces";
import type { AdminProfile } from "@/hooks/admin/useUserManagement";

/** Props for {@link SellerResponseTimeDialog}. */
export interface SellerResponseTimeDialogProps {
  /** The seller being edited; the dialog is closed when null. */
  user: AdminProfile | null;
  /** Whether the dialog is saving. */
  isSaving: boolean;
  /** Called when the dialog is dismissed. */
  onClose: () => void;
  /** Called with the chosen value (`null` clears it). */
  onSave: (responseTime: SellerResponseTime | null) => void;
}

/**
 * Inner form, remounted per seller so its draft state starts from the stored value.
 *
 * @param props - Component props.
 * @param props.user - The seller being edited.
 * @param props.isSaving - Whether a save is in flight.
 * @param props.onClose - Dismiss handler.
 * @param props.onSave - Save handler.
 * @returns The dialog body.
 */
function ResponseTimeForm({
  user,
  isSaving,
  onClose,
  onSave,
}: SellerResponseTimeDialogProps & { user: AdminProfile }) {
  const [value, setValue] = useState<SellerResponseTime | "">(
    user.sellerResponseTime ?? ""
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>Seller response time</DialogTitle>
        <DialogDescription>
          Shown on{" "}
          {user.name?.trim() ? user.name : (user.email ?? "this seller")}
          &apos;s public seller card. Leave unset to hide it.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <label
          htmlFor="seller-response-time"
          className="text-xs font-semibold text-muted-foreground"
        >
          Typical reply time
        </label>
        <select
          id="seller-response-time"
          value={value}
          onChange={(event) => {
            const next = event.target.value;
            setValue(
              SELLER_RESPONSE_TIMES.find((option) => option === next) ?? ""
            );
          }}
          className="border-input bg-background h-11 w-full rounded-md border px-3 text-base md:text-sm"
        >
          <option value="">Not set (hidden)</option>
          {SELLER_RESPONSE_TIMES.map((option) => (
            <option key={option} value={option}>
              {SELLER_RESPONSE_TIME_LABELS[option]}
            </option>
          ))}
        </select>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            onSave(value === "" ? null : value);
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
 * Admin dialog to set (or clear) how quickly a seller usually replies.
 *
 * @param props - Component props.
 * @returns The dialog element.
 */
export function SellerResponseTimeDialog(props: SellerResponseTimeDialogProps) {
  const { user, onClose } = props;
  return (
    <Dialog
      open={user !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        {user && <ResponseTimeForm key={user.userId} {...props} user={user} />}
      </DialogContent>
    </Dialog>
  );
}
