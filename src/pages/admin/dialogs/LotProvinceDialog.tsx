import { useState } from "react";

import { ProvinceSelect } from "@/components/ProvinceSelect";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Province } from "@/lib/provinces";

/** The lot fields {@link LotProvinceDialog} needs. */
export interface LotProvinceTarget {
  _id: string;
  title: string;
  province?: Province;
}

/** Props for {@link LotProvinceDialog}. */
export interface LotProvinceDialogProps {
  /** The lot being edited; the dialog is closed when null. */
  lot: LotProvinceTarget | null;
  /** Whether a save is in flight. */
  isSaving: boolean;
  /** Called when the dialog is dismissed. */
  onClose: () => void;
  /** Called with the chosen province. */
  onSave: (province: Province) => void;
  /** Called to remove the lot's province. */
  onClear: () => void;
}

/**
 * Inner form, remounted per lot so its draft starts from the stored province.
 *
 * @param props - Component props.
 * @param props.lot - The lot being edited.
 * @param props.isSaving - Whether a save is in flight.
 * @param props.onClose - Dismiss handler.
 * @param props.onSave - Save handler.
 * @param props.onClear - Handler that removes the stored province.
 * @returns The dialog body.
 */
function ProvinceForm({
  lot,
  isSaving,
  onClose,
  onSave,
  onClear,
}: LotProvinceDialogProps & { lot: LotProvinceTarget }) {
  const [province, setProvince] = useState<Province | undefined>(lot.province);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Lot province</DialogTitle>
        <DialogDescription>{lot.title}</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <label
          htmlFor="lot-province"
          className="text-xs font-semibold text-muted-foreground"
        >
          Province
        </label>
        <ProvinceSelect
          id="lot-province"
          value={province}
          onChange={setProvince}
          className="h-11"
        />
      </div>
      <DialogFooter>
        {lot.province && (
          <Button
            variant="ghost"
            className="text-destructive sm:mr-auto"
            onClick={onClear}
            disabled={isSaving}
          >
            Clear province
          </Button>
        )}
        <Button variant="outline" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            if (province) onSave(province);
          }}
          disabled={isSaving || province === undefined}
        >
          Save
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Admin dialog to change a lot's province.
 *
 * @param props - Component props.
 * @returns The dialog element.
 */
export function LotProvinceDialog(props: LotProvinceDialogProps) {
  const { lot, onClose } = props;
  return (
    <Dialog
      open={lot !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        {lot && <ProvinceForm key={lot._id} {...props} lot={lot} />}
      </DialogContent>
    </Dialog>
  );
}
