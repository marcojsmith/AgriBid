import { useContext } from "react";
import {
  ListingWizardContext,
  type ListingWizardContextType,
} from "../context/ListingWizardContext";

/**
 * Hook to access the ListingWizard context.
 * Must be used within a ListingWizardProvider.
 *
 * @returns The ListingWizard context object containing formData, state, and setters
 * @throws Error if used outside of a ListingWizardProvider
 */
export const useListingWizard = (): ListingWizardContextType => {
  const context = useContext(ListingWizardContext);
  if (context === undefined) {
    throw new Error(
      "useListingWizard must be used within a ListingWizardProvider"
    );
  }
  return context;
};
