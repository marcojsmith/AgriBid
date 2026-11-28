import { useState, type ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { CheckCircle2, Clock } from "lucide-react";

import { SubPage } from "@/components/account/AccountLayout";
import { showToast } from "@/components/ds/showToast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDepositCredit } from "@/hooks/useDepositCredit";
import {
  ACCOUNT_PATH,
  canAskRefund,
  creditedLotLabel,
  depositDated,
  depositView,
  refundWithin,
} from "@/lib/account";
import { formatRand } from "@/lib/currency";
import { formatSastDate } from "@/lib/dates";
import { registerPath } from "@/lib/registrationCopy";
import { buildTitle } from "@/lib/seo";
import { getErrorMessage } from "@/lib/utils";

/**
 * The state pill at the top of the deposit page.
 *
 * @param props - Component props
 * @param props.tone - ok (green, tick) or wait (outlined, clock)
 * @param props.children - The label
 * @returns The pill
 */
function Pill({
  tone,
  children,
}: {
  tone: "ok" | "wait";
  children: ReactNode;
}) {
  const Icon = tone === "ok" ? CheckCircle2 : Clock;
  return (
    <span
      className={
        tone === "ok"
          ? "inline-flex items-center gap-1.5 rounded-sm bg-ok-soft px-2.5 py-1 text-[15px] font-semibold text-ok-fg"
          : "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[15px] font-semibold text-muted-foreground ring-1 ring-border ring-inset"
      }
    >
      <Icon aria-hidden="true" className="size-4" />
      {children}
    </span>
  );
}

/**
 * The deposit page: where the deposit stands, which lot it was credited to,
 * and the refund request. "Ask for refund" shows only when allowed (received,
 * something left to refund, no unpaid lot); the server's message is shown when
 * it still says no (for example while the buyer leads an open lot).
 *
 * @returns The page
 */
export default function DepositPage() {
  const registration = useQuery(api.registration.getMyRegistration);
  const summary = useQuery(api.lotPayments.getMyPaymentSummary);
  const credit = useDepositCredit(registration?.deposit?.status === "received");
  const requestRefund = useMutation(api.registration.requestDepositRefund);
  const cancelRefund = useMutation(api.registration.cancelDepositRefundRequest);
  const [busy, setBusy] = useState(false);

  const head = (
    <Helmet>
      <title>{buildTitle("Deposit")}</title>
      <meta name="robots" content="noindex" />
    </Helmet>
  );

  if (registration === undefined || summary === undefined) {
    return (
      <SubPage title="Deposit">
        {head}
        <div role="status" aria-label="Loading deposit" className="space-y-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-12 w-full" />
        </div>
      </SubPage>
    );
  }
  if (registration === null) {
    return (
      <SubPage title="Deposit">
        {head}
        <p className="text-base">Finish registering to see your deposit.</p>
      </SubPage>
    );
  }

  const view = depositView(registration, credit?.lot);
  const refundDays = registration.depositSettings.refundDays;
  const payLink = registerPath("deposit", { callbackUrl: ACCOUNT_PATH });

  const run = async (
    action: () => Promise<unknown>,
    done: string,
    fallback: string
  ) => {
    setBusy(true);
    try {
      await action();
      showToast(done);
    } catch (err) {
      showToast(getErrorMessage(err, fallback), "error");
    } finally {
      setBusy(false);
    }
  };

  let body: ReactNode;
  switch (view.kind) {
    case "off":
      body = <p className="text-base">No deposit is needed right now.</p>;
      break;
    case "not_started":
    case "awaiting":
    case "checking":
      body = (
        <>
          <p className="text-base">
            {view.kind === "checking"
              ? `We're checking your ${formatRand(view.amount)} payment.`
              : `Pay ${formatRand(view.amount)} to bid. ${refundWithin(refundDays)}`}
          </p>
          <Button asChild className="w-full">
            <Link to={payLink}>
              {view.kind === "checking" ? "See payment details" : "Pay deposit"}
            </Link>
          </Button>
        </>
      );
      break;
    case "received": {
      const canAsk = canAskRefund(
        view,
        registration.deposit?.refundableAmount ?? 0,
        summary.unpaidCount
      );
      body = (
        <>
          <Pill tone="ok">Received</Pill>
          <p className="text-base">
            {depositDated("received", view.amount, view.receivedAt)}
          </p>
          {credit ? (
            <p className="text-base">
              Credited to {creditedLotLabel(credit.lot)}. It counts towards your
              payment of {formatRand(credit.amountDue)}.
            </p>
          ) : null}
          {canAsk ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={() => {
                  void run(
                    () => requestRefund({}),
                    "Refund requested",
                    "Couldn't ask for your refund."
                  );
                }}
              >
                Ask for refund
              </Button>
              <p className="text-base text-muted-foreground">
                Only when you have no unpaid lots. {refundWithin(refundDays)}{" "}
                Refunds go back to the account you paid from.
              </p>
            </>
          ) : (
            <p className="text-base text-muted-foreground">
              {summary.unpaidCount > 0
                ? "You can ask for a refund only when you have no unpaid lots."
                : "There is nothing left to refund."}
            </p>
          )}
        </>
      );
      break;
    }
    case "refund_requested":
      body = (
        <>
          <Pill tone="wait">Refund requested</Pill>
          {view.requestedAt === undefined ? null : (
            <p className="text-base">
              Requested {formatSastDate(view.requestedAt)}
            </p>
          )}
          <p className="text-base text-muted-foreground">
            We refund within {refundDays} working{" "}
            {refundDays === 1 ? "day" : "days"} to the account you paid from. To
            bid again you pay the deposit again.
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => {
              void run(
                () => cancelRefund({}),
                "Request cancelled",
                "Couldn't cancel your request."
              );
            }}
          >
            Cancel request
          </Button>
        </>
      );
      break;
    case "refunded":
      body = (
        <>
          <Pill tone="ok">Refunded</Pill>
          <p className="text-base">
            {depositDated("refunded", view.amount, view.refundedAt)}
          </p>
          <Button asChild className="w-full">
            <Link to={payLink}>Pay deposit</Link>
          </Button>
          <p className="text-base text-muted-foreground">
            Refunded to the account you paid from. Pay the deposit to bid again.
          </p>
        </>
      );
      break;
  }

  return (
    <SubPage title="Deposit">
      {head}
      {body}
    </SubPage>
  );
}
