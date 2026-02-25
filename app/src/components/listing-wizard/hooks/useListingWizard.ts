import { useContext } from "react";
import { ListingWizardContext } from "../context/ListingWizardContext";

/**
 * Hook to access the ListingWizard context.
 * Must be used within a ListingWizardProvider.
 */
export const useListingWizard = () => {
  const context = useContext(ListingWizardContext);
  if (context === undefined) {
    throw new Error(
      "useListingWizard must be used within a ListingWizardProvider"
    );
  }
  return context;
};
