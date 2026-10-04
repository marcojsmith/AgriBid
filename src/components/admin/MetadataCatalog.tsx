import { Hammer } from "lucide-react";

import { Accordion } from "@/components/ui/accordion";

import { AddMakeDialog } from "./metadata-catalog/AddMakeDialog";
import { MakeAccordionItem } from "./metadata-catalog/MakeAccordionItem";
import type { MetadataCatalogProps } from "./metadata-catalog/types";

/**
 * Component for displaying and managing the equipment metadata catalog.
 * Provides an accordion view of manufacturers and their models, with actions to add, edit, and deactivate.
 *
 * @param root0 - Component props
 * @param root0.metadata - Equipment metadata records (makes with their models and resolved category names) shown in the accordion
 * @param root0.categories - Equipment categories selectable when adding or editing a make
 * @param root0.addMake - Mutation to create a new make with an initial model and category
 * @param root0.updateMake - Mutation to update a make's name, category, models, or active status
 * @param root0.deleteMake - Mutation to deactivate a make, called with its id
 * @param root0.addModel - Mutation to add a model to an existing make
 * @param root0.removeModel - Mutation to remove a model from an existing make
 * @returns The rendered metadata catalog interface
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
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold tracking-tight">Makes & Models</h3>
        <AddMakeDialog categories={categories} addMake={addMake} />
      </div>

      {metadata.length === 0 ? (
        <div className="bg-muted/30 rounded-md p-12 text-center border border-dashed">
          <Hammer className="h-10 w-10 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">
            No equipment makes found matching your search.
          </p>
        </div>
      ) : (
        <Accordion type="single" collapsible className="w-full space-y-2">
          {metadata.map((item) => (
            <MakeAccordionItem
              key={item._id}
              item={item}
              categories={categories}
              updateMake={updateMake}
              deleteMake={deleteMake}
              addModel={addModel}
              removeModel={removeModel}
            />
          ))}
        </Accordion>
      )}
    </div>
  );
}
