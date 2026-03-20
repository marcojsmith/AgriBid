import { Check, LayoutGrid, ChevronDown } from "lucide-react";
import { useQuery, usePaginatedQuery } from "convex/react";
import { api } from "convex/_generated/api";

import { LoadingIndicator } from "@/components/LoadingIndicator";
import { Button } from "@/components/ui/button";
import { useListingWizard } from "@/hooks/listing-wizard/useListingWizard";

import { EQUIPMENT_METADATA_LIMIT } from "../../../../convex/constants";

/**
 * Technical specifications step component for the listing wizard.
 *
 * Allows users to select equipment category, make, and model from a curated catalog.
 * Selecting a category filters the available manufacturers, and selecting a manufacturer
 * filters the available models.
 *
 * @returns A JSX.Element rendering the hierarchical selection interface
 */
export const TechnicalSpecsStep = () => {
  const { formData, updateField } = useListingWizard();
  const categories = useQuery(api.auctions.getCategories);
  const {
    results: metadata,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.auctions.getEquipmentMetadata,
    {},
    { initialNumItems: EQUIPMENT_METADATA_LIMIT }
  );

  if (categories === undefined || status === "LoadingFirstPage") {
    return (
      <div className="h-[300px] flex flex-col items-center justify-center gap-4 text-muted-foreground animate-in fade-in duration-500">
        <LoadingIndicator />
        <p className="text-xs font-black uppercase tracking-widest">
          Fetching Specifications...
        </p>
      </div>
    );
  }

  // Filter makes by selected category
  const selectedCategoryMakes = metadata.filter(
    (m) => m.categoryId === formData.categoryId
  );

  const uniqueMakes: string[] = Array.from(
    new Set(selectedCategoryMakes.map((m) => m.make))
  ).sort();

  const selectedMakeData = selectedCategoryMakes.filter(
    (m) => m.make === formData.make
  );

  const availableModels: string[] = Array.from(
    new Set(selectedMakeData.flatMap((m) => m.models))
  ).sort();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Category Selection */}
      <div className="space-y-4">
        <label className="text-xs font-black uppercase text-muted-foreground ml-1">
          Select Category
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {categories.map((cat) => (
            <Button
              key={cat._id}
              variant={formData.categoryId === cat._id ? "default" : "outline"}
              onClick={() => {
                updateField("categoryId", cat._id);
                updateField("make", "");
                updateField("model", "");
              }}
              className="h-12 font-bold rounded-xl border-2 transition-all"
            >
              {cat.name}
              {formData.categoryId === cat._id && (
                <Check className="ml-2 h-4 w-4" />
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Make Selection */}
      {formData.categoryId && (
        <div className="space-y-4 pt-4 border-t border-dashed">
          <label className="text-xs font-black uppercase text-muted-foreground ml-1">
            Select Manufacturer
          </label>
          {uniqueMakes.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {uniqueMakes.map((make: string) => (
                <Button
                  key={make}
                  variant={formData.make === make ? "default" : "outline"}
                  onClick={() => {
                    updateField("make", make);
                    updateField("model", "");
                  }}
                  className="h-12 font-bold rounded-xl border-2 transition-all"
                >
                  {make}
                  {formData.make === make && <Check className="ml-2 h-4 w-4" />}
                </Button>
              ))}
            </div>
          ) : (
            <div className="bg-muted/20 p-8 rounded-2xl text-center border-2 border-dashed">
              <p className="text-muted-foreground font-medium">
                No manufacturers found for this category
              </p>
            </div>
          )}

          {(status === "CanLoadMore" || status === "LoadingMore") && (
            <div className="flex justify-center pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  loadMore(EQUIPMENT_METADATA_LIMIT);
                }}
                disabled={status === "LoadingMore"}
                className="text-[10px] font-black uppercase tracking-widest"
              >
                {status === "LoadingMore" ? (
                  <>
                    <LoadingIndicator size="sm" />
                    <span className="ml-2">Loading...</span>
                  </>
                ) : (
                  <>
                    Load More Manufacturers
                    <ChevronDown className="ml-1 h-3 w-3" />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Model Selection */}
      {formData.make && (
        <div className="space-y-4 pt-4 border-t border-dashed">
          <label className="text-xs font-black uppercase text-muted-foreground ml-1">
            Select Model
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {availableModels.map((model: string) => (
              <Button
                key={model}
                variant={formData.model === model ? "default" : "outline"}
                onClick={() => {
                  updateField("model", model);
                }}
                className="h-12 font-bold rounded-xl border-2 transition-all"
              >
                {model}
                {formData.model === model && <Check className="ml-2 h-4 w-4" />}
              </Button>
            ))}
          </div>
        </div>
      )}

      {!formData.categoryId && (
        <div className="bg-muted/30 rounded-2xl p-12 text-center border-2 border-dashed">
          <LayoutGrid className="h-10 w-10 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">
            Select a category to view available equipment catalog
          </p>
        </div>
      )}
    </div>
  );
};
