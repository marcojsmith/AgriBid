import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";

import { Banner } from "@/components/ds/Banner";
import { BottomSheet } from "@/components/ds/BottomSheet";
import { CopyRow } from "@/components/ds/CopyRow";
import { showToast } from "@/components/ds/showToast";
import { WhatsAppGlyph } from "@/components/ds/WhatsAppButton";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBranding } from "@/hooks/useBranding";
import { formatRand } from "@/lib/currency";
import { formatSastDate } from "@/lib/dates";
import { whatsappLink } from "@/lib/homeSales";
import { getErrorMessage } from "@/lib/utils";

import type { WonLotRow } from "./types";

interface PaySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A claimed payment: show the details only, no "I've paid". */
  claimed?: boolean;
  row: Pick<
    WonLotRow,
    "lotId" | "reference" | "amountDue" | "payBy" | "depositCredit"
  >;
}

/**
 * The bank rows and the lot's own payment reference, read only while the sheet
 * is open. Bank details come from the Admin settings; when any is unset a
 * notice replaces the rows (the same words as the deposit step).
 *
 * @param props - Component props
 * @param props.reference - The payment's reference (not the deposit's)
 * @returns The rows, a skeleton while loading
 */
function PayDetails({ reference }: { reference: string }) {
  const bank = useQuery(api.admin.platformSettings.getDepositBankDetails);
  const branding = useBranding();
  if (bank === undefined) {
    return <Skeleton className="mt-3 h-64 w-full rounded-md" />;
  }
  const bankRows = [
    { label: "Bank", value: bank.bank },
    { label: "Account name", value: bank.accountName },
    { label: "Account number", value: bank.accountNumber },
    { label: "Branch code", value: bank.branchCode },
  ];
  const bankReady = bankRows.every((row) => row.value !== null);
  const waBase = whatsappLink(branding?.businessInfo?.whatsapp);
  const waHref = waBase
    ? `${waBase}?text=${encodeURIComponent(`Proof of payment ${reference}`)}`
    : undefined;
  return (
    <>
      <div className="mt-3">
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
        <CopyRow label="Reference. Use exactly" value={reference} highlight />
      </div>
      {waHref ? (
        <Button asChild variant="outline" className="mt-4 w-full">
          <a href={waHref} target="_blank" rel="noopener noreferrer">
            <WhatsAppGlyph className="size-5" />
            Send proof of payment on WhatsApp
          </a>
        </Button>
      ) : null}
    </>
  );
}

/**
 * The EFT sheet for one won lot: what to pay and by when, the bank details,
 * the lot's own reference, a WhatsApp link for the proof of payment and
 * "I've paid". The deposit is already counted in `amountDue`.
 *
 * @param props - Component props
 * @param props.open - Whether the sheet is open
 * @param props.onOpenChange - Called when the sheet asks to close
 * @param props.row - The payment to settle
 * @param props.claimed - The payment was already claimed: no "I've paid"
 * @returns The sheet
 */
export function PaySheet({
  open,
  onOpenChange,
  row,
  claimed = false,
}: PaySheetProps) {
  const claim = useMutation(api.lotPayments.claimLotPaid);
  const [busy, setBusy] = useState(false);

  const onPaid = async () => {
    setBusy(true);
    try {
      await claim({ lotId: row.lotId });
      showToast("Thanks. We'll confirm when we receive it.");
      onOpenChange(false);
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't record your payment."), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Pay ${formatRand(row.amountDue)}`}
      actions={
        claimed ? undefined : (
          <Button
            type="button"
            className="w-full"
            disabled={busy}
            onClick={() => {
              void onPaid();
            }}
          >
            I&apos;ve paid
          </Button>
        )
      }
    >
      <p className="text-[15px] text-muted-foreground">
        By EFT before {formatSastDate(row.payBy)}.
        {row.depositCredit > 0
          ? ` Your ${formatRand(row.depositCredit)} deposit is already counted.`
          : ""}
      </p>
      <PayDetails reference={row.reference} />
    </BottomSheet>
  );
}
