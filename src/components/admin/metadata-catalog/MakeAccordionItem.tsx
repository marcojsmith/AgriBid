import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { AddModelDialog } from "./AddModelDialog";
import { EditMakeDialog } from "./EditMakeDialog";
import { MakeModelsTable } from "./MakeModelsTable";
import { formatLastUpdated } from "./metadataHelpers";
import type {
  AddModelMutation,
  Category,
  DeleteMakeMutation,
  EquipmentMetadata,
  RemoveModelMutation,
  UpdateMakeMutation,
} from "./types";

/**
 * Props for the {@link MakeAccordionItem} component.
 */
interface MakeAccordionItemProps {
  item: EquipmentMetadata;
  categories: Category[];
  updateMake: UpdateMakeMutation;
  deleteMake: DeleteMakeMutation;
  addModel: AddModelMutation;
  removeModel: RemoveModelMutation;
}

/**
 * One manufacturer in the catalog accordion: header with category and status
 * badges, edit/deactivate actions, and the make's model table.
 *
 * @param props - Component props.
 * @param props.item - The make to display.
 * @param props.categories - Categories offered by the edit dialog.
 * @param props.updateMake - Mutation that saves or reactivates a make.
 * @param props.deleteMake - Mutation that deactivates a make.
 * @param props.addModel - Mutation that adds a model.
 * @param props.removeModel - Mutation that removes a model.
 * @returns The accordion item for one make.
 */
export function MakeAccordionItem({
  item,
  categories,
  updateMake,
  deleteMake,
  addModel,
  removeModel,
}: MakeAccordionItemProps) {
  const handleDeactivate = async () => {
    if (!confirm(`Deactivate manufacturer "${item.make}"?`)) {
      return;
    }
    try {
      await deleteMake({ id: item._id });
      toast.success("Manufacturer deactivated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deactivate");
    }
  };

  const handleReactivate = async () => {
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
      toast.error(err instanceof Error ? err.message : "Failed to reactivate");
    }
  };

  return (
    <AccordionItem
      value={item._id}
      className={`border rounded-md px-4 ${!item.isActive ? "bg-muted/50 grayscale-[0.5]" : "bg-card"}`}
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
          {!item.isActive && <Badge variant="secondary">Inactive</Badge>}
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-4 space-y-4">
        <div className="flex flex-wrap gap-2 justify-between items-center bg-muted/30 p-3 rounded-lg">
          <div className="text-sm text-muted-foreground">
            <span className="font-bold">ID:</span> {item._id} |
            <span className="font-bold ml-2">Last Updated:</span>{" "}
            {formatLastUpdated(item.updatedAt)}
          </div>
          <div className="flex gap-2">
            <EditMakeDialog
              key={`${item._id}-${String(item.updatedAt ?? "")}`}
              item={item}
              categories={categories}
              updateMake={updateMake}
            />
            {item.isActive ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeactivate}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Deactivate
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={handleReactivate}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reactivate
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-semibold text-muted-foreground">
              Models
            </h4>
            <AddModelDialog makeId={item._id} addModel={addModel} />
          </div>
          <MakeModelsTable item={item} removeModel={removeModel} />
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
