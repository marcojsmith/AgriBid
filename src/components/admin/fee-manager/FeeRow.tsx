import { memo } from "react";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import type { Id } from "convex/_generated/dataModel";

import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";

import { formatFeeValue } from "./feeHelpers";
import type { PlatformFee } from "./types";

/**
 * Props for the {@link FeeRow} component.
 */
interface FeeRowProps {
  fee: PlatformFee;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isReordering: boolean;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onEdit: (fee: PlatformFee) => void;
  onDelete: (feeId: Id<"platformFees">) => void;
}

/**
 * One platform fee rendered as a table row, with reorder, edit and delete
 * controls. Memoized so typing in the create/edit dialog does not re-render
 * the whole table.
 *
 * @param props - Component props.
 * @param props.fee - The fee rule this row displays.
 * @param props.index - Position of the fee in the sorted list.
 * @param props.isFirst - True when the fee is first, disabling "move up".
 * @param props.isLast - True when the fee is last, disabling "move down".
 * @param props.isReordering - True while a reorder mutation is in flight.
 * @param props.onMoveUp - Handler called with the row index to move the fee up.
 * @param props.onMoveDown - Handler called with the row index to move the fee down.
 * @param props.onEdit - Handler called with the fee to open the edit dialog.
 * @param props.onDelete - Handler called with the fee id to open the delete dialog.
 * @returns The fee table row.
 */
function FeeRowComponent({
  fee,
  index,
  isFirst,
  isLast,
  isReordering,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
}: FeeRowProps) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => {
              onMoveUp(index);
            }}
            disabled={isFirst || isReordering}
            aria-label={`Move ${fee.name} up`}
          >
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => {
              onMoveDown(index);
            }}
            disabled={isLast || isReordering}
            aria-label={`Move ${fee.name} down`}
          >
            <ArrowDown className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>
      <TableCell className="font-medium">{fee.name}</TableCell>
      <TableCell>
        <span className="capitalize">{fee.feeType}</span>
      </TableCell>
      <TableCell>{formatFeeValue(fee)}</TableCell>
      <TableCell>
        <span className="capitalize">{fee.appliesTo}</span>
      </TableCell>
      <TableCell>
        <div className="flex gap-2 text-xs text-muted-foreground">
          {fee.visibleToBuyer && <span>Buyer</span>}
          {fee.visibleToBuyer && fee.visibleToSeller && <span>|</span>}
          {fee.visibleToSeller && <span>Seller</span>}
          {!fee.visibleToBuyer && !fee.visibleToSeller && <span>Hidden</span>}
        </div>
      </TableCell>
      <TableCell>
        <span
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            fee.isActive
              ? "bg-success/10 text-success"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {fee.isActive ? "Active" : "Inactive"}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onEdit(fee);
            }}
            aria-label={`Edit fee ${fee.name}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onDelete(fee._id);
            }}
            aria-label={`Delete fee ${fee.name}`}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export const FeeRow = memo(FeeRowComponent);
