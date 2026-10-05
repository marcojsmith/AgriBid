import type { Id } from "convex/_generated/dataModel";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { FeeRow } from "./FeeRow";
import type { PlatformFee } from "./types";

/**
 * Props for the {@link FeeTable} component.
 */
interface FeeTableProps {
  fees: PlatformFee[];
  reorderingIndex: number | null;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onEdit: (fee: PlatformFee) => void;
  onDelete: (feeId: Id<"platformFees">) => void;
}

/**
 * Table of platform fee rules with ordering, edit and delete controls, plus an
 * empty state when no fees exist yet.
 *
 * @param props - Component props.
 * @param props.fees - Fees in display order.
 * @param props.reorderingIndex - Index currently being reordered, or `null`.
 * @param props.onMoveUp - Handler called with a row index to move a fee up.
 * @param props.onMoveDown - Handler called with a row index to move a fee down.
 * @param props.onEdit - Handler called with a fee to open the edit dialog.
 * @param props.onDelete - Handler called with a fee id to open the delete dialog.
 * @returns The fee rules table or its empty state.
 */
export function FeeTable({
  fees,
  reorderingIndex,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
}: FeeTableProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Order</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Applies To</TableHead>
              <TableHead>Visible</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fees.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  No fees configured. Click &quot;Add Fee&quot; to create one.
                </TableCell>
              </TableRow>
            ) : (
              fees.map((fee, index) => (
                <FeeRow
                  key={fee._id}
                  fee={fee}
                  index={index}
                  isFirst={index === 0}
                  isLast={index === fees.length - 1}
                  isReordering={reorderingIndex !== null}
                  onMoveUp={onMoveUp}
                  onMoveDown={onMoveDown}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
