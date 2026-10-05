import type { Dispatch, SetStateAction } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import type { FeeFormData } from "./types";

/**
 * Props for the {@link FeeFormDialog} component.
 */
interface FeeFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  formData: FeeFormData;
  setFormData: Dispatch<SetStateAction<FeeFormData>>;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
}

/**
 * Create/edit dialog for a platform fee rule.
 *
 * @param props - Component props.
 * @param props.isOpen - Whether the dialog is open.
 * @param props.isEditing - True when editing an existing fee, which flips the copy and button labels.
 * @param props.formData - Current form values.
 * @param props.setFormData - Setter for the form values.
 * @param props.isSubmitting - True while the save mutation is in flight.
 * @param props.onOpenChange - Visibility setter for the dialog.
 * @param props.onSubmit - Handler that validates and saves the fee.
 * @returns The fee form dialog.
 */
export function FeeFormDialog({
  isOpen,
  isEditing,
  formData,
  setFormData,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: FeeFormDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Fee" : "Create New Fee"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the fee configuration"
              : "Add a new fee rule that will be applied at auction settlement"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Fee Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, name: e.target.value }));
              }}
              placeholder="e.g., Seller Commission"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }));
              }}
              placeholder="Brief description of this fee"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="feeType">Fee Type</Label>
              <Select
                value={formData.feeType}
                onValueChange={(value: "percentage" | "fixed") => {
                  setFormData((prev) => ({
                    ...prev,
                    feeType: value,
                    value: value === "percentage" ? 5 : 500,
                  }));
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed Amount (R)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="value">
                {formData.feeType === "percentage"
                  ? "Percentage"
                  : "Amount (R)"}
              </Label>
              <Input
                id="value"
                type="number"
                step={formData.feeType === "percentage" ? "0.01" : "1"}
                min={formData.feeType === "percentage" ? "0.01" : "0"}
                max={formData.feeType === "percentage" ? "100" : undefined}
                value={formData.value}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    value: parseFloat(e.target.value) || 0,
                  }));
                }}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="appliesTo">Applies To</Label>
            <Select
              value={formData.appliesTo}
              onValueChange={(value: "buyer" | "seller" | "both") => {
                setFormData((prev) => ({ ...prev, appliesTo: value }));
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="seller">Seller</SelectItem>
                <SelectItem value="buyer">Buyer</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => {
                  setFormData((prev) => ({
                    ...prev,
                    isActive: checked === true,
                  }));
                }}
              />
              <Label htmlFor="isActive" className="font-normal">
                Active
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="visibleToBuyer"
                checked={formData.visibleToBuyer}
                onCheckedChange={(checked) => {
                  setFormData((prev) => ({
                    ...prev,
                    visibleToBuyer: checked === true,
                  }));
                }}
              />
              <Label htmlFor="visibleToBuyer" className="font-normal">
                Visible to buyer
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="visibleToSeller"
                checked={formData.visibleToSeller}
                onCheckedChange={(checked) => {
                  setFormData((prev) => ({
                    ...prev,
                    visibleToSeller: checked === true,
                  }));
                }}
              />
              <Label htmlFor="visibleToSeller" className="font-normal">
                Visible to seller
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSubmit();
            }}
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Save Changes" : "Create Fee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
