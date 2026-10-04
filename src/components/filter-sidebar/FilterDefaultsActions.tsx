import { Button } from "@/components/ui/button";

/**
 * Props for the {@link FilterDefaultsActions} component.
 */
interface FilterDefaultsActionsProps {
  /**
   * "save" or "clear" while a defaults mutation is in flight.
   */
  pendingAction: "save" | "clear" | null;
  /**
   * Saves the current filters as the user's defaults.
   */
  onSaveDefaults: () => void;
  /**
   * Clears the user's saved defaults.
   */
  onClearDefaults: () => void;
}

/**
 * Footer actions for saving or clearing the signed-in user's default filters.
 *
 * @param props - Component props.
 * @param props.pendingAction - Which mutation, if any, is in flight.
 * @param props.onSaveDefaults - Saves the current filters as defaults.
 * @param props.onClearDefaults - Clears the saved defaults.
 * @returns The defaults action buttons.
 */
export function FilterDefaultsActions({
  pendingAction,
  onSaveDefaults,
  onClearDefaults,
}: FilterDefaultsActionsProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={onSaveDefaults}
        disabled={pendingAction !== null}
        className="h-8 px-2 font-medium text-xs"
      >
        {pendingAction === "save" ? "Saving..." : "Save Defaults"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearDefaults}
        disabled={pendingAction !== null}
        className="h-8 px-2 font-medium text-xs"
      >
        {pendingAction === "clear" ? "Clearing..." : "Clear Defaults"}
      </Button>
    </div>
  );
}
