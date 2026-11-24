import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatRand } from "@/lib/currency";
import { formatSastDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface ConsiderationActionsProps {
  /** The lot awaiting the seller's decision. */
  lotId: Id<"lots">;
  /** The top bid, in rand. */
  amount: number;
  /** When the seller's 48 hours end (ms). */
  deadline: number | undefined;
  /** Stack the buttons full-width (lot page) or keep them compact (lists). */
  layout?: "stacked" | "inline";
  className?: string;
}

/** What the confirm dialog is about to do. */
type Decision = "accept" | "decline";

/**
 * The seller's (or an admin's) choice on a lot that closed below its reserve:
 * "Accept R x" sells it to the top bidder, "Decline" leaves it not sold. Each
 * choice asks for a confirmation first because neither can be undone. The
 * server checks who is asking and that the deadline has not passed.
 *
 * @param props - Component props
 * @param props.lotId - The lot awaiting the decision
 * @param props.amount - The top bid in rand
 * @param props.deadline - Decision deadline, shown in the dialog
 * @param props.layout - `stacked` full-width buttons or `inline` compact ones
 * @param props.className - Extra classes merged onto the wrapper
 * @returns The two buttons and their confirm dialog
 */
export function ConsiderationActions({
  lotId,
  amount,
  deadline,
  layout = "stacked",
  className,
}: ConsiderationActionsProps) {
  const acceptTopBid = useMutation(api.auctions.acceptTopBid);
  const declineTopBid = useMutation(api.auctions.declineTopBid);
  const [pending, setPending] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Flip to the "time has passed" state the moment the deadline arrives.
  useEffect(() => {
    if (deadline === undefined) return;
    const remaining = deadline - Date.now();
    // Already past: the initial `now` state has the answer.
    if (remaining <= 0) return;
    const timer = setTimeout(
      () => {
        setNow(Date.now());
      },
      // setTimeout overflows past ~24.8 days; the window is 48 hours.
      Math.min(remaining, 2 ** 31 - 1)
    );
    return () => {
      clearTimeout(timer);
    };
  }, [deadline]);

  const handleConfirm = async (event: React.MouseEvent) => {
    // Keep the dialog open until the server has answered.
    event.preventDefault();
    if (!pending) return;
    setBusy(true);
    try {
      if (pending === "accept") {
        const result = await acceptTopBid({ lotId, expectedAmount: amount });
        if (result.expired) {
          toast.info("The 48 hours had passed, so the lot was not sold.");
        } else {
          toast.success(`Sold for ${formatRand(amount)}`);
        }
      } else {
        const result = await declineTopBid({ lotId });
        toast.success(
          result.expired
            ? "The 48 hours had passed, so the lot was not sold."
            : "Top bid declined. The lot is not sold."
        );
      }
      setPending(null);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Couldn't save your decision. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  // Past the deadline the seller can no longer decide: the lot is closed out as
  // not sold shortly, so the buttons give way to a short note.
  if (deadline !== undefined && now >= deadline) {
    return (
      <p
        data-slot="consideration-actions"
        className={cn("text-sm text-muted-foreground", className)}
      >
        The time to decide has passed. This lot will be marked not sold.
      </p>
    );
  }

  const stacked = layout === "stacked";
  return (
    <div
      data-slot="consideration-actions"
      className={cn(
        "flex gap-2",
        stacked ? "flex-col" : "flex-wrap md:flex-nowrap",
        className
      )}
    >
      <Button
        className={stacked ? "w-full" : "flex-1 font-bold md:flex-none"}
        size={stacked ? "default" : "sm"}
        onClick={() => {
          setPending("accept");
        }}
      >
        Accept {formatRand(amount)}
      </Button>
      <Button
        variant="outline"
        className={stacked ? "w-full" : "flex-1 font-bold md:flex-none"}
        size={stacked ? "default" : "sm"}
        onClick={() => {
          setPending("decline");
        }}
      >
        Decline
      </Button>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending === "accept"
                ? `Accept ${formatRand(amount)}?`
                : "Decline the top bid?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending === "accept"
                ? "The lot is sold to the top bidder at this price and fees are charged. This can't be undone."
                : "The lot is not sold and goes back to the pool. This can't be undone."}
              {deadline !== undefined
                ? ` You have until ${formatSastDate(deadline)} to decide.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Back</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                void handleConfirm(event);
              }}
            >
              {busy
                ? "Saving…"
                : pending === "accept"
                  ? "Yes, accept"
                  : "Yes, decline"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
