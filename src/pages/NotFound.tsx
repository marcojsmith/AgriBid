import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Home, Gavel } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildTitle } from "@/lib/seo";

/**
 * 404 Not Found page.
 * Displays a clear message and navigation options for users who reach an unknown route.
 *
 * @returns The NotFound page component.
 */
export default function NotFound() {
  return (
    <>
      <Helmet>
        <title>{buildTitle("Page Not Found")}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-12 text-center">
        <h1 className="text-6xl font-bold tracking-tight text-primary mb-4">
          404
        </h1>
        <p className="text-xl font-semibold text-foreground mb-2">
          Page Not Found
        </p>
        <p className="text-sm text-muted-foreground mb-8 max-w-md">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            asChild
            className="font-semibold rounded-md"
          >
            <Link to="/">
              <Home className="h-4 w-4 mr-2" />
              Go Home
            </Link>
          </Button>
          <Button
            variant="outline"
            asChild
            className="font-medium rounded-md"
          >
            <Link to="/auctions">
              <Gavel className="h-4 w-4 mr-2" />
              Browse Auctions
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}
