import { useState } from "react";

import { LotSpecsFields } from "@/components/lot-specs/LotSpecsFields";
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
  buildSpecArgs,
  getLotSpecsError,
  type LotSpecValues,
} from "@/lib/lotSpecs";

/** The lot fields {@link LotSpecsDialog} needs. */
export interface LotSpecsTarget extends LotSpecValues {
  _id: string;
  title: string;
}

/** Props for {@link LotSpecsDialog}. */
export interface LotSpecsDialogProps {
  /** The lot being edited; the dialog is closed when null. */
  lot: LotSpecsTarget | null;
  /** Whether a save is in flight. */
  isSaving: boolean;
  /** Called when the dialog is dismissed. */
  onClose: () => void;
  /** Called with the filled-in spec values. */
  onSave: (specs: LotSpecValues) => void;
}

/**
 * Inner form, remounted per lot so its draft starts from the stored specs.
 *
 * @param props - Component props.
 * @param props.lot - The lot being edited.
 * @param props.isSaving - Whether a save is in flight.
 * @param props.onClose - Dismiss handler.
 * @param props.onSave - Save handler.
 * @returns The dialog body.
 */
function SpecsForm({
  lot,
  isSaving,
  onClose,
  onSave,
}: LotSpecsDialogProps & { lot: LotSpecsTarget }) {
  const [values, setValues] = useState<LotSpecValues>({
    powerKw: lot.powerKw,
    drive: lot.drive,
    transmission: lot.transmission,
    frontTyrePct: lot.frontTyrePct,
    rearTyrePct: lot.rearTyrePct,
    serialNumber: lot.serialNumber,
  });
  const payload = buildSpecArgs(values);
  const canSave =
    getLotSpecsError(values) === null && Object.keys(payload).length > 0;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Lot specs</DialogTitle>
        <DialogDescription>
          {lot.title}. Blank fields are left unchanged.
        </DialogDescription>
      </DialogHeader>
      <LotSpecsFields
        idPrefix="admin-lot-spec"
        values={values}
        disabled={isSaving}
        onChange={(patch) => {
          setValues((prev) => ({ ...prev, ...patch }));
        }}
      />
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            onSave(payload);
          }}
          disabled={isSaving || !canSave}
        >
          Save
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Admin dialog to edit a lot's machine specs.
 *
 * @param props - Component props.
 * @returns The dialog element.
 */
export function LotSpecsDialog(props: LotSpecsDialogProps) {
  const { lot, onClose } = props;
  return (
    <Dialog
      open={lot !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        {lot && <SpecsForm key={lot._id} {...props} lot={lot} />}
      </DialogContent>
    </Dialog>
  );
}
