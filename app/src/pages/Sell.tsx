// app/src/pages/Sell.tsx
import { Authenticated, Unauthenticated } from "convex/react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { ListingWizard } from "../components/ListingWizard";

/**
 * Page component that renders the "List Your Equipment" flow for authenticated users and an authentication prompt for unauthenticated users.
 *
 * @returns The JSX element for the Sell page, including the ListingWizard for authenticated users, and a login prompt for unauthenticated users.
 */
export default function Sell() {
  return (
    <>
      <Authenticated>
        <main className="container mx-auto p-8 max-w-4xl">
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-primary uppercase">List Your Equipment</h1>
              <p className="text-muted-foreground mt-2">Complete the steps below to put your machinery in front of thousands of verified buyers.</p>
            </div>

            {/* Listing Wizard */}
            <ListingWizard />
          </div>
        </main>
      </Authenticated>

      <Unauthenticated>
        <div className="flex flex-col items-center justify-center h-[80vh] space-y-6 px-4 text-center">
          <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Authentication Required</h1>
          <p className="text-muted-foreground max-w-sm">Please sign in or create an account to list your equipment on AgriBid.</p>
          <Button asChild className="px-8 font-bold">
            <Link to="/">Go to Login</Link>
          </Button>
        </div>
      </Unauthenticated>
    </>
  );
}
