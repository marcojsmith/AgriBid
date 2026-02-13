// app/src/components/ListingWizard.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronRight, ChevronLeft, Save, Search, Check } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";

const STEPS = [
  "General Information",
  "Technical Specifications",
  "Condition Checklist",
  "Media Gallery",
  "Pricing & Strategy",
];

export const ListingWizard = () => {
  const metadata = useQuery(api.auctions.getEquipmentMetadata);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem("agribid_listing_draft");
    return saved ? JSON.parse(saved) : {
      year: new Date().getFullYear(),
      make: "",
      model: "",
      location: "",
      operatingHours: 0,
      title: "",
      conditionChecklist: {
        engine: false,
        hydraulics: false,
        tires: false,
        serviceHistory: false,
        notes: "",
      },
      images: [],
      startingPrice: 0,
      reservePrice: 0,
    };
  });

  useEffect(() => {
    localStorage.setItem("agribid_listing_draft", JSON.stringify(formData));
  }, [formData]);

  const updateField = (field: string, value: any) => {
    setFormData((prev: any) => {
      const newData = { ...prev, [field]: value };
      
      // Auto-update title if it's empty or looks like a default title
      if (field === "make" || field === "model" || field === "year") {
        const parts = [newData.year, newData.make, newData.model].filter(Boolean);
        if (parts.length > 0) {
          newData.title = parts.join(" ");
        }
      }
      
      return newData;
    });
  };

  const next = () => setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  const prev = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-muted-foreground ml-1">Manufacturing Year</label>
                <Input 
                  type="number" 
                  value={formData.year} 
                  onChange={(e) => updateField("year", parseInt(e.target.value))}
                  placeholder="e.g. 2022"
                  className="h-12 border-2 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-muted-foreground ml-1">Location (Area Code)</label>
                <Input 
                  value={formData.location} 
                  onChange={(e) => updateField("location", e.target.value)}
                  placeholder="e.g. NG1 1AA"
                  className="h-12 border-2 rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-muted-foreground ml-1">Listing Title</label>
              <Input 
                value={formData.title} 
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="e.g. 2022 John Deere 6155R Premium"
                className="h-12 border-2 rounded-xl"
              />
              <p className="text-[10px] text-muted-foreground font-medium uppercase px-1 italic">
                Pro-tip: Include Year, Make, and Model for better search results.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-muted-foreground ml-1">Operating Hours</label>
              <Input 
                type="number" 
                value={formData.operatingHours} 
                onChange={(e) => updateField("operatingHours", parseInt(e.target.value))}
                placeholder="e.g. 1200"
                className="h-12 border-2 rounded-xl"
              />
            </div>
          </div>
        );
      case 1:
        const selectedMake = metadata?.find(m => m.make === formData.make);
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-4">
              <label className="text-xs font-black uppercase text-muted-foreground ml-1">Select Manufacturer</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {metadata?.map((item) => (
                  <Button
                    key={item.make}
                    variant={formData.make === item.make ? "default" : "outline"}
                    onClick={() => {
                      updateField("make", item.make);
                      updateField("model", ""); // Reset model when make changes
                    }}
                    className="h-12 font-bold rounded-xl border-2 transition-all"
                  >
                    {item.make}
                    {formData.make === item.make && <Check className="ml-2 h-4 w-4" />}
                  </Button>
                ))}
              </div>
            </div>

            {formData.make && (
              <div className="space-y-4 pt-4 border-t border-dashed">
                <label className="text-xs font-black uppercase text-muted-foreground ml-1">Select Model</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {selectedMake?.models.map((model) => (
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
                <p className="text-muted-foreground font-medium">Select a manufacturer to view available models</p>
              </div>
            )}
          </div>
        );
      default:
        return (
          <div className="text-center py-20 bg-muted/20 rounded-2xl border-2 border-dashed border-primary/10 animate-in fade-in duration-500">
            <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🏗️</span>
            </div>
            <p className="font-black text-lg uppercase tracking-tight">{STEPS[currentStep]} Under Construction</p>
            <p className="text-muted-foreground text-sm uppercase tracking-widest font-bold">Coming in the next phase</p>
          </div>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Progress Indicator */}
      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <p className="text-xs font-black text-primary uppercase tracking-[0.2em]">Step {currentStep + 1} of {STEPS.length}</p>
            <h2 className="text-2xl font-black uppercase tracking-tight">{STEPS[currentStep]}</h2>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Save className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Draft Saved</span>
          </div>
        </div>
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-card border-2 rounded-2xl p-8 min-h-[450px]">
        {renderStep()}
      </div>

      {/* Navigation Controls */}
      <div className="flex justify-between items-center pt-4">
        <Button
          variant="outline"
          onClick={prev}
          disabled={currentStep === 0}
          className="h-12 px-6 rounded-xl font-bold border-2 gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button
          onClick={next}
          disabled={currentStep === STEPS.length - 1}
          className="h-12 px-8 rounded-xl font-black text-lg gap-2 shadow-lg shadow-primary/20"
        >
          Next Step
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};
