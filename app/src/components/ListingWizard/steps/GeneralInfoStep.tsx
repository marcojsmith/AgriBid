import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { useListingWizard } from "../context/ListingWizardContext";
import { SA_LOCATIONS } from "../constants";

export const GeneralInfoStep = () => {
  const { formData, updateField } = useListingWizard();
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);

  const filteredLocations = useMemo(() => 
    SA_LOCATIONS.filter(loc => 
      loc.toLowerCase().includes(formData.location.toLowerCase()) && 
      formData.location.length > 1
    ),
    [formData.location]
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label htmlFor="year" className="text-xs font-black uppercase text-muted-foreground ml-1">Manufacturing Year</label>
          <Input 
            id="year"
            type="number" 
            inputMode="numeric"
            value={formData.year || ""} 
            onChange={(e) => {
              const val = e.target.value;
              if (val === "") {
                updateField("year", 0);
                return;
              }
              const parsed = parseInt(val);
              if (!isNaN(parsed)) {
                updateField("year", parsed);
              }
            }}
            placeholder={`e.g. ${new Date().getFullYear()}`}
            className="h-12 border-2 rounded-xl"
          />
        </div>
        <div className="space-y-2 relative">
          <label htmlFor="location" className="text-xs font-black uppercase text-muted-foreground ml-1">Location (Town / City / Country)</label>
          <Input 
            id="location"
            value={formData.location} 
            onChange={(e) => {
              updateField("location", e.target.value);
              setShowLocationSuggestions(true);
            }}
            onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
            placeholder="e.g. Johannesburg, ZA or Gaborone, BW"
            className="h-12 border-2 rounded-xl"
          />
          {showLocationSuggestions && filteredLocations.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-card border-2 rounded-xl shadow-xl max-h-48 overflow-y-auto">
              {filteredLocations.map(loc => (
                <button
                  key={loc}
                  className="w-full px-4 py-3 text-left hover:bg-primary/10 font-bold text-sm border-b last:border-0 transition-colors"
                  onClick={() => {
                    updateField("location", loc);
                    setShowLocationSuggestions(false);
                  }}
                >
                  {loc}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="title" className="text-xs font-black uppercase text-muted-foreground ml-1">Listing Title</label>
        <Input 
          id="title"
          value={formData.title} 
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="e.g. 2023 John Deere 6155R Premium"
          className="h-12 border-2 rounded-xl"
        />
        <p className="text-[10px] text-muted-foreground font-medium uppercase px-1 italic">
          Pro-tip: Include Year, Make, and Model for better search results.
        </p>
      </div>
      <div className="space-y-2">
        <label htmlFor="hours" className="text-xs font-black uppercase text-muted-foreground ml-1">Operating Hours</label>
        <Input 
          id="hours"
          type="number" 
          inputMode="numeric"
          value={formData.operatingHours || ""} 
          onChange={(e) => updateField("operatingHours", parseInt(e.target.value) || 0)}
          placeholder="e.g. 1200"
          className="h-12 border-2 rounded-xl"
        />
      </div>
    </div>
  );
};
