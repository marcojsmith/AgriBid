import type { Id } from "convex/_generated/dataModel";

/**
 * Fields collected by the "add make" dialog.
 */
export interface NewMakeForm {
  make: string;
  categoryId: Id<"equipmentCategories"> | "";
  initialModel: string;
}

/**
 * Fields collected by the "edit make" dialog.
 */
export interface EditMakeForm {
  make: string;
  categoryId: Id<"equipmentCategories"> | "";
}

/**
 * Validates the "add make" form, which requires a name, a category and at
 * least one initial model.
 *
 * @param form - Current form values.
 * @returns An error message, or `null` when the form is valid.
 */
export function validateNewMake(form: NewMakeForm): string | null {
  if (!form.make || !form.categoryId || !form.initialModel) {
    return "All fields are required";
  }
  return null;
}

/**
 * Validates the "edit make" form.
 *
 * @param form - Current form values.
 * @returns An error message, or `null` when the form is valid.
 */
export function validateEditedMake(form: EditMakeForm): string | null {
  if (!form.make.trim()) {
    return "Manufacturer name is required";
  }
  if (!form.categoryId) {
    return "Category is required";
  }
  return null;
}

/**
 * Validates a model name before it is added or removed.
 *
 * @param model - The entered model name.
 * @returns An error message, or `null` when the name is usable.
 */
export function validateModelName(model: string): string | null {
  return model.trim() ? null : "Model name is required";
}

/**
 * Formats a make's last-updated timestamp for the meta bar.
 *
 * @param updatedAt - Milliseconds since the epoch, or `undefined` when never updated.
 * @returns The locale date, or "Never" when the make has never been updated.
 */
export function formatLastUpdated(updatedAt: number | undefined): string {
  return updatedAt ? new Date(updatedAt).toLocaleDateString() : "Never";
}
