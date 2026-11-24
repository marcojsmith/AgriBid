import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Link, Navigate } from "react-router-dom";

import { Banner } from "@/components/ds/Banner";
import { RegStatusList } from "@/components/ds/RegStatusList";
import { WhyBox } from "@/components/ds/WhyBox";
import { LoadingPage } from "@/components/LoadingIndicator";
import { Button } from "@/components/ui/button";
import { useCallbackLot } from "@/hooks/useCallbackLot";
import { useRegisterParams } from "@/hooks/useRegisterParams";
import {
  buildStatusBanners,
  buildStatusRows,
  entryStep,
  rejectedDocuments,
  statusFootnote,
} from "@/lib/registrationCopy";

import { RegisterLayout } from "./RegisterLayout";

/**
 * "Your registration": one page for every state after the documents are sent.
 * Rows for details, ID or passport, proof of address and (when on) the
 * deposit; a banner for what it means; the reviewer's reason for each rejected
 * document; and the way back to the lot (or a bid button once approved).
 *
 * @returns The status page
 */
export default function RegistrationStatus() {
  const registration = useQuery(api.registration.getMyRegistration);
  const { callbackUrl, path } = useRegisterParams();
  const callback = useCallbackLot(callbackUrl);

  if (!registration) return <LoadingPage message="Loading registration..." />;
  if (registration.eligibility.kind === "incomplete") {
    return <Navigate to={path(entryStep(registration))} replace />;
  }

  const rows = buildStatusRows(registration).map(({ action, ...row }) => ({
    ...row,
    action: action ? (
      action.replace ? (
        <Button asChild size="sm" className="min-h-11 no-underline">
          <Link to={path(action.step, { replace: true })}>{action.label}</Link>
        </Button>
      ) : (
        <Link to={path(action.step)}>{action.label}</Link>
      )
    ) : undefined,
  }));
  const banners = buildStatusBanners(registration);
  const footnote = statusFootnote(registration);
  const rejected = rejectedDocuments(registration);
  const canBid = registration.eligibility.kind === "ok";
  const lotName =
    callback?.lot?.lotNumber === undefined
      ? "lot"
      : `Lot ${String(callback.lot.lotNumber)}`;

  return (
    <RegisterLayout
      callbackUrl={callbackUrl}
      title="Your registration"
      deposit={
        registration.depositSettings.enabled
          ? registration.depositSettings
          : undefined
      }
    >
      {banners.map((banner) => (
        <Banner key={banner.text} kind={banner.kind} className="mb-4">
          {banner.text}
        </Banner>
      ))}
      <RegStatusList rows={rows} />
      {rejected.map((doc) =>
        doc.reviewedAt === undefined ? null : (
          <WhyBox
            key={doc.kind}
            reason={
              rejected.length > 1 ? `${doc.title}: ${doc.reason}` : doc.reason
            }
            checkedAt={doc.reviewedAt}
          />
        )
      )}
      {footnote ? (
        <p className="mb-4 text-center text-base text-muted-foreground">
          {footnote}
        </p>
      ) : null}
      {callback ? (
        canBid ? (
          <Button asChild className="w-full">
            <Link to={callback.href}>{`Bid on ${lotName}`}</Link>
          </Button>
        ) : (
          <Button asChild variant="outline" className="w-full">
            <Link to={callback.href}>{`Back to ${lotName}`}</Link>
          </Button>
        )
      ) : (
        <Button
          asChild
          variant={canBid ? "default" : "outline"}
          className="w-full"
        >
          <Link to="/">See auctions</Link>
        </Button>
      )}
    </RegisterLayout>
  );
}
