// app/src/pages/Sell.tsx
import { ListingWizard } from "../components/ListingWizard";

/**
 * Render the Sell page: show the listing wizard for all users.
 * The wizard handles interception/redirection for unauthenticated users at the point of submission.
 *
 * @returns The page's JSX element displaying the ListingWizard.
 */
export default function Sell() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-black tracking-tight text-primary uppercase">List Your Equipment</h1>
        <p className="text-muted-foreground mt-2">Complete the steps below to put your machinery in front of thousands of verified buyers.</p>
      </div>

      {/* Listing Wizard */}
      <ListingWizard />
    </div>
  );
}