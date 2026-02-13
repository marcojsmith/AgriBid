// app/src/components/ListingWizard.tsx
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronRight, ChevronLeft, Save, Search, Check, AlertCircle, Info, TrendingUp, Camera, X, CheckCircle2 } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STEPS = [
  "General Information",
  "Technical Specifications",
  "Condition Checklist",
  "Media Gallery",
  "Pricing & Strategy",
];

const PHOTO_SLOTS = [
  { id: "front", label: "Front 45° View", desc: "Show the main profile of the equipment" },
  { id: "engine", label: "Engine Bay", desc: "Detailed shot of the engine and components" },
  { id: "cabin", label: "Instrument Cluster", desc: "Show hours and dashboard controls" },
  { id: "rear", label: "Rear / Hitch", desc: "Show hydraulics and rear assembly" },
];

interface ConditionChecklist {
  engine: boolean | null;
  hydraulics: boolean | null;
  tires: boolean | null;
  serviceHistory: boolean | null;
  notes?: string;
}

interface ListingFormData {
  year: number;
  make: string;
  model: string;
  location: string;
  operatingHours: number;
  title: string;
  conditionChecklist: ConditionChecklist;
  images: Record<string, string>; // Slot ID -> Image URL
  startingPrice: number;
  reservePrice: number;
}

const DEFAULT_FORM_DATA: ListingFormData = {
  year: new Date().getFullYear(),
  make: "",
  model: "",
  location: "",
  operatingHours: 0,
  title: "",
  conditionChecklist: {
    engine: null,
    hydraulics: null,
    tires: null,
    serviceHistory: null,
    notes: "",
  },
  images: {},
  startingPrice: 0,
  reservePrice: 0,
};

