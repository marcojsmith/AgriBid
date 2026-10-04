import { Plus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { DeleteFeeDialog } from "./fee-manager/DeleteFeeDialog";
import { FeeFormDialog } from "./fee-manager/FeeFormDialog";
import { FeeTable } from "./fee-manager/FeeTable";
import { useFeeManager } from "./fee-manager/useFeeManager";

/**
 * Admin interface for managing platform fees.
 * Allows creating, editing, deleting, and reordering platform fee rules.
 * @returns The FeeManager React component.
 */
export function FeeManager() {
  const {
    fees,
    isLoading,
    isFormOpen,
    isDeleteDialogOpen,
    editingFeeId,
    formData,
    setFormData,
    isSubmitting,
    reorderingIndex,
    openCreate,
    openEdit,
    openDelete,
    onFormOpenChange,
    onDeleteDialogOpenChange,
    submit,
    confirmDelete,
    moveUp,
    moveDown,
  } = useFeeManager();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Fee Rules</h2>
          <p className="text-sm text-muted-foreground">
            Configure fees that will be applied at auction settlement
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Fee
        </Button>
      </div>

      <FeeTable
        fees={fees}
        reorderingIndex={reorderingIndex}
        onMoveUp={moveUp}
        onMoveDown={moveDown}
        onEdit={openEdit}
        onDelete={openDelete}
      />

      <FeeFormDialog
        isOpen={isFormOpen}
        isEditing={editingFeeId !== null}
        formData={formData}
        setFormData={setFormData}
        isSubmitting={isSubmitting}
        onOpenChange={onFormOpenChange}
        onSubmit={submit}
      />

      <DeleteFeeDialog
        isOpen={isDeleteDialogOpen}
        isSubmitting={isSubmitting}
        onOpenChange={onDeleteDialogOpenChange}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
