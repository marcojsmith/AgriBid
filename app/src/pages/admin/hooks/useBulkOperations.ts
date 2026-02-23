import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";
import type { Doc, Id } from "convex/_generated/dataModel";

/**
 * Manage auction bulk operations including selection state, search term and bulk status updates.
 *
 * Exposes state and handlers for selecting visible auctions, computing selection summary, performing bulk status mutations, and resetting selection.
 *
 * @returns An object with:
 * - `auctionSearch` and `setAuctionSearch` — search string and its setter.
 * - `selectedAuctions` and `setSelectedAuctions` — array of selected auction IDs and its setter.
 * - `handleSelectAll(auctions, checked)` — select or deselect all visible auctions.
 * - `handleToggleSelection(auctionId, selected)` — toggle selection for a single auction ID.
 * - `isBulkProcessing` — boolean flag for in-progress bulk operation.
 * - `bulkStatusTarget` and `setBulkStatusTarget` — pending status for bulk updates and its setter.
 * - `getSelectionState(auctions)` — returns `{ isAllSelected, isPartiallySelected }` for the provided visible auctions.
 * - `handleBulkStatusUpdate()` — performs the bulk status update for selected auctions.
 * - `clearSelection()` — clears selections and resets the bulk status target.
 */
export function useBulkOperations() {
  // Search and filter state
  const [auctionSearch, setAuctionSearch] = useState("");

  // Selection state
  const [selectedAuctions, setSelectedAuctions] = useState<Id<"auctions">[]>(
    []
  );

  // Bulk operation state
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkStatusTarget, setBulkStatusTarget] = useState<
    "active" | "rejected" | "sold" | "unsold" | null
  >(null);

  // Mutation
  const bulkUpdateAuctionsMutation = useMutation(
    api.auctions.bulkUpdateAuctions
  );

  /**
   * Computes selection state based on provided auctions.
   * Returns whether all, some, or no visible auctions are selected.
   */
  const getSelectionState = useCallback(
    (auctions: Doc<"auctions">[] = []) => {
      const selectedSet = new Set(selectedAuctions);
      const visibleSelectedCount = auctions.filter((a) =>
        selectedSet.has(a._id)
      ).length;

      return {
        isAllSelected:
          auctions.length > 0 && visibleSelectedCount === auctions.length,
        isPartiallySelected:
          visibleSelectedCount > 0 && visibleSelectedCount < auctions.length,
      };
    },
    [selectedAuctions]
  );

  /**
   * Toggles select-all checkbox: selects all visible auctions or clears selection.
   * This respects the current visible/filtered auctions, not all auctions.
   */
  const handleSelectAll = (auctions: Doc<"auctions">[], checked: boolean) => {
    if (checked === true) {
      const visibleIds = auctions.map((a) => a._id);
      setSelectedAuctions((prev) =>
        Array.from(new Set([...prev, ...visibleIds]))
      );
    } else {
      const visibleIds = new Set(auctions.map((a) => a._id));
      setSelectedAuctions((prev) => prev.filter((id) => !visibleIds.has(id)));
    }
  };

  /**
   * Toggles individual auction selection
   */
  const handleToggleSelection = (
    auctionId: Id<"auctions">,
    selected: boolean
  ) => {
    setSelectedAuctions((prev) =>
      selected === true
        ? prev.includes(auctionId)
          ? prev
          : [...prev, auctionId]
        : prev.filter((id) => id !== auctionId)
    );
  };

  /**
   * Performs bulk status update on all selected auctions.
   * Validates that a target status is set before executing.
   * Clears selection and target status on success.
   */
  const handleBulkStatusUpdate = async () => {
    if (selectedAuctions.length === 0 || !bulkStatusTarget) return;
    setIsBulkProcessing(true);
    try {
      await bulkUpdateAuctionsMutation({
        auctionIds: selectedAuctions,
        updates: { status: bulkStatusTarget },
      });
      toast.success(
        `Updated ${selectedAuctions.length} auctions to ${bulkStatusTarget}`
      );
      setSelectedAuctions([]);
      setBulkStatusTarget(null);
    } catch (err) {
      console.error("Bulk update failed:", err);
      toast.error(err instanceof Error ? err.message : "Bulk update failed");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  /**
   * Clears all selections and resets bulk operation state
   */
  const clearSelection = () => {
    setSelectedAuctions([]);
    setBulkStatusTarget(null);
  };

  return {
    // Search state
    auctionSearch,
    setAuctionSearch,

    // Selection state
    selectedAuctions,
    setSelectedAuctions,
    handleSelectAll,
    handleToggleSelection,

    // Bulk operation state
    isBulkProcessing,
    bulkStatusTarget,
    setBulkStatusTarget,

    // Selection state calculator
    getSelectionState,

    // Handlers
    handleBulkStatusUpdate,
    clearSelection,
  };
}
