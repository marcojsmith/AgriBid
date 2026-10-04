import { useState } from "react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { Flag } from "lucide-react";
import { api } from "convex/_generated/api";

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
import type { ReportReason } from "@/types/profile";

interface ReportDialogProps {
  /** The ID of the user being reported */
  userId: string;
}

/**
 * Dialog component for reporting a user profile.
 *
 * Allows non-owners to report a profile with a reason and optional details.
 *
 * @param props - Component props
 * @param props.userId - The ID of the user being reported
 * @returns A dialog trigger button and the report dialog
 */
export function ReportDialog({ userId }: ReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");

  const reportProfile = useMutation(api.profileFlags.reportProfile);

  const handleSubmit = async () => {
    if (!reason) {
      toast.error("Please select a reason for reporting");
      return;
    }

    try {
      await reportProfile({
        reportedUserId: userId,
        reason,
        details: details.trim() || undefined,
      });
      toast.success("Thank you for your report");
      setOpen(false);
      setReason("");
      setDetails("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to report profile"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="w-full text-muted-foreground hover:text-destructive font-semibold text-xs h-10 rounded-md"
        >
          <Flag className="h-4 w-4 mr-2" />
          Report Profile
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this Profile</DialogTitle>
          <DialogDescription>
            Help us understand what's wrong with this profile
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="report-reason" className="text-sm font-medium">
              Reason
            </label>
            <Select
              value={reason}
              onValueChange={(v) => {
                setReason(v as ReportReason);
              }}
            >
              <SelectTrigger id="report-reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fake_account">Fake Account</SelectItem>
                <SelectItem value="fraudulent_listings">
                  Fraudulent Listings
                </SelectItem>
                <SelectItem value="abusive_behaviour">
                  Abusive Behaviour
                </SelectItem>
                <SelectItem value="identity_misrepresentation">
                  Identity Misrepresentation
                </SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label htmlFor="report-details" className="text-sm font-medium">
              Additional details (optional)
            </label>
            <Textarea
              id="report-details"
              name="report-details"
              placeholder="Provide more context..."
              value={details}
              onChange={(e) => {
                setDetails(e.target.value);
              }}
              rows={3}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleSubmit}>
              Submit Report
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
