// app/src/pages/admin/auctions/AuctionFormDialog.tsx
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFileUpload } from "@/hooks/useFileUpload";
import { getErrorMessage } from "@/lib/utils";

interface AuctionFormDialogProps {
  open: boolean;
  auctionId: Id<"auctions"> | null;
  onOpenChange: (open: boolean) => void;
}

/** Field values collected by the auction create/edit form. */
interface FormState {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  defaultBuyerPremiumPct: string;
  defaultSellerCommissionPct: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  startTime: "",
  endTime: "",
  defaultBuyerPremiumPct: "",
  defaultSellerCommissionPct: "",
};

/**
 * Convert an epoch millisecond timestamp to a `datetime-local` input value.
 * @param ms - Epoch milliseconds.
 * @returns A `YYYY-MM-DDTHH:mm` formatted local-time string.
 */
function toLocalInputValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Dialog for creating or editing an auction event (scheduled sale container):
 * title, description, banner image, start/end window and default fee rates.
 *
 * @param props - Component props.
 * @param props.open - Whether the dialog is open.
 * @param props.auctionId - The auction being edited, or null to create a new one.
 * @param props.onOpenChange - Callback invoked when the dialog's open state changes.
 * @returns The dialog element.
 */
export function AuctionFormDialog({
  open,
  auctionId,
  onOpenChange,
}: AuctionFormDialogProps) {
  const existing = useQuery(
    api.auctions.getAuctionById,
    auctionId ? { auctionId } : "skip"
  );

  const createAuction = useMutation(
    api.auctions.mutations.adminCrud.createAuction
  );
  const updateAuction = useMutation(
    api.auctions.mutations.adminCrud.updateAuction
  );

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const {
    files,
    handleFileChange,
    uploadFiles,
    isUploading,
    setFiles,
    cleanupUploads,
  } = useFileUpload({ maxFiles: 1, allowedTypes: ["image/png", "image/jpeg"] });

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setForm({
        title: existing.title,
        description: existing.description ?? "",
        startTime: toLocalInputValue(existing.startTime),
        endTime: toLocalInputValue(existing.endTime),
        defaultBuyerPremiumPct:
          existing.defaultBuyerPremiumPct !== undefined
            ? String(existing.defaultBuyerPremiumPct * 100)
            : "",
        defaultSellerCommissionPct:
          existing.defaultSellerCommissionPct !== undefined
            ? String(existing.defaultSellerCommissionPct * 100)
            : "",
      });
    } else if (!auctionId) {
      setForm(EMPTY_FORM);
      setFiles([]);
    }
  }, [open, existing, auctionId, setFiles]);

  const handleSave = async () => {
    const title = form.title.trim();
    if (!title) {
      toast.error("Title is required");
      return;
    }
    const startTime = form.startTime ? new Date(form.startTime).getTime() : 0;
    const endTime = form.endTime ? new Date(form.endTime).getTime() : 0;
    if (!startTime || !endTime) {
      toast.error("Start and end time are required");
      return;
    }
    if (endTime <= startTime) {
      toast.error("End time must be after start time");
      return;
    }

    setIsSaving(true);
    let uploadedStorageId: string | undefined;
    try {
      if (files.length > 0) {
        const storageIds = await uploadFiles(files, true);
        if (!storageIds) {
          setIsSaving(false);
          return;
        }
        uploadedStorageId = storageIds[0];
      }

      const buyerPct =
        form.defaultBuyerPremiumPct.trim() === ""
          ? undefined
          : Number(form.defaultBuyerPremiumPct) / 100;
      const sellerPct =
        form.defaultSellerCommissionPct.trim() === ""
          ? undefined
          : Number(form.defaultSellerCommissionPct) / 100;

      if (auctionId) {
        await updateAuction({
          auctionId,
          title,
          description: form.description.trim() || undefined,
          bannerImage: uploadedStorageId as Id<"_storage"> | undefined,
          startTime,
          endTime,
          defaultBuyerPremiumPct: buyerPct,
          defaultSellerCommissionPct: sellerPct,
        });
        toast.success("Auction updated");
      } else {
        await createAuction({
          title,
          description: form.description.trim() || undefined,
          bannerImage: uploadedStorageId as Id<"_storage"> | undefined,
          startTime,
          endTime,
          defaultBuyerPremiumPct: buyerPct,
          defaultSellerCommissionPct: sellerPct,
        });
        toast.success("Auction created");
      }
      onOpenChange(false);
    } catch (err) {
      if (uploadedStorageId) {
        await cleanupUploads([uploadedStorageId]);
      }
      toast.error(getErrorMessage(err, "Failed to save auction"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {auctionId ? "Edit Auction" : "New Auction"}
          </DialogTitle>
          <DialogDescription>
            Schedule a sale window and, optionally, default buyer/seller fee
            rates that new lot assignments will inherit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              value={form.title}
              onChange={(e) => {
                setForm((f) => ({ ...f, title: e.target.value }));
              }}
              placeholder="Spring Equipment Sale"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-description">Description</Label>
            <Textarea
              id="event-description"
              value={form.description}
              onChange={(e) => {
                setForm((f) => ({ ...f, description: e.target.value }));
              }}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-banner">Banner Image</Label>
            <Input
              id="event-banner"
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleFileChange}
            />
            {existing?.bannerImageUrl && files.length === 0 && (
              <img
                src={existing.bannerImageUrl}
                alt="Current banner"
                className="h-20 rounded border object-cover"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="event-start">Start</Label>
              <Input
                id="event-start"
                type="datetime-local"
                value={form.startTime}
                onChange={(e) => {
                  setForm((f) => ({ ...f, startTime: e.target.value }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-end">End</Label>
              <Input
                id="event-end"
                type="datetime-local"
                value={form.endTime}
                onChange={(e) => {
                  setForm((f) => ({ ...f, endTime: e.target.value }));
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="event-buyer-pct">Default Buyer Premium (%)</Label>
              <Input
                id="event-buyer-pct"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.defaultBuyerPremiumPct}
                onChange={(e) => {
                  setForm((f) => ({
                    ...f,
                    defaultBuyerPremiumPct: e.target.value,
                  }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-seller-pct">
                Default Seller Commission (%)
              </Label>
              <Input
                id="event-seller-pct"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.defaultSellerCommissionPct}
                onChange={(e) => {
                  setForm((f) => ({
                    ...f,
                    defaultSellerCommissionPct: e.target.value,
                  }));
                }}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
            disabled={isSaving || isUploading}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              void handleSave();
            }}
            disabled={isSaving || isUploading}
          >
            {isSaving || isUploading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
