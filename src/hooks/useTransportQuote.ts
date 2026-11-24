import { useState, type ComponentProps } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

import { showToast } from "@/components/ds/showToast";
import type { TransportQuoteSheet } from "@/components/ds/TransportQuoteSheet";
import { getErrorMessage } from "@/lib/utils";

type SheetProps = ComponentProps<typeof TransportQuoteSheet>;

/** What `useTransportQuote` returns. */
export interface UseTransportQuote {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Spread onto `TransportQuoteSheet` (add `lot` where the page has one). */
  sheetProps: Pick<
    SheetProps,
    | "open"
    | "onOpenChange"
    | "defaultName"
    | "defaultPhone"
    | "busy"
    | "error"
    | "onSubmit"
  >;
}

/**
 * State and sending for the "Request a transport quote" sheet. Signed-in
 * users get their name and phone prefilled from their KYC details; guests skip
 * that query. On success it toasts and closes; on failure it keeps the sheet
 * open and exposes the error.
 *
 * @param lotId - The lot the request is about, when any
 * @returns The open state and the props for `TransportQuoteSheet`
 */
export function useTransportQuote(lotId?: Id<"lots">): UseTransportQuote {
  const { isAuthenticated } = useConvexAuth();
  const requestQuote = useMutation(api.transport.requestQuote);
  const [open, setOpenState] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const details = useQuery(
    api.users.getMyKYCDetails,
    open && isAuthenticated ? {} : "skip"
  );

  const setOpen = (next: boolean) => {
    if (next) setError(null);
    setOpenState(next);
  };

  const fullName = [details?.firstName, details?.lastName]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
  const phoneNumber = details?.phoneNumber?.trim() ?? "";
  const defaultName = fullName === "" ? undefined : fullName;
  const defaultPhone = phoneNumber === "" ? undefined : phoneNumber;

  const onSubmit: SheetProps["onSubmit"] = (values) => {
    setBusy(true);
    setError(null);
    requestQuote({ ...values, lotId })
      .then(() => {
        showToast("Request sent. We'll call you with a quote.");
        setOpenState(false);
      })
      .catch((err: unknown) => {
        setError(getErrorMessage(err, "Something went wrong. Try again."));
      })
      .finally(() => {
        setBusy(false);
      });
  };

  return {
    open,
    setOpen,
    sheetProps: {
      open,
      onOpenChange: setOpen,
      defaultName,
      defaultPhone,
      busy,
      error,
      onSubmit,
    },
  };
}
