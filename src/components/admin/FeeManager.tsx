import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface FeeFormData {
  name: string;
  description: string;
  feeType: "percentage" | "fixed";
  value: number;
  appliesTo: "buyer" | "seller" | "both";
  isActive: boolean;
  visibleToBuyer: boolean;
  visibleToSeller: boolean;
}

const defaultFormData: FeeFormData = {
  name: "",
  description: "",
  feeType: "percentage",
  value: 0,
  appliesTo: "seller",
  isActive: true,
  visibleToBuyer: true,
  visibleToSeller: true,
};

/**
 * Admin interface for managing platform fees.
 * Allows creating, editing, deleting, and reordering platform fee rules.
 * @returns The FeeManager React component.
 */
export function FeeManager() {
  const fees = useQuery(api.admin.getPlatformFees);
  const createFee = useMutation(api.admin.createPlatformFee);
  const updateFee = useMutation(api.admin.updatePlatformFee);
  const deleteFee = useMutation(api.admin.deletePlatformFee);
  const reorderFees = useMutation(api.admin.reorderPlatformFees);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [deletingFeeId, setDeletingFeeId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FeeFormData>(defaultFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reorderingIndex, setReorderingIndex] = useState<number | null>(null);

  const allFees = fees?.allFees ?? [];
  const sortedFees = [...allFees].sort((a, b) => a.sortOrder - b.sortOrder);

  const handleOpenCreate = () => {
    setEditingFeeId(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (fee: (typeof allFees)[0]) => {
    setEditingFeeId(fee._id as string);
    setFormData({
      name: fee.name,
      description: fee.description ?? "",
      feeType: fee.feeType,
      value: fee.feeType === "percentage" ? fee.value * 100 : fee.value,
      appliesTo: fee.appliesTo,
      isActive: fee.isActive,
      visibleToBuyer: fee.visibleToBuyer,
      visibleToSeller: fee.visibleToSeller,
    });
    setIsDialogOpen(true);
  };

  const handleOpenDelete = (feeId: string) => {
    setDeletingFeeId(feeId);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Fee name is required");
      return;
    }

    if (formData.feeType === "percentage") {
      if (formData.value < 0.01 || formData.value > 100) {
        toast.error("Percentage must be between 0.01% and 100%");
        return;
      }
    } else {
      if (formData.value <= 0) {
        toast.error("Fixed fee must be greater than 0");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (editingFeeId) {
        await updateFee({
          feeId: editingFeeId as Id<"platformFees">,
          name: formData.name,
          description: formData.description || undefined,
          feeType: formData.feeType,
          value:
            formData.feeType === "percentage"
              ? formData.value / 100
              : formData.value,
          appliesTo: formData.appliesTo,
          isActive: formData.isActive,
          visibleToBuyer: formData.visibleToBuyer,
          visibleToSeller: formData.visibleToSeller,
        });
        toast.success("Fee updated successfully");
      } else {
        await createFee({
          name: formData.name,
          description: formData.description || undefined,
          feeType: formData.feeType,
          value:
            formData.feeType === "percentage"
              ? formData.value / 100
              : formData.value,
          appliesTo: formData.appliesTo,
          isActive: formData.isActive,
          visibleToBuyer: formData.visibleToBuyer,
          visibleToSeller: formData.visibleToSeller,
        });
        toast.success("Fee created successfully");
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save fee"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingFeeId) return;

    setIsSubmitting(true);
    try {
      await deleteFee({ feeId: deletingFeeId as Id<"platformFees"> });
      toast.success("Fee deleted successfully");
      setIsDeleteDialogOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete fee"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0 || reorderingIndex !== null) return;
    const newOrder = [...sortedFees];
    [newOrder[index - 1], newOrder[index]] = [
      newOrder[index],
      newOrder[index - 1],
    ];
    try {
      setReorderingIndex(index);
      await reorderFees({
        feeIds: newOrder.map((f) => f._id as Id<"platformFees">),
      });
      toast.success("Fee order updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reorder fees"
      );
    } finally {
      setReorderingIndex(null);
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === sortedFees.length - 1 || reorderingIndex !== null) return;
    const newOrder = [...sortedFees];
    [newOrder[index], newOrder[index + 1]] = [
      newOrder[index + 1],
      newOrder[index],
    ];
    try {
      setReorderingIndex(index);
      await reorderFees({
        feeIds: newOrder.map((f) => f._id as Id<"platformFees">),
      });
      toast.success("Fee order updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reorder fees"
      );
    } finally {
      setReorderingIndex(null);
    }
  };

  const formatFeeValue = (fee: (typeof allFees)[0]) => {
    if (fee.feeType === "percentage") {
      return `${(fee.value * 100).toFixed(2).replace(/\.?0+$/, "")}%`;
    }
    return `R ${fee.value.toLocaleString()}`;
  };

  if (fees === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Fee Rules</h2>
          <p className="text-sm text-muted-foreground">
            Configure fees that will be applied at auction settlement
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Fee
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Order</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Applies To</TableHead>
                <TableHead>Visible</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedFees.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No fees configured. Click "Add Fee" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                sortedFees.map((fee, index) => (
                  <TableRow key={fee._id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0 || reorderingIndex !== null}
                          aria-label={`Move ${fee.name} up`}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleMoveDown(index)}
                          disabled={index === sortedFees.length - 1 || reorderingIndex !== null}
                          aria-label={`Move ${fee.name} down`}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{fee.name}</TableCell>
                    <TableCell>
                      <span className="capitalize">{fee.feeType}</span>
                    </TableCell>
                    <TableCell>{formatFeeValue(fee)}</TableCell>
                    <TableCell>
                      <span className="capitalize">{fee.appliesTo}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        {fee.visibleToBuyer && <span>Buyer</span>}
                        {fee.visibleToBuyer && fee.visibleToSeller && (
                          <span>|</span>
                        )}
                        {fee.visibleToSeller && <span>Seller</span>}
                        {!fee.visibleToBuyer && !fee.visibleToSeller && (
                          <span>Hidden</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          fee.isActive
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {fee.isActive ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(fee)}
                          aria-label={`Edit fee ${fee.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDelete(fee._id as string)}
                          aria-label={`Delete fee ${fee.name}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingFeeId ? "Edit Fee" : "Create New Fee"}
            </DialogTitle>
            <DialogDescription>
              {editingFeeId
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
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Seller Commission"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of this fee"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="feeType">Fee Type</Label>
                <Select
                  value={formData.feeType}
                  onValueChange={(value: "percentage" | "fixed") =>
                    setFormData({
                      ...formData,
                      feeType: value,
                      value: value === "percentage" ? 5 : 500,
                    })
                  }
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
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      value: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="appliesTo">Applies To</Label>
              <Select
                value={formData.appliesTo}
                onValueChange={(value: "buyer" | "seller" | "both") =>
                  setFormData({ ...formData, appliesTo: value })
                }
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
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isActive: checked === true })
                  }
                />
                <Label htmlFor="isActive" className="font-normal">
                  Active
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="visibleToBuyer"
                  checked={formData.visibleToBuyer}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      visibleToBuyer: checked === true,
                    })
                  }
                />
                <Label htmlFor="visibleToBuyer" className="font-normal">
                  Visible to buyer
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="visibleToSeller"
                  checked={formData.visibleToSeller}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      visibleToSeller: checked === true,
                    })
                  }
                />
                <Label htmlFor="visibleToSeller" className="font-normal">
                  Visible to seller
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingFeeId ? "Save Changes" : "Create Fee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Fee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this fee? This action cannot be
              undone. This will not affect fees already calculated on past
              auctions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}