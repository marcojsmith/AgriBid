import { useState } from "react";
import { Plus, Pencil, Trash2, RotateCcw, Hammer } from "lucide-react";
import { toast } from "sonner";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import type { Id, Doc } from "../../../convex/_generated/dataModel";

type Category = Doc<"equipmentCategories">;
type EquipmentMetadata = Doc<"equipmentMetadata"> & { categoryName: string };

interface MetadataCatalogProps {
  metadata: EquipmentMetadata[];
  categories: Category[];
  addMake: (args: {
    make: string;
    models: string[];
    categoryId: Id<"equipmentCategories">;
  }) => Promise<unknown>;
  updateMake: (args: {
    id: Id<"equipmentMetadata">;
    make: string;
    categoryId: Id<"equipmentCategories">;
    models: string[];
    isActive?: boolean;
  }) => Promise<unknown>;
  deleteMake: (args: { id: Id<"equipmentMetadata"> }) => Promise<unknown>;
  addModel: (args: {
    id: Id<"equipmentMetadata">;
    model: string;
  }) => Promise<unknown>;
  removeModel: (args: {
    id: Id<"equipmentMetadata">;
    model: string;
  }) => Promise<unknown>;
}

/**
 * Render the Makes & Models management interface for equipment metadata.
 *
 * Displays equipment makes grouped by category and provides controls to add new
 * makes, edit existing makes, deactivate/reactivate makes, and add or remove models.
 *
 * @param props.metadata - Array of equipment metadata entries (manufacturers with models and category info)
 * @param props.categories - Available equipment categories for selection when creating or editing makes
 * @param props.addMake - Function to create a new make; invoked with `{ make, models, categoryId }`
 * @param props.updateMake - Function to update an existing make; invoked with `{ id, make, categoryId, models, isActive? }`
 * @param props.deleteMake - Function to deactivate a make; invoked with `{ id }`
 * @param props.addModel - Function to add a model to a make; invoked with `{ id, model }`
 * @param props.removeModel - Function to remove a model from a make; invoked with `{ id, model }`
 * @returns The rendered metadata catalogue interface
 */
