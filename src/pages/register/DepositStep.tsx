import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { Banner } from "@/components/ds/Banner";
import { CopyRow } from "@/components/ds/CopyRow";
import { showToast } from "@/components/ds/showToast";
import { WhatsAppGlyph } from "@/components/ds/WhatsAppButton";
import { LoadingPage } from "@/components/LoadingIndicator";
import { Button } from "@/components/ui/button";
import { useBranding } from "@/hooks/useBranding";
import { useRegisterParams } from "@/hooks/useRegisterParams";
import { formatRand } from "@/lib/currency";
import { whatsappLink } from "@/lib/homeSales";
import { entryStep, stepProgress } from "@/lib/registrationCopy";
import { getErrorMessage } from "@/lib/utils";

import { RegisterLayout } from "./RegisterLayout";

/**
 * Step 4: pay the deposit by EFT. Shows the bank details from the Admin
 * settings (or a notice when they aren't set), the buyer's permanent
 * reference, a WhatsApp link for the proof of payment, "I've paid" and
 * "I'll pay later". Creates the reference on first visit.
 *
 * @returns The deposit step
 */
export default function DepositStep() {
  const registration = useQuery(api.registration.getMyRegistration);
  const bank = useQuery(api.admin.platformSettings.getDepositBankDetails);
  const startDeposit = useMutation(api.registration.startMyDeposit);
  const claimPaid = useMutation(api.registration.claimMyDepositPaid);
  const branding = useBranding();
  const navigate = useNavigate();
  const { callbackUrl, path } = useRegisterParams();
  const [startedReference, setStartedReference] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const started = useRef(false);

  // Only a buyer who finished steps 1 to 3 gets a reference (and only once).
  const canStart =
    registration?.depositSettings.enabled === true &&
    registration.eligibility.kind !== "incomplete" &&
    registration.deposit == null;
  useEffect(() => {
    if (!canStart || started.current) return;
    started.current = true;
    startDeposit({})
      .then((result) => {
        setStartedReference(result.reference);
      })
      .catch((err: unknown) => {
        showToast(
          getErrorMessage(err, "Couldn't create your payment reference."),
          "error"
        );
      });
  }, [canStart, startDeposit]);

  if (!registration || bank === undefined) {
    return <LoadingPage message="Loading deposit..." />;
  }
  const { eligibility, depositSettings, deposit } = registration;
  if (eligibility.kind === "incomplete") {
    return <Navigate to={path(entryStep(registration))} replace />;
  }
  if (
    !depositSettings.enabled ||
    deposit?.status === "received" ||
    deposit?.status === "refund_requested"
  ) {
    return <Navigate to={path("status")} replace />;
  }

  const reference = deposit?.reference ?? startedReference;
  const amount = formatRand(deposit?.amount ?? depositSettings.amount);
  const bankRows = [
    { label: "Bank", value: bank.bank },
    { label: "Account name", value: bank.accountName },
    { label: "Account number", value: bank.accountNumber },
    { label: "Branch code", value: bank.branchCode },
  ];
  const bankReady = bankRows.every((row) => row.value !== null);
  const waBase = whatsappLink(branding?.businessInfo?.whatsapp);
  const waHref =
    waBase && reference
      ? `${waBase}?text=${encodeURIComponent(`Proof of payment ${reference}`)}`
      : waBase;

  const onPaid = async () => {
    setClaiming(true);
    try {
      await claimPaid({});
      await navigate(path("status"));
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't record your payment."), "error");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <RegisterLayout
      callbackUrl={callbackUrl}
      title={`Pay your ${amount} deposit`}
      intro={`Refunded within ${String(depositSettings.refundDays)} working days if you don't buy. If you win, it counts towards payment.`}
      progress={stepProgress("deposit", registration)}
      deposit={depositSettings}
    >
      <section
        aria-labelledby="reg-eft-heading"
        className="mb-4 rounded-md border border-border bg-card px-3.5 pt-3.5 pb-3.5"
      >
        <h2 id="reg-eft-heading" className="mb-2 text-lg font-semibold">
          Pay by EFT
        </h2>
        {bankReady ? (
          bankRows.map((row) => (
            <CopyRow
              key={row.label}
              label={row.label}
              value={row.value ?? ""}
            />
          ))
        ) : (
          <Banner kind="warn" className="mb-2">
            Bank details aren&apos;t set up yet. WhatsApp us and we&apos;ll send
            them.
          </Banner>
        )}
        {reference ? (
          <CopyRow label="Reference. Use exactly" value={reference} highlight />
        ) : (
          <p role="status" className="py-2.5 text-sm text-muted-foreground">
            Creating your reference...
          </p>
        )}
        <p className="mt-2.5 text-sm text-muted-foreground">
          Refunds go back to the account you paid from.
        </p>
      </section>

      {waHref ? (
        <Button asChild variant="outline" className="mb-3 w-full">
          <a href={waHref} target="_blank" rel="noopener noreferrer">
            <WhatsAppGlyph className="size-5" />
            Send proof of payment on WhatsApp
          </a>
        </Button>
      ) : null}
      <Button
        type="button"
        className="w-full"
        disabled={claiming || !reference}
        onClick={() => {
          void onPaid();
        }}
      >
        I&apos;ve paid
      </Button>
      <p className="mt-3 text-center">
        <Link
          to={path("status")}
          className="inline-flex min-h-11 items-center text-[15px] font-semibold text-primary underline"
        >
          I&apos;ll pay later
        </Link>
      </p>
    </RegisterLayout>
  );
}
