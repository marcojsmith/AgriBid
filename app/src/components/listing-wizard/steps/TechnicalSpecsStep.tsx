import { Check, Search, ChevronDown } from "lucide-react";
import { usePaginatedQuery } from "convex/react";
import { api } from "convex/_generated/api";

import { LoadingIndicator } from "@/components/LoadingIndicator";
import { Button } from "@/components/ui/button";

import { useListingWizard } from "../hooks/useListingWizard";
import { EQUIPMENT_METADATA_LIMIT } from "../../../../convex/constants";

/**
 * Technical specifications step component for the listing wizard.
 *
 * Allows users to select equipment make, model, and view technical specifications.
 *
 * @returns A JSX.Element rendering the technical specs selection interface
 */
export const TechnicalSpecsStep = () => {
  const { formData, updateField } = useListingWizard();
  const {
    results: metadata,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.auctions.getEquipmentMetadata,
    {},
    { initialNumItems: EQUIPMENT_METADATA_LIMIT }
  );

  if (status === "LoadingFirstPage") {
    return (
      <div className="h-[300px] flex flex-col items-center justify-center gap-4 text-muted-foreground animate-in fade-in duration-500">
        <LoadingIndicator />
        <p className="text-xs font-black uppercase tracking-widest">
          Fetching Specifications...
        </p>
      </div>
    );
  }

  const uniqueMakes = Array.from(new Set(metadata.map((m) => m.make))).sort();
  const selectedMakeData = metadata.filter((m) => m.make === formData.make);
  const availableModels = Array.from(
    new Set(selectedMakeData.flatMap((m) => m.models))
  ).sort();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="space-y-4">
        <label className="text-xs font-black uppercase text-muted-foreground ml-1">
          Select Manufacturer
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {uniqueMakes.map((make) => (
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

        {(status === "CanLoadMore" || status === "LoadingMore") && (
          <div className="flex justify-center pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadMore(EQUIPMENT_METADATA_LIMIT)}
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

      {formData.make && (
        <div className="space-y-4 pt-4 border-t border-dashed">
          <label className="text-xs font-black uppercase text-muted-foreground ml-1">
            Select Model
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {availableModels.map((model) => (
              <Button
                key={model}
                variant={formData.model === model ? "default" : "outline"}
                onClick={() => updateField("model", model)}
                className="h-12 font-bold rounded-xl border-2 transition-all"
              >
                {model}
                {formData.model === model && <Check className="ml-2 h-4 w-4" />}
              </Button>
            ))}
          </div>
        </div>
      )}

      {!formData.make && (
        <div className="bg-muted/30 rounded-2xl p-12 text-center border-2 border-dashed">
          <Search className="h-10 w-10 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">
            Select a manufacturer to view available models
          </p>
        </div>
      )}
    </div>
  );
};
