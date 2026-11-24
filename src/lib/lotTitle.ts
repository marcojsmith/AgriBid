/** The fields of a lot the display title is built from. */
export interface LotTitleParts {
  make: string;
  model: string;
  title?: string;
}

/**
 * The title shown for a lot: "Make Model" when the model is known, else the
 * lot's own title (imported lots often have no parsed model), else the make.
 *
 * @param lot - The lot's make, model and title
 * @returns The display title
 */
export function lotTitle(lot: LotTitleParts): string {
  const model = lot.model.trim();
  if (model !== "") return `${lot.make} ${model}`.trim();
  const title = lot.title?.trim();
  return title && title !== "" ? title : lot.make;
}

/**
 * The title with the model year in front when it is known ("2016 John Deere
 * 8370RT"), as used on the featured-lot photo and the cost-box example.
 *
 * @param lot - The lot's year, make, model and title
 * @returns The display title
 */
export function lotTitleWithYear(
  lot: LotTitleParts & { year: number }
): string {
  const title = lotTitle(lot);
  return lot.year > 0 ? `${String(lot.year)} ${title}` : title;
}
