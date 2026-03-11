import { useState } from "react";
import { Plus, Pencil, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

interface CategoryManagerProps {
  categories: Category[];
  addCategory: (args: { name: string }) => Promise<unknown>;
  updateCategory: (args: {
    id: Id<"equipmentCategories">;
    name: string;
  }) => Promise<unknown>;
  deleteCategory: (args: { id: Id<"equipmentCategories"> }) => Promise<unknown>;
}

/**
 * Component for managing equipment categories.
 * Provides a table view of categories with actions to add, edit, and deactivate.
 *
 * @param props - Component props
 * @param props.categories
 * @param props.addCategory
 * @param props.updateCategory
 * @param props.deleteCategory
 * @returns The rendered category manager interface
 */
export function CategoryManager({
  categories,
  addCategory,
  updateCategory,
  deleteCategory,
}: CategoryManagerProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error("Category name is required");
      return;
    }
    try {
      await addCategory({ name: trimmed });
      toast.success("Category added");
      setNewName("");
      setIsAddOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add category"
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold tracking-tight">Manage Categories</h3>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Category</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label
                  htmlFor="category-name"
                  className="text-sm font-bold uppercase tracking-wider text-muted-foreground"
                >
                  Category Name
                </label>
                <Input
                  id="category-name"
                  placeholder="e.g. Excavator"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdd}>Add Category</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Category Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((cat) => (
              <TableRow
                key={cat._id}
                className={
                  !cat.isActive ? "bg-muted/30 text-muted-foreground" : ""
                }
              >
                <TableCell className="font-bold">{cat.name}</TableCell>
                <TableCell>
                  <Badge
                    variant={cat.isActive ? "outline" : "secondary"}
                    className={
                      cat.isActive
                        ? "bg-green-500/10 text-green-500 border-green-500/20"
                        : ""
                    }
                  >
                    {cat.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <EditCategoryDialog
                      category={cat}
                      updateCategory={updateCategory}
                    />
                    {cat.isActive ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          if (confirm(`Deactivate category "${cat.name}"?`)) {
                            deleteCategory({ id: cat._id }).catch((err) =>
                              toast.error(
                                err instanceof Error
                                  ? err.message
                                  : "Failed to delete"
                              )
                            );
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary"
                        onClick={async () => {
                          try {
                            await addCategory({ name: cat.name }); // addCategory handles reactivation
                            toast.success("Category reactivated");
                          } catch (err) {
                            toast.error(
                              err instanceof Error
                                ? err.message
                                : "Failed to reactivate"
                            );
                          }
                        }}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

interface EditCategoryDialogProps {
  category: Category;
  updateCategory: (args: {
    id: Id<"equipmentCategories">;
    name: string;
  }) => Promise<unknown>;
}

function EditCategoryDialog({
  category,
  updateCategory,
}: EditCategoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category.name);

  const handleUpdate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Category name is required");
      return;
    }
    try {
      await updateCategory({ id: category._id, name: trimmed });
      toast.success("Category updated");
      setOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update category"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label
              htmlFor={`edit-category-${category._id}`}
              className="text-sm font-bold uppercase tracking-wider text-muted-foreground"
            >
              Name
            </label>
            <Input
              id={`edit-category-${category._id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
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