export const ListingWizard = () => {
  const metadata = useQuery(api.auctions.getEquipmentMetadata);
  const createAuction = useMutation(api.auctions.createAuction);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [formData, setFormData] = useState<ListingFormData>(() => {
    const saved = localStorage.getItem("agribid_listing_draft");
    if (!saved) return DEFAULT_FORM_DATA;
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse listing draft", e);
      localStorage.removeItem("agribid_listing_draft");
      return DEFAULT_FORM_DATA;
    }
  });

  useEffect(() => {
    localStorage.setItem("agribid_listing_draft", JSON.stringify(formData));
  }, [formData]);

  const updateField = <K extends keyof ListingFormData>(field: K, value: ListingFormData[K]) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      if (field === "make" || field === "model" || field === "year") {
        const parts = [newData.year, newData.make, newData.model].filter(Boolean);
        if (parts.length > 0) {
          newData.title = parts.join(" ");
        }
      }
      return newData;
    });
  };

  const updateChecklist = <K extends keyof ConditionChecklist>(field: K, value: ConditionChecklist[K]) => {
    setFormData((prev) => ({
      ...prev,
      conditionChecklist: {
        ...prev.conditionChecklist,
        [field]: value,
      }
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, slotId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Revoke previous URL if it exists to avoid memory leaks
    const prevUrl = formData.images[slotId];
    if (prevUrl && prevUrl.startsWith("blob:")) {
      URL.revokeObjectURL(prevUrl);
    }

    // For the prototype, we'll use a local object URL to show the image
    const imageUrl = URL.createObjectURL(file);
    
    setFormData(prev => ({
      ...prev,
      images: {
        ...prev.images,
        [slotId]: imageUrl
      }
    }));
    toast.success(`${slotId.toUpperCase()} photo added to listing`);
  };

  const removeImage = (slotId: string) => {
    const url = formData.images[slotId];
    if (url && url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
    
    setFormData(prev => {
      const newImages = { ...prev.images };
      delete newImages[slotId];
      return { ...prev, images: newImages };
    });
  };

  const validateStep = (step: number) => {
    switch (step) {
      case 0:
        return formData.year > 1900 && formData.location.length > 2 && formData.title.length > 5;
      case 1:
        return !!formData.make && !!formData.model;
      case 2:
        return formData.conditionChecklist.engine !== null &&
               formData.conditionChecklist.hydraulics !== null &&
               formData.conditionChecklist.tires !== null &&
               formData.conditionChecklist.serviceHistory !== null;
      case 3:
        return Object.keys(formData.images).length > 0;
      case 4:
        return formData.startingPrice > 0;
      default:
        return true;
    }
  };

  const next = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    } else {
      toast.error("Please complete all required fields in this step.");
    }
  };
  
  const prev = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    
    setIsSubmitting(true);
    try {
      // Convert images Record to Array for the backend schema
      const imagesArray = PHOTO_SLOTS
        .map(slot => formData.images[slot.id])
        .filter(Boolean);

      await createAuction({
        ...formData,
        images: imagesArray,
        conditionChecklist: {
          ...formData.conditionChecklist,
          engine: formData.conditionChecklist.engine ?? false,
          hydraulics: formData.conditionChecklist.hydraulics ?? false,
          tires: formData.conditionChecklist.tires ?? false,
          serviceHistory: formData.conditionChecklist.serviceHistory ?? false,
        }
      });
      
      localStorage.removeItem("agribid_listing_draft");
      setIsSuccess(true);
      toast.success("Listing submitted for review!");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="bg-card border-2 rounded-3xl p-12 text-center space-y-8 animate-in zoom-in duration-500">
        <div className="h-24 w-24 rounded-full bg-green-500/10 flex items-center justify-center mx-auto border-4 border-green-500/20">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
        </div>
        <div className="space-y-3">
          <h2 className="text-4xl font-black uppercase tracking-tight">Submission Received</h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Your machinery listing has been successfully submitted to our moderation queue.
          </p>
        </div>
        <div className="bg-muted/30 p-6 rounded-2xl border-2 border-dashed max-w-md mx-auto">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">What Happens Next?</p>
          <ul className="text-left space-y-4">
            <li className="flex gap-3 text-sm font-bold uppercase tracking-tight">
              <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">1</span>
              Technical Review (2-4 Hours)
            </li>
            <li className="flex gap-3 text-sm font-bold uppercase tracking-tight">
              <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">2</span>
              Valuation Confirmation
            </li>
            <li className="flex gap-3 text-sm font-bold uppercase tracking-tight">
              <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">3</span>
              Auction Goes Live
            </li>
          </ul>
        </div>
        <Button size="lg" className="h-14 px-12 rounded-2xl font-black text-xl shadow-xl shadow-primary/20" asChild>
          <a href="/">Return to Marketplace</a>
        </Button>
      </div>
    );
  }

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
                  onChange={(e) => updateField("year", parseInt(e.target.value) || 0)}
                  placeholder="e.g. 2023"
                  className="h-12 border-2 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-muted-foreground ml-1">Location (Area Code)</label>
                <Input 
                  value={formData.location} 
                  onChange={(e) => updateField("location", e.target.value)}
                  placeholder="e.g. PE11 2AA"
                  className="h-12 border-2 rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-muted-foreground ml-1">Listing Title</label>
              <Input 
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
              <label className="text-xs font-black uppercase text-muted-foreground ml-1">Operating Hours</label>
              <Input 
                type="number" 
                value={formData.operatingHours} 
                onChange={(e) => updateField("operatingHours", parseInt(e.target.value) || 0)}
                placeholder="e.g. 1200"
                className="h-12 border-2 rounded-xl"
              />
            </div>
          </div>
        );
      case 1: {
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
                      updateField("model", ""); 
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
      }
      case 2: {
        const checklistItems = [
          { id: "engine" as const, label: "Engine Condition", desc: "Is the engine running smoothly without leaks?" },
          { id: "hydraulics" as const, label: "Hydraulic System", desc: "Are all hydraulic cylinders and hoses in good working order?" },
          { id: "tires" as const, label: "Tires / Tracks", desc: "Do tires/tracks have more than 50% tread remaining?" },
          { id: "serviceHistory" as const, label: "Service History", desc: "Do you have complete maintenance records for this unit?" },
        ];
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-amber-50 border-2 border-amber-100 p-4 rounded-xl flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <p className="text-[11px] text-amber-900 font-bold uppercase tracking-wide leading-relaxed">
                Honesty ensures the highest final bid. Buyers value transparency above all else.
              </p>
            </div>
            
            <div className="space-y-4">
              {checklistItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 rounded-2xl border-2 bg-card">
                  <div className="space-y-0.5">
                    <p className="font-black text-sm uppercase tracking-tight">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">{item.desc}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={formData.conditionChecklist[item.id] === true ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateChecklist(item.id, true)}
                      className="rounded-lg font-bold w-16"
                    >
                      Yes
                    </Button>
                    <Button
                      variant={formData.conditionChecklist[item.id] === false ? "destructive" : "outline"}
                      size="sm"
                      onClick={() => updateChecklist(item.id, false)}
                      className="rounded-lg font-bold w-16"
                    >
                      No
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-muted-foreground ml-1">Additional Condition Notes</label>
              <textarea 
                value={formData.conditionChecklist.notes}
                onChange={(e) => updateChecklist("notes", e.target.value)}
                placeholder="Mention any recent repairs, known issues, or upgrades..."
                className="w-full min-h-[120px] p-4 rounded-xl border-2 bg-background focus:border-primary outline-none transition-colors text-sm"
              />
            </div>
          </div>
        );
      }
      case 3:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PHOTO_SLOTS.map((slot) => {
                const imageUrl = formData.images[slot.id];
                
                return (
                  <div 
                    key={slot.id} 
                    className={cn(
                      "relative group aspect-video rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-4 transition-all overflow-hidden",
                      imageUrl ? "border-primary/40 bg-muted" : "border-muted-foreground/20 hover:border-primary/40 hover:bg-primary/5"
                    )}
                  >
                    {imageUrl ? (
                      <>
                        <img src={imageUrl} alt={slot.label} className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={() => removeImage(slot.id)}
                            className="rounded-xl font-bold gap-2"
                          >
                            <X className="h-4 w-4" />
                            Remove
                          </Button>
                        </div>
                        <div className="absolute bottom-2 left-2 bg-background/80 backdrop-blur px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                          <Check className="h-3 w-3 text-green-600" />
                          {slot.label}
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          id={`file-upload-${slot.id}`}
                          onChange={(e) => handleImageUpload(e, slot.id)}
                        />
                        <label 
                          htmlFor={`file-upload-${slot.id}`}
                          className="w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer outline-none"
                        >
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Camera className="h-6 w-6 text-primary" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-black uppercase tracking-tight">{slot.label}</p>
                            <p className="text-[10px] text-muted-foreground font-medium uppercase">{slot.desc}</p>
                          </div>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {Object.keys(formData.images).length < PHOTO_SLOTS.length && (
              <div className="bg-primary/5 p-4 rounded-xl flex items-center gap-3 border border-primary/10">
                <Info className="h-5 w-5 text-primary shrink-0" />
                <p className="text-[10px] font-black uppercase tracking-wide text-primary">
                  Upload {PHOTO_SLOTS.length - Object.keys(formData.images).length} more photos to provide the best detail for buyers.
                </p>
              </div>
            )}
          </div>
        );
      case 4:
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-muted-foreground ml-1">Starting Price (R)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-lg">R</span>
                    <Input 
                      type="number" 
                      value={formData.startingPrice} 
                      onChange={(e) => updateField("startingPrice", parseInt(e.target.value) || 0)}
                      className="h-14 pl-10 text-xl font-black rounded-xl border-2"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase px-1">
                    The price at which bidding will begin.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-muted-foreground ml-1">Reserve Price (R)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-lg">R</span>
                    <Input 
                      type="number" 
                      value={formData.reservePrice} 
                      onChange={(e) => updateField("reservePrice", parseInt(e.target.value) || 0)}
                      className="h-14 pl-10 text-xl font-black rounded-xl border-2 border-primary/20"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase px-1">
                    The minimum price you are willing to accept.
                  </p>
                </div>
              </div>

              <div className="bg-primary/5 border-2 border-primary/10 rounded-3xl p-6 space-y-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h3 className="font-black uppercase tracking-tight">Pricing Strategy</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground font-bold uppercase text-[10px]">Market Confidence</span>
                    <Badge className="bg-green-500 hover:bg-green-600 font-black uppercase text-[10px]">High</Badge>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 w-[85%]" />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Based on recent auctions for <strong>{formData.year} {formData.make} {formData.model}</strong>, items with verified service history often sell for 15% more than average.
                  </p>
                </div>

                <div className="pt-4 border-t border-dashed border-primary/20">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Info className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-primary">
                      Our recommendation: Set a lower starting price to encourage a "bidding war" early in the auction.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
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
          disabled={currentStep === 0 || isSubmitting}
          className="h-12 px-6 rounded-xl font-bold border-2 gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        
        {currentStep === STEPS.length - 1 ? (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !validateStep(currentStep)}
            className="h-14 px-12 rounded-xl font-black text-xl gap-2 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 transition-all scale-105"
          >
            {isSubmitting ? "Submitting..." : "Submit Listing"}
            {!isSubmitting && <Check className="h-6 w-6" />}
          </Button>
        ) : (
          <Button
            onClick={next}
            className="h-12 px-8 rounded-xl font-black text-lg gap-2 shadow-lg shadow-primary/20"
          >
            Next Step
            <ChevronRight className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
};
