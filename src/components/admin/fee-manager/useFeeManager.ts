import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";

import {
  sortFeesBySortOrder,
  toFeeMutationArgs,
  validateFeeForm,
} from "./feeHelpers";
import {
  defaultFeeFormData,
  type FeeFormData,
  type PlatformFee,
} from "./types";

/**
 * State and handlers backing the platform fee manager: the create/edit form,
 * the delete confirmation, and drag-free reordering of the fee list.
 *
 * @returns An object with:
 * - `fees` — fees in display order (empty until the query resolves).
 * - `isLoading` — true while the fee query is still in flight.
 * - `isFormOpen`, `isDeleteDialogOpen` — dialog visibility.
 * - `editingFeeId`, `deletingFeeId` — fee being edited or deleted, `null` when none.
 * - `formData`, `setFormData` — create/edit form values and their setter.
 * - `isSubmitting`, `reorderingIndex` — in-flight mutation state.
 * - `openCreate`, `openEdit`, `openDelete` — handlers that open a dialog for a new, existing or deletable fee.
 * - `onFormOpenChange`, `onDeleteDialogOpenChange` — visibility setters for the two dialogs.
 * - `submit`, `confirmDelete`, `moveUp`, `moveDown` — mutation handlers.
 */
export function useFeeManager() {
  const fees = useQuery(api.admin.getPlatformFees);
  const createFee = useMutation(api.admin.createPlatformFee);
  const updateFee = useMutation(api.admin.updatePlatformFee);
  const deleteFee = useMutation(api.admin.deletePlatformFee);
  const reorderFees = useMutation(api.admin.reorderPlatformFees);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingFeeId, setEditingFeeId] = useState<Id<"platformFees"> | null>(
    null
  );
  const [deletingFeeId, setDeletingFeeId] = useState<Id<"platformFees"> | null>(
    null
  );
  const [formData, setFormData] = useState<FeeFormData>(defaultFeeFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reorderingIndex, setReorderingIndex] = useState<number | null>(null);

  const sortedFees = useMemo(
    () => sortFeesBySortOrder(fees?.allFees ?? []),
    [fees]
  );

  const openCreate = useCallback(() => {
    setEditingFeeId(null);
    setFormData(defaultFeeFormData);
    setIsFormOpen(true);
  }, []);

  const openEdit = useCallback((fee: PlatformFee) => {
    setEditingFeeId(fee._id);
    setFormData({
      name: fee.name,
      description: fee.description ?? "",
      feeType: fee.feeType,
      value: fee.feeType === "percentage" ? fee.value * 100 : fee.value,
      appliesTo: fee.appliesTo,
      isActive: fee.isActive,
      visibleToBuyer: fee.visibleToBuyer,
      visibleToSeller: fee.visibleToSeller,
    });
    setIsFormOpen(true);
  }, []);

  const openDelete = useCallback((feeId: Id<"platformFees">) => {
    setDeletingFeeId(feeId);
    setIsDeleteDialogOpen(true);
  }, []);

  const submit = useCallback(async () => {
    const validationError = validateFeeForm(formData);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const args = toFeeMutationArgs(formData);
    setIsSubmitting(true);
    try {
      if (editingFeeId) {
        await updateFee({ feeId: editingFeeId, ...args });
        toast.success("Fee updated successfully");
      } else {
        await createFee(args);
        toast.success("Fee created successfully");
      }
      setIsFormOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save fee"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [createFee, editingFeeId, formData, updateFee]);

  const confirmDelete = useCallback(async () => {
    if (!deletingFeeId) return;

    setIsSubmitting(true);
    try {
      await deleteFee({ feeId: deletingFeeId });
      toast.success("Fee deleted successfully");
      setIsDeleteDialogOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete fee"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [deleteFee, deletingFeeId]);

  /**
   * Moves the fee at `index` one position towards the start of the list.
   *
   * @param index - Current position of the fee in the sorted list.
   */
  const moveUp = useCallback(
    async (index: number) => {
      if (index === 0 || reorderingIndex !== null) return;
      const newOrder = [...sortedFees];
      const [movedFee] = newOrder.splice(index, 1);
      newOrder.splice(index - 1, 0, movedFee);
      try {
        setReorderingIndex(index);
        await reorderFees({
          feeIds: newOrder.map((f) => f._id),
        });
        toast.success("Fee order updated successfully");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to reorder fees"
        );
      } finally {
        setReorderingIndex(null);
      }
    },
    [reorderFees, reorderingIndex, sortedFees]
  );

  /**
   * Moves the fee at `index` one position towards the end of the list.
   *
   * @param index - Current position of the fee in the sorted list.
   */
  const moveDown = useCallback(
    async (index: number) => {
      if (index === sortedFees.length - 1 || reorderingIndex !== null) return;
      const newOrder = [...sortedFees];
      const [movedFee] = newOrder.splice(index, 1);
      newOrder.splice(index + 1, 0, movedFee);
      try {
        setReorderingIndex(index);
        await reorderFees({
          feeIds: newOrder.map((f) => f._id),
        });
        toast.success("Fee order updated successfully");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to reorder fees"
        );
      } finally {
        setReorderingIndex(null);
      }
    },
    [reorderFees, reorderingIndex, sortedFees]
  );

  return {
    fees: sortedFees,
    isLoading: fees === undefined,
    isFormOpen,
    isDeleteDialogOpen,
    editingFeeId,
    deletingFeeId,
    formData,
    setFormData,
    isSubmitting,
    reorderingIndex,
    openCreate,
    openEdit,
    openDelete,
    onFormOpenChange: setIsFormOpen,
    onDeleteDialogOpenChange: setIsDeleteDialogOpen,
    submit,
    confirmDelete,
    moveUp,
    moveDown,
  };
}
