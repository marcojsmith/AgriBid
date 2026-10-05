import type { Doc, Id } from "convex/_generated/dataModel";

/**
 * An equipment category row.
 */
export type Category = Doc<"equipmentCategories">;

/**
 * An equipment make (manufacturer) with its models and resolved category name.
 */
export type EquipmentMetadata = Doc<"equipmentMetadata"> & {
  categoryName: string;
};

/**
 * Creates a make with an initial model and a category.
 */
export type AddMakeMutation = (args: {
  make: string;
  models: string[];
  categoryId: Id<"equipmentCategories">;
}) => Promise<unknown>;

/**
 * Updates a make's name, category, models or active status.
 */
export type UpdateMakeMutation = (args: {
  id: Id<"equipmentMetadata">;
  make: string;
  categoryId: Id<"equipmentCategories">;
  models: string[];
  isActive?: boolean;
}) => Promise<unknown>;

/**
 * Deactivates a make.
 */
export type DeleteMakeMutation = (args: {
  id: Id<"equipmentMetadata">;
}) => Promise<unknown>;

/**
 * Adds a model to an existing make.
 */
export type AddModelMutation = (args: {
  id: Id<"equipmentMetadata">;
  model: string;
}) => Promise<unknown>;

/**
 * Removes a model from an existing make.
 */
export type RemoveModelMutation = (args: {
  id: Id<"equipmentMetadata">;
  model: string;
}) => Promise<unknown>;

/**
 * Props for the MetadataCatalog component.
 */
export interface MetadataCatalogProps {
  metadata: EquipmentMetadata[];
  categories: Category[];
  addMake: AddMakeMutation;
  updateMake: UpdateMakeMutation;
  deleteMake: DeleteMakeMutation;
  addModel: AddModelMutation;
  removeModel: RemoveModelMutation;
}
