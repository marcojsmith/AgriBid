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

import { validateModelName } from "./metadataHelpers";
import type { AddModelMutation } from "./types";

/**
 * Props for the {@link AddModelDialog} component.
 */
interface AddModelDialogProps {
  makeId: Id<"equipmentMetadata">;
  addModel: AddModelMutation;
}

/**
 * Dialog for adding a model to an existing make.
 *
 * @param props - Component props.
 * @param props.makeId - Id of the make the model belongs to.
 * @param props.addModel - Mutation that adds the model.
 * @returns The add-model dialog and its trigger button.
 */
export function AddModelDialog({ makeId, addModel }: AddModelDialogProps) {
  const [open, setOpen] = useState(false);
  const [model, setModel] = useState("");

  const handleAdd = async () => {
    const trimmed = model.trim();
    const validationError = validateModelName(model);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    try {
      await addModel({ id: makeId, model: trimmed });
      toast.success("Model added");
      setModel("");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add model");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8">
          <Plus className="h-3 w-3 mr-1" />
          Add Model
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Model</DialogTitle>
          <DialogDescription>
            Enter the name for the new model for this manufacturer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label
              htmlFor={`add-model-${makeId}`}
              className="text-xs font-medium text-muted-foreground"
            >
              Model Name
            </label>
            <Input
              id={`add-model-${makeId}`}
              placeholder="e.g. 8R 410"
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              autoFocus
            />
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
          <Button onClick={handleAdd}>Add Model</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
