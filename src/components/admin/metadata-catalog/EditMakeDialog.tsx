import { useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "convex/_generated/dataModel";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { validateEditedMake, type EditMakeForm } from "./metadataHelpers";
import type { Category, EquipmentMetadata, UpdateMakeMutation } from "./types";

/**
 * Props for the {@link EditMakeDialog} component.
 */
interface EditMakeDialogProps {
  item: EquipmentMetadata;
  categories: Category[];
  updateMake: UpdateMakeMutation;
}

/**
 * Dialog for renaming a make or moving it to another category.
 *
 * @param props - Component props.
 * @param props.item - The make being edited.
 * @param props.categories - Categories to choose from.
 * @param props.updateMake - Mutation that saves the make.
 * @returns The edit-make dialog and its trigger button.
 */
export function EditMakeDialog({
  item,
  categories,
  updateMake,
}: EditMakeDialogProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<EditMakeForm>({
    make: item.make,
    categoryId: item.categoryId ?? "",
  });

  const handleUpdate = async () => {
    const validationError = validateEditedMake(data);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    try {
      await updateMake({
        id: item._id,
        make: data.make.trim(),
        categoryId: data.categoryId as Id<"equipmentCategories">,
        models: item.models,
      });
      toast.success("Manufacturer updated");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Manufacturer</DialogTitle>
          <DialogDescription>
            Update the manufacturer name or category linkage.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label
              htmlFor={`edit-make-name-${item._id}`}
              className="text-xs font-medium text-muted-foreground"
            >
              Name
            </label>
            <Input
              id={`edit-make-name-${item._id}`}
              value={data.make}
              onChange={(e) => {
                setData({ ...data, make: e.target.value });
              }}
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor={`edit-make-category-${item._id}`}
              className="text-xs font-medium text-muted-foreground"
            >
              Category
            </label>
            <Select
              value={data.categoryId}
              onValueChange={(val) => {
                setData({
                  ...data,
                  categoryId: val as Id<"equipmentCategories">,
                });
              }}
            >
              <SelectTrigger id={`edit-make-category-${item._id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleUpdate}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
