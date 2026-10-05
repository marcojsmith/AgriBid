import { useState } from "react";
import { Plus } from "lucide-react";
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

import { validateNewMake, type NewMakeForm } from "./metadataHelpers";
import type { AddMakeMutation, Category } from "./types";

/**
 * Props for the {@link AddMakeDialog} component.
 */
interface AddMakeDialogProps {
  categories: Category[];
  addMake: AddMakeMutation;
}

/**
 * Dialog for creating a new equipment make with at least one initial model.
 *
 * @param props - Component props.
 * @param props.categories - Active categories to choose from.
 * @param props.addMake - Mutation that creates the make.
 * @returns The add-make dialog and its trigger button.
 */
export function AddMakeDialog({ categories, addMake }: AddMakeDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newMake, setNewMake] = useState<NewMakeForm>({
    make: "",
    categoryId: "",
    initialModel: "",
  });

  const handleAddMake = async () => {
    const validationError = validateNewMake(newMake);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    try {
      await addMake({
        make: newMake.make,
        categoryId: newMake.categoryId as Id<"equipmentCategories">,
        models: [newMake.initialModel],
      });
      toast.success("Equipment make added successfully");
      setIsOpen(false);
      setNewMake({ make: "", categoryId: "", initialModel: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add make");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Make
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Equipment Make</DialogTitle>
          <DialogDescription>
            Create a new manufacturer entry. You must provide at least one
            initial model.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label
              htmlFor="make-name"
              className="text-xs font-medium text-muted-foreground"
            >
              Manufacturer Name
            </label>
            <Input
              id="make-name"
              placeholder="e.g. John Deere"
              value={newMake.make}
              onChange={(e) => {
                setNewMake({ ...newMake, make: e.target.value });
              }}
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="make-category"
              className="text-xs font-medium text-muted-foreground"
            >
              Category
            </label>
            <Select
              value={newMake.categoryId}
              onValueChange={(val) => {
                setNewMake({
                  ...newMake,
                  categoryId: val as Id<"equipmentCategories">,
                });
              }}
            >
              <SelectTrigger id="make-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories
                  .filter((c) => c.isActive)
                  .map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label
              htmlFor="make-initial-model"
              className="text-xs font-medium text-muted-foreground"
            >
              Initial Model
            </label>
            <Input
              id="make-initial-model"
              placeholder="e.g. 8R 410"
              value={newMake.initialModel}
              onChange={(e) => {
                setNewMake({ ...newMake, initialModel: e.target.value });
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setIsOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleAddMake}>Add Make</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
