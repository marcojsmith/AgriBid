import { useContext } from "react";

import { ListingWizardContext } from "@/components/listing-wizard/context/ListingWizardContextDef";

/**
 * Custom hook to consume the ListingWizardContext.
 *
 * @returns The ListingWizard context value
 * @throws Error if used outside of a ListingWizardProvider
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
