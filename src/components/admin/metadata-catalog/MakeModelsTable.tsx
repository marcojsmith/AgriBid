import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { EquipmentMetadata, RemoveModelMutation } from "./types";

/**
 * Props for the {@link MakeModelsTable} component.
 */
interface MakeModelsTableProps {
  item: EquipmentMetadata;
  removeModel: RemoveModelMutation;
}

/**
 * Table of the models belonging to one make, with a remove action per row.
 *
 * @param props - Component props.
 * @param props.item - The make whose models are listed.
 * @param props.removeModel - Mutation that removes a model.
 * @returns The models table.
 */
export function MakeModelsTable({ item, removeModel }: MakeModelsTableProps) {
  const handleRemove = async (model: string) => {
    if (!confirm(`Remove model "${model}" from ${item.make}?`)) {
      return;
    }
    try {
      await removeModel({ id: item._id, model });
      toast.success("Model removed");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove model"
      );
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Model Name</TableHead>
          <TableHead className="text-right w-24">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {item.models.map((model: string, index: number) => (
          <TableRow key={`${item._id}-${model}-${String(index)}`}>
            <TableCell className="font-medium">{model}</TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                aria-label={`Remove model ${model} from ${item.make}`}
                onClick={() => handleRemove(model)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
