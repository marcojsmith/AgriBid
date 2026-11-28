import { Link } from "react-router-dom";
import type { BidEligibility } from "convex/lib/bidEligibility";

import { Banner } from "@/components/ds/Banner";
import { Button } from "@/components/ui/button";
import { registrationBanner } from "@/lib/myBids";

interface RegistrationBannerProps {
  eligibility: BidEligibility;
}

/**
 * The banner at the top of My bids while the buyer cannot bid yet, with its
 * action: continue registration, see the registration, replace a document,
 * pay the deposit or manage a refund request. Renders nothing when the buyer
 * can bid.
 *
 * @param props - Component props
 * @param props.eligibility - Where the buyer stands
 * @returns The banner and button, or nothing
 */
export function RegistrationBanner({ eligibility }: RegistrationBannerProps) {
  const model = registrationBanner(eligibility);
  if (!model) return null;
  return (
    <section aria-label="Registration" className="space-y-3">
      <Banner kind={model.kind}>{model.text}</Banner>
      <Button asChild variant={model.variant} className="w-full lg:w-auto">
        <Link to={model.to}>{model.label}</Link>
      </Button>
    </section>
  );
}
