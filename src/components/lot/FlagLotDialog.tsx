import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Flag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/utils";

type FlagReason = "misleading" | "inappropriate" | "suspicious" | "other";

/**
 * "Report this lot": a small link at the foot of the lot page that opens a
 * dialog to flag a misleading, inappropriate or suspicious listing. Only
 * signed-in buyers who are not the seller see it (the page decides).
 *
 * @param props - Component props
 * @param props.lotId - The lot being reported
 * @returns The trigger and its dialog
 */
export function FlagLotDialog({ lotId }: { lotId: Id<"lots"> }) {
  const flagLot = useMutation(api.auctions.mutations.publish.flagLot);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<FlagReason | "">("");
  const [details, setDetails] = useState("");

  const submit = async () => {
    if (!reason) {
      toast.error("Please select a reason for flagging");
      return;
    }
    try {
      const result = await flagLot({
        lotId,
        reason,
        details: details.trim() || undefined,
      });
      toast.success(
        result.hideTriggered
          ? "This lot has been flagged and hidden for review"
          : "Thank you for your report"
      );
      setOpen(false);
      setReason("");
      setDetails("");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to flag this lot"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="gap-2 text-muted-foreground">
          <Flag aria-hidden="true" />
          Report this lot
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this lot</DialogTitle>
          <DialogDescription>
            Tell us what&apos;s wrong with this listing.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="flag-reason" className="text-sm font-medium">
              Reason
            </label>
            <Select
              value={reason}
              onValueChange={(value) => {
                setReason(value as FlagReason);
              }}
            >
              <SelectTrigger id="flag-reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="misleading">
                  Misleading information
                </SelectItem>
                <SelectItem value="inappropriate">
                  Inappropriate content
                </SelectItem>
                <SelectItem value="suspicious">Suspicious activity</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label htmlFor="flag-details" className="text-sm font-medium">
              Details (optional)
            </label>
            <Textarea
              id="flag-details"
              name="flag-details"
              value={details}
              onChange={(event) => {
                setDetails(event.target.value);
              }}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void submit()}>
              Submit report
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