export function MetadataCatalog({
  metadata,
  categories,
  addMake,
  updateMake,
  deleteMake,
  addModel,
  removeModel,
}: MetadataCatalogProps) {
  const [isAddMakeOpen, setIsAddMakeOpen] = useState(false);
  const [newMake, setNewMake] = useState({
    make: "",
    categoryId: "" as Id<"equipmentCategories">,
    initialModel: "",
  });

  const handleAddMake = async () => {
    if (!newMake.make || !newMake.categoryId || !newMake.initialModel) {
      toast.error("All fields are required");
      return;
    }
    try {
      await addMake({
        make: newMake.make,
        categoryId: newMake.categoryId,
        models: [newMake.initialModel],
      });
      toast.success("Equipment make added successfully");
      setIsAddMakeOpen(false);
      setNewMake({
        make: "",
        categoryId: "" as Id<"equipmentCategories">,
        initialModel: "",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add make");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold tracking-tight">Makes & Models</h3>
        <Dialog open={isAddMakeOpen} onOpenChange={setIsAddMakeOpen}>
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
                  className="text-sm font-bold uppercase tracking-wider text-muted-foreground"
                >
                  Manufacturer Name
                </label>
                <Input
                  id="make-name"
                  placeholder="e.g. John Deere"
                  value={newMake.make}
                  onChange={(e) =>
                    setNewMake({ ...newMake, make: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="make-category"
                  className="text-sm font-bold uppercase tracking-wider text-muted-foreground"
                >
                  Category
                </label>
                <Select
                  value={newMake.categoryId}
                  onValueChange={(val) =>
                    setNewMake({
                      ...newMake,
                      categoryId: val as Id<"equipmentCategories">,
                    })
                  }
                >
                  <SelectTrigger id="make-category">
                    <SelectValue placeholder="Select category" />
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
              <div className="space-y-2">
                <label
                  htmlFor="make-initial-model"
                  className="text-sm font-bold uppercase tracking-wider text-muted-foreground"
                >
                  Initial Model
                </label>
                <Input
                  id="make-initial-model"
                  placeholder="e.g. 8R 410"
                  value={newMake.initialModel}
                  onChange={(e) =>
                    setNewMake({ ...newMake, initialModel: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddMakeOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddMake}>Add Make</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {metadata.length === 0 ? (
        <div className="bg-muted/30 rounded-xl p-12 text-center border-2 border-dashed">
          <Hammer className="h-10 w-10 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">
            No equipment makes found matching your search.
          </p>
        </div>
      ) : (
        <Accordion type="single" collapsible className="w-full space-y-2">
          {metadata.map((item) => (
            <AccordionItem
              key={item._id}
              value={item._id}
              className={`border rounded-xl px-4 ${!item.isActive ? "bg-muted/50 grayscale-[0.5]" : "bg-card"}`}
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-4 text-left">
                  <span className="font-bold text-lg">{item.make}</span>
                  <Badge
                    variant="outline"
                    className="font-medium bg-primary/5 text-primary border-primary/20 capitalize"
                  >
                    {item.categoryName}
                  </Badge>
                  {!item.isActive && (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4 space-y-4">
                <div className="flex flex-wrap gap-2 justify-between items-center bg-muted/30 p-3 rounded-lg">
                  <div className="text-sm text-muted-foreground">
                    <span className="font-bold">ID:</span> {item._id} |
                    <span className="font-bold ml-2">Last Updated:</span>{" "}
                    {item.updatedAt
                      ? new Date(item.updatedAt).toLocaleDateString()
                      : "Never"}
                  </div>
                  <div className="flex gap-2">
                    <EditMakeDialog
                      key={`${item._id}-${item.updatedAt}`}
                      item={item}
                      categories={categories}
                      updateMake={updateMake}
                    />
                    {item.isActive ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          if (
                            confirm(`Deactivate manufacturer "${item.make}"?`)
                          ) {
                            try {
                              await deleteMake({ id: item._id });
                              toast.success("Manufacturer deactivated");
                            } catch (err) {
                              toast.error(
                                err instanceof Error
                                  ? err.message
                                  : "Failed to deactivate"
                              );
                            }
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (!item.categoryId) {
                            toast.error("Category linkage missing");
                            return;
                          }
                          try {
                            await updateMake({
                              id: item._id,
                              make: item.make,
                              categoryId: item.categoryId,
                              models: item.models,
                              isActive: true,
                            });
                            toast.success("Manufacturer reactivated");
                          } catch (err) {
                            toast.error(
                              err instanceof Error
                                ? err.message
                                : "Failed to reactivate"
                            );
                          }
                        }}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reactivate
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                      Models
                    </h4>
                    <AddModelDialog makeId={item._id} addModel={addModel} />
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Model Name</TableHead>
                        <TableHead className="text-right w-24">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {item.models.map((model: string, index: number) => (
                        <TableRow key={`${item._id}-${model}-${index}`}>
                          <TableCell className="font-medium">{model}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              aria-label={`Remove model ${model} from ${item.make}`}
                              onClick={async () => {
                                if (
                                  confirm(
                                    `Remove model "${model}" from ${item.make}?`
                                  )
                                ) {
                                  try {
                                    await removeModel({ id: item._id, model });
                                    toast.success("Model removed");
                                  } catch (err) {
                                    toast.error(
                                      err instanceof Error
                                        ? err.message
                                        : "Failed to remove model"
                                    );
                                  }
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}

interface EditMakeDialogProps {
  item: EquipmentMetadata;
  categories: Category[];
  updateMake: (args: {
    id: Id<"equipmentMetadata">;
    make: string;
    categoryId: Id<"equipmentCategories">;
    models: string[];
  }) => Promise<unknown>;
}

/**
 * Render a dialog allowing editing of a manufacturer's name and category.
 *
 * Presents a modal form prefilled with the given manufacturer's data, validates input,
 * and calls `updateMake` to persist changes.
 *
 * @param item - The equipment metadata entry to edit (manufacturer, id, models and current category)
 * @param categories - List of available equipment categories for selection
 * @param updateMake - Callback invoked with updated manufacturer data `{ id, make, categoryId, models, isActive? }`
 * @returns The Dialog component containing the edit form
 */
function EditMakeDialog({ item, categories, updateMake }: EditMakeDialogProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({
    make: item.make,
    categoryId: item.categoryId ?? ("" as Id<"equipmentCategories">),
  });

  const handleUpdate = async () => {
    const trimmedMake = data.make.trim();
    if (!trimmedMake) {
      toast.error("Manufacturer name is required");
      return;
    }
    if (!data.categoryId) {
      toast.error("Category is required");
      return;
    }
    try {
      await updateMake({
        id: item._id,
        make: trimmedMake,
        categoryId: data.categoryId,
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
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label
              htmlFor={`edit-make-name-${item._id}`}
              className="text-sm font-bold uppercase tracking-wider text-muted-foreground"
            >
              Name
            </label>
            <Input
              id={`edit-make-name-${item._id}`}
              value={data.make}
              onChange={(e) => setData({ ...data, make: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor={`edit-make-category-${item._id}`}
              className="text-sm font-bold uppercase tracking-wider text-muted-foreground"
            >
              Category
            </label>
            <Select
              value={data.categoryId}
              onValueChange={(val) =>
                setData({
                  ...data,
                  categoryId: val as Id<"equipmentCategories">,
                })
              }
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
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpdate}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AddModelDialogProps {
  makeId: Id<"equipmentMetadata">;
  addModel: (args: {
    id: Id<"equipmentMetadata">;
    model: string;
  }) => Promise<unknown>;
}

/**
 * Renders a dialog that allows adding a new model for a given manufacturer.
 *
 * Validates that the model name is present, trims whitespace, calls `addModel` with the make id and model name, and provides success or error feedback via toasts.
 *
 * @param makeId - The id of the manufacturer to which the new model will be added.
 * @param addModel - Function invoked to add the model; called as `addModel({ id: makeId, model })`.
 */
function AddModelDialog({ makeId, addModel }: AddModelDialogProps) {
  const [open, setOpen] = useState(false);
  const [model, setModel] = useState("");

  const handleAdd = async () => {
    const trimmed = model.trim();
    if (!trimmed) {
      toast.error("Model name is required");
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
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label
              htmlFor={`add-model-${makeId}`}
              className="text-sm font-bold uppercase tracking-wider text-muted-foreground"
            >
              Model Name
            </label>
            <Input
              id={`add-model-${makeId}`}
              placeholder="e.g. 8R 410"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd}>Add Model</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
