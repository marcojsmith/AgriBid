import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Landmark, Search } from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { SegmentedControl } from "@/components/ds/SegmentedControl";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRand } from "@/lib/currency";
import { formatSastDate } from "@/lib/dates";
import { getErrorMessage } from "@/lib/utils";

/** One deposit in the queue. */
type DepositRow = FunctionReturnType<
  typeof api.admin.registration.findDepositByReference
> &
  object;

type DepositStatus = DepositRow["status"];

/** The status tabs, in the order they are worked. */
const TABS: readonly { value: DepositStatus; label: string }[] = [
  { value: "awaiting", label: "Awaiting" },
  { value: "paid_claimed", label: "Paid claimed" },
  { value: "received", label: "Received" },
  { value: "refunded", label: "Refunded" },
];

/** Rows loaded per page. */
const PAGE_SIZE = 50;

/**
 * The date that matters most for a row's status.
 *
 * @param row - The deposit row
 * @returns A short label and date, or null when there is none yet
 */
function relevantDate(row: DepositRow): { label: string; at: number } | null {
  if (row.status === "refunded" && row.refundedAt !== undefined) {
    return { label: "Refunded", at: row.refundedAt };
  }
  if (row.status === "received" && row.receivedAt !== undefined) {
    return { label: "Received", at: row.receivedAt };
  }
  if (row.paidClaimedAt !== undefined) {
    return { label: "Claimed", at: row.paidClaimedAt };
  }
  return null;
}

/** What the open dialog is for. */
type Action =
  { kind: "received"; row: DepositRow } | { kind: "refunded"; row: DepositRow };

/**
 * Admin page for the manual EFT deposits: a queue by status, a reference
 * search, and the "Mark received" and "Mark refunded" steps.
 *
 * @returns The deposits page
 */
export default function AdminDeposits() {
  const [status, setStatus] = useState<DepositStatus>("paid_claimed");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const [amount, setAmount] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const list = usePaginatedQuery(
    api.admin.registration.listDeposits,
    { status },
    { initialNumItems: PAGE_SIZE }
  );
  const trimmedSearch = search.trim();
  const found = useQuery(
    api.admin.registration.findDepositByReference,
    trimmedSearch === "" ? "skip" : { reference: trimmedSearch }
  );
  const markReceived = useMutation(api.admin.registration.markDepositReceived);
  const markRefunded = useMutation(api.admin.registration.markDepositRefunded);

  const searching = trimmedSearch !== "";
  const rows: DepositRow[] = searching ? (found ? [found] : []) : list.results;
  const loading = searching
    ? found === undefined
    : list.status === "LoadingFirstPage";

  const openReceived = (row: DepositRow): void => {
    setAmount(String(row.amount));
    setAction({ kind: "received", row });
  };

  const parsedAmount = amount.trim() === "" ? Number.NaN : Number(amount);
  const amountError =
    action?.kind === "received" &&
    !(Number.isFinite(parsedAmount) && parsedAmount >= action.row.amount)
      ? `Enter at least ${formatRand(action.row.amount)}.`
      : null;

  const confirm = async (): Promise<void> => {
    if (!action || isSaving) return;
    setIsSaving(true);
    try {
      if (action.kind === "received") {
        await markReceived({
          userId: action.row.userId,
          receivedAmount: parsedAmount,
        });
        toast.success("Deposit marked received");
      } else {
        await markRefunded({ userId: action.row.userId });
        toast.success("Deposit marked refunded");
      }
      setAction(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't update the deposit"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout title="Deposits" subtitle="Registration deposits paid by EFT">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl
          ariaLabel="Deposit status"
          value={status}
          onChange={(next) => {
            setStatus(next);
            setSearch("");
          }}
          options={TABS}
        />
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search by reference"
            placeholder="Search by reference"
            className="pl-9 font-mono"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
          />
        </div>
      </div>

      <Card className="overflow-hidden border bg-card/50">
        {loading ? (
          <div className="flex justify-center p-8">
            <LoadingIndicator />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Buyer</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Landmark className="h-8 w-8 opacity-20" />
                      <p className="text-xs font-medium">
                        {searching
                          ? "No deposit with that reference"
                          : "No deposits here"}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const date = relevantDate(row);
                  return (
                    <TableRow key={row.reference}>
                      <TableCell className="font-medium">
                        {row.name ?? row.userId}
                      </TableCell>
                      <TableCell className="font-mono">
                        {row.reference}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        {formatRand(row.receivedAmount ?? row.amount)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {date
                          ? `${date.label} ${formatSastDate(date.at)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {(row.status === "awaiting" ||
                          row.status === "paid_claimed") && (
                          <Button
                            size="sm"
                            onClick={() => {
                              openReceived(row);
                            }}
                          >
                            Mark received
                          </Button>
                        )}
                        {row.status === "received" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setAction({ kind: "refunded", row });
                            }}
                          >
                            Mark refunded
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
        {!searching && list.status === "CanLoadMore" && (
          <div className="flex justify-center border-t bg-muted/20 p-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                list.loadMore(PAGE_SIZE);
              }}
            >
              Load more
            </Button>
          </div>
        )}
      </Card>

      <Dialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open && !isSaving) setAction(null);
        }}
      >
        <DialogContent>
          {action?.kind === "received" && (
            <>
              <DialogHeader>
                <DialogTitle>Mark deposit received</DialogTitle>
                <DialogDescription>
                  <span className="font-mono">{action.row.reference}</span> from{" "}
                  {action.row.name ?? action.row.userId}. Check the amount that
                  reached the bank account.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1">
                <Label htmlFor="received-amount">Amount received (R)</Label>
                <Input
                  id="received-amount"
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  aria-invalid={amountError !== null}
                  aria-describedby={
                    amountError ? "received-amount-error" : undefined
                  }
                  onChange={(event) => {
                    setAmount(event.target.value);
                  }}
                />
                {amountError && (
                  <p
                    id="received-amount-error"
                    role="alert"
                    className="text-xs text-destructive"
                  >
                    {amountError}
                  </p>
                )}
              </div>
            </>
          )}
          {action?.kind === "refunded" && (
            <DialogHeader>
              <DialogTitle>Mark deposit refunded</DialogTitle>
              <DialogDescription>
                Refund{" "}
                {formatRand(action.row.receivedAmount ?? action.row.amount)} to
                the account it came from?
              </DialogDescription>
            </DialogHeader>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={isSaving}
              onClick={() => {
                setAction(null);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={
                isSaving ||
                (action?.kind === "received" && amountError !== null)
              }
              onClick={() => {
                void confirm();
              }}
            >
              {isSaving && <LoadingIndicator size="sm" className="mr-2" />}
              {action?.kind === "received"
                ? "Confirm received"
                : "Confirm refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
