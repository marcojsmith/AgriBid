import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import { Banner } from "@/components/ds/Banner";
import { RegStatusList } from "@/components/ds/RegStatusList";
import { buildStatusBanners, buildStatusRows } from "@/lib/registrationCopy";

import { AlertsSummary } from "./AlertsSummary";

/**
 * The desktop side column of My bids: where the buyer stands on registration
 * (the same rows and banner as the registration status page) and their alerts.
 * Phones show the banner at the top of the page instead, so this is hidden
 * below `lg`.
 *
 * @returns The side column
 */
export function RegistrationRail() {
  const registration = useQuery(api.registration.getMyRegistration);
  const banner = registration ? buildStatusBanners(registration).at(0) : null;
  return (
    <aside
      aria-label="Your registration and alerts"
      className="hidden space-y-4 lg:block"
    >
      {registration ? (
        <section className="rounded-md border border-border p-4">
          <h2 className="font-display text-lg font-semibold">
            Your registration
          </h2>
          {banner ? (
            <Banner kind={banner.kind} className="mt-3">
              {banner.text}
            </Banner>
          ) : null}
          <RegStatusList
            rows={buildStatusRows(registration).map((row) => ({
              key: row.key,
              title: row.title,
              sub: row.sub,
              tone: row.tone,
            }))}
            className="mt-2"
          />
          <Link
            to="/register/status"
            className="inline-flex min-h-11 items-center gap-1 text-[15px] font-semibold"
          >
            Registration
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        </section>
      ) : null}
      <section className="rounded-md border border-border p-4">
        <h2 className="mb-2 font-display text-lg font-semibold">Alerts</h2>
        <AlertsSummary />
      </section>
    </aside>
  );
}
