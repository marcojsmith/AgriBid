// app/src/components/ListingWizard.tsx
import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronRight, ChevronLeft, Save, Search, Check, AlertCircle, Info, TrendingUp, Camera, X, CheckCircle2, Plus } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STEPS = [
  "General Information",
  "Technical Specifications",
  "Condition Checklist",
  "Media Gallery",
  "Pricing & Duration",
  "Review & Submit",
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
  images: {
    front?: string;
    engine?: string;
    cabin?: string;
    rear?: string;
    additional: string[];
  };
  startingPrice: number;
  reservePrice: number;
  durationDays: number;
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
  images: {
    additional: [],
  },
  startingPrice: 0,
  reservePrice: 0,
  durationDays: 7,
};

const SA_LOCATIONS = [
  "Johannesburg, ZA", "Cape Town, ZA", "Durban, ZA", "Pretoria, ZA", "Port Elizabeth, ZA",
  "Bloemfontein, ZA", "East London, ZA", "Sandton, ZA", "Soweto, ZA", "Polokwane, ZA",
  "Nelspruit, ZA", "Kimberley, ZA", "George, ZA", "Pietermaritzburg, ZA", "Paarl, ZA",
  "Gaborone, BW", "Windhoek, NA", "Maputo, MZ", "Harare, ZW", "Maseru, LS", "Mbabane, SZ"
].sort();

export const ListingWizard = () => {
  const metadata = useQuery(api.auctions.getEquipmentMetadata);
  const createAuction = useMutation(api.auctions.createAuction);
  const generateUploadUrl = useMutation(api.auctions.generateUploadUrl);
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<ListingFormData>(() => {
    const saved = localStorage.getItem("agribid_listing_draft");
    if (!saved) return DEFAULT_FORM_DATA;
    try {
      const parsed = JSON.parse(saved);
      // Basic migration/validation: if images is an array or missing 'additional', reset
      if (Array.isArray(parsed.images) || !parsed.images?.additional) {
        return DEFAULT_FORM_DATA;
      }
      return parsed;
    } catch (e) {
      console.error("Failed to parse listing draft", e);
      localStorage.removeItem("agribid_listing_draft");
      return DEFAULT_FORM_DATA;
    }
  });

  const filteredLocations = useMemo(() => 
    SA_LOCATIONS.filter(loc => 
      loc.toLowerCase().includes(formData.location.toLowerCase()) && 
      formData.location.length > 1
    ),
    [formData.location]
  );

  const imagesRef = useRef(formData.images);
  const previewsRef = useRef(previews);

  useEffect(() => {
    imagesRef.current = formData.images;
  }, [formData.images]);

  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  // Unmount cleanup for all blob URLs
  useEffect(() => {
    return () => {
      const images = imagesRef.current;
      const currentPreviews = previewsRef.current;

      // Revoke from images state
      if (images && typeof images === 'object' && !Array.isArray(images)) {
        const { additional, ...slots } = images;
        const allUrls = [...Object.values(slots), ...(additional || [])];
        allUrls.forEach(url => {
          if (typeof url === "string" && url.startsWith("blob:")) {
            URL.revokeObjectURL(url);
          }
        });
      }

      // Revoke from previews state
      Object.values(currentPreviews).forEach(url => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
    };
  }, []);

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, slotId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create local preview immediately
    const blobUrl = URL.createObjectURL(file);
    if (slotId !== "additional") {
      setPreviews(prev => ({ ...prev, [slotId]: blobUrl }));
    }

    try {
      setUploadingSlot(slotId);
      const postUrl = await generateUploadUrl();
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) {
        throw new Error(`Upload failed: ${result.statusText}`);
      }

      const { storageId } = await result.json();

      setFormData(prev => {
        const currentImages = prev.images || { additional: [] };
        if (slotId === "additional") {
          return {
            ...prev,
            images: {
              ...currentImages,
              additional: [...(currentImages.additional || []), storageId]
            }
          };
        }
        return {
          ...prev,
          images: {
            ...currentImages,
            [slotId]: storageId
          }
        };
      });

      // For additional photos, we track previews by storageId after upload
      if (slotId === "additional") {
        setPreviews(prev => ({ ...prev, [storageId]: blobUrl }));
      }

      toast.success(`${slotId.toUpperCase()} photo uploaded`);
    } catch (error) {
      console.error(error);
      URL.revokeObjectURL(blobUrl);
      if (slotId !== "additional") {
        setPreviews(prev => {
          const next = { ...prev };
          delete next[slotId];
          return next;
        });
      }
      toast.error("Upload failed");
    } finally {
      setUploadingSlot(null);
    }
  };

  const removeImage = (slotId: string, index?: number) => {
    setFormData(prev => {
      const newImages = { ...prev.images };
      if (slotId === "additional" && typeof index === "number") {
        const storageId = newImages.additional[index];
        newImages.additional = newImages.additional.filter((_, i) => i !== index);
        
        // Cleanup preview
        setPreviews(prevP => {
          const next = { ...prevP };
          if (next[storageId]) {
            URL.revokeObjectURL(next[storageId]);
            delete next[storageId];
          }
          return next;
        });
      } else {
        const key = slotId as keyof Omit<ListingFormData["images"], "additional">;
        delete newImages[key];

        // Cleanup preview
        setPreviews(prevP => {
          const next = { ...prevP };
          if (next[slotId]) {
            URL.revokeObjectURL(next[slotId]);
            delete next[slotId];
          }
          return next;
        });
      }
      return { ...prev, images: newImages };
    });
  };

  const getStepError = (step: number): string | null => {
    switch (step) {
      case 0:
        if (formData.year <= 1900) return "Please enter a valid manufacturing year.";
        if (formData.location.length <= 2) return "Please enter a valid location.";
        if (formData.title.length <= 5) return "Please enter a more descriptive title.";
        return null;
      case 1:
        if (!formData.make) return "Please select a manufacturer.";
        if (!formData.model) return "Please select a model.";
        return null;
      case 2:
        if (formData.conditionChecklist.engine === null) return "Please specify the engine condition.";
        if (formData.conditionChecklist.hydraulics === null) return "Please specify the hydraulics condition.";
        if (formData.conditionChecklist.tires === null) return "Please specify the tires condition.";
        if (formData.conditionChecklist.serviceHistory === null) return "Please specify the service history.";
        return null;
      case 3: {
        const { additional, ...slots } = formData.images;
        const hasImages = Object.values(slots).some(Boolean) || (additional && additional.length > 0);
        return hasImages ? null : "Please upload at least one photo of the equipment.";
      }
      case 4:
        if (formData.startingPrice <= 0) return "Starting price must be greater than R 0.";
        if (formData.reservePrice !== 0 && formData.reservePrice < formData.startingPrice) {
          return "Reserve price cannot be lower than the starting price.";
        }
        if (formData.durationDays <= 0) return "Please select an auction duration.";
        return null;
      default:
        return null;
    }
  };

  const next = () => {
    const error = getStepError(currentStep);
    if (!error) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    } else {
      toast.error(error);
    }
  };
  
  const prev = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const handleSubmit = async () => {
    const error = getStepError(currentStep);
    if (error) {
      toast.error(error);
      return;
    }
    
    setIsSubmitting(true);
    try {
      await createAuction({
        title: formData.title,
        make: formData.make,
        model: formData.model,
        year: formData.year,
        operatingHours: formData.operatingHours,
        location: formData.location,
        startingPrice: formData.startingPrice,
        reservePrice: formData.reservePrice,
        images: formData.images,
        durationDays: formData.durationDays,
        conditionChecklist: {
          engine: formData.conditionChecklist.engine ?? false,
          hydraulics: formData.conditionChecklist.hydraulics ?? false,
          tires: formData.conditionChecklist.tires ?? false,
          serviceHistory: formData.conditionChecklist.serviceHistory ?? false,
          notes: formData.conditionChecklist.notes,
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

  const renderReviewStep = () => {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="bg-primary/5 border-2 border-primary/10 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Info className="h-5 w-5 text-primary" />
            <h3 className="font-black uppercase tracking-tight">Listing Summary</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground">Title</p>
                <p className="font-bold">{formData.title}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground">Make/Model</p>
                  <p className="font-bold">{formData.make} {formData.model}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground">Year</p>
                  <p className="font-bold">{formData.year}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground">Hours</p>
                  <p className="font-bold">{formData.operatingHours} hrs</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground">Location</p>
                  <p className="font-bold">{formData.location}</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground">Starting Price</p>
                  <p className="font-bold text-primary">R {formData.startingPrice.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground">Reserve Price</p>
                  <p className="font-bold">R {formData.reservePrice.toLocaleString()}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground">Duration</p>
                <p className="font-bold">{formData.durationDays} Days</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground">Condition Checklist</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.entries(formData.conditionChecklist).map(([key, value]) => {
                    if (key === "notes" || value === null) return null;
                    return (
                      <Badge key={key} variant={value ? "default" : "destructive"} className="uppercase text-[9px] font-black">
                        {key}: {value ? "YES" : "NO"}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase text-muted-foreground ml-1">Media Gallery Preview</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {PHOTO_SLOTS.map(slot => {
              const storageId = formData.images[slot.id as keyof Omit<ListingFormData["images"], "additional">];
              // Backward compatibility: Check if stored ID is a legacy HTTP URL
              const previewUrl = previews[slot.id] || (storageId?.startsWith("http") ? storageId : null);
              
              return (
                <div key={slot.id} className="aspect-video rounded-xl border-2 overflow-hidden bg-muted relative group shadow-sm">
                  {storageId ? (
                    <div className="w-full h-full flex items-center justify-center bg-primary/5">
                      {previewUrl ? (
                        <img src={previewUrl} alt={slot.label} className="w-full h-full object-cover" />
                      ) : (
                        <CheckCircle2 className="h-8 w-8 text-primary/40" />
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center opacity-20">
                      <Camera className="h-6 w-6" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[8px] font-black uppercase p-1.5 text-center backdrop-blur-sm">
                    {slot.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
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
          <Link to="/">Return to Marketplace</Link>
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
                <label htmlFor="year" className="text-xs font-black uppercase text-muted-foreground ml-1">Manufacturing Year</label>
                <Input 
                  id="year"
                  type="number" 
                  inputMode="numeric"
                  value={formData.year || ""} 
                  onChange={(e) => updateField("year", parseInt(e.target.value) || 0)}
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
      case 1: {
        const uniqueMakes = Array.from(new Set(metadata?.map((m) => m.make))).sort();
        const selectedMakeData = metadata?.filter((m) => m.make === formData.make);
        const availableModels = Array.from(new Set(selectedMakeData?.flatMap((m) => m.models))).sort();

        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-4">
              <label className="text-xs font-black uppercase text-muted-foreground ml-1">Select Manufacturer</label>
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
            </div>

            {formData.make && (
              <div className="space-y-4 pt-4 border-t border-dashed">
                <label className="text-xs font-black uppercase text-muted-foreground ml-1">Select Model</label>
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
                const storageId = formData.images[slot.id as keyof Omit<ListingFormData["images"], "additional">];
                // Backward compatibility: Check if stored ID is a legacy HTTP URL
                const previewUrl = previews[slot.id] || (storageId?.startsWith("http") ? storageId : null);
                
                return (
                  <div 
                    key={slot.id} 
                    className={cn(
                      "relative group aspect-video rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-4 transition-all overflow-hidden",
                      storageId ? "border-primary/40 bg-muted" : "border-muted-foreground/20 hover:border-primary/40 hover:bg-primary/5"
                    )}
                  >
                    {storageId ? (
                      <>
                        <div className="absolute inset-0 flex items-center justify-center bg-primary/5">
                          {previewUrl ? (
                            <img src={previewUrl} alt={slot.label} className="w-full h-full object-cover" />
                          ) : (
                            <CheckCircle2 className="h-12 w-12 text-primary/40" />
                          )}
                        </div>
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
                        <div className="absolute bottom-2 left-2 bg-background/80 backdrop-blur px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                          <Check className="h-3 w-3 text-green-600" />
                          {slot.label} (UPLOADED)
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
                          disabled={!!uploadingSlot}
                        />
                        <label 
                          htmlFor={`file-upload-${slot.id}`}
                          className={cn(
                            "w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer outline-none",
                            uploadingSlot === slot.id && "animate-pulse"
                          )}
                        >
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                            {uploadingSlot === slot.id ? (
                              <TrendingUp className="h-6 w-6 text-primary" />
                            ) : (
                              <Camera className="h-6 w-6 text-primary" />
                            )}
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-black uppercase tracking-tight">
                              {uploadingSlot === slot.id ? "Uploading..." : slot.label}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-medium uppercase">{slot.desc}</p>
                          </div>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="space-y-4">
              <label className="text-xs font-black uppercase text-muted-foreground ml-1">Additional Photos (Optional)</label>
              <div className="flex flex-wrap gap-4">
                {formData.images.additional.map((id, index) => {
                  const previewUrl = previews[id] || (id.startsWith("http") ? id : null);
                  return (
                    <div key={id} className="relative h-24 w-24 rounded-xl border-2 border-primary/20 bg-primary/5 flex items-center justify-center group overflow-hidden">
                      {previewUrl ? (
                        <img src={previewUrl} alt={`Additional ${index + 1}`} className="w-full h-full object-cover" />
                      ) : (
                        <CheckCircle2 className="h-8 w-8 text-primary/40" />
                      )}
                      <button 
                        onClick={() => removeImage("additional", index)}
                        className="absolute -top-1 -right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
                {formData.images.additional.length < 6 && (
                  <div className="relative h-24 w-24 rounded-xl border-2 border-dashed border-muted-foreground/20 hover:border-primary/40 hover:bg-primary/5 transition-all">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="file-upload-additional"
                      onChange={(e) => handleImageUpload(e, "additional")}
                      disabled={!!uploadingSlot}
                    />
                    <label 
                      htmlFor="file-upload-additional"
                      className="w-full h-full flex flex-col items-center justify-center gap-1 cursor-pointer"
                    >
                      {uploadingSlot === "additional" ? (
                        <TrendingUp className="h-5 w-5 text-primary animate-pulse" />
                      ) : (
                        <>
                          <Plus className="h-5 w-5 text-muted-foreground" />
                          <span className="text-[8px] font-bold uppercase">Add Photo</span>
                        </>
                      )}
                    </label>
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-primary/5 p-4 rounded-xl flex items-center gap-3 border border-primary/10">
              <Info className="h-5 w-5 text-primary shrink-0" />
              <p className="text-[10px] font-black uppercase tracking-wide text-primary">
                Required: At least one photo. Recommended: Front, Engine, Cabin, Rear. Clear photos increase trust.
              </p>
            </div>
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
                      inputMode="numeric"
                      value={formData.startingPrice || ""} 
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
                      inputMode="numeric"
                      value={formData.reservePrice || ""} 
                      onChange={(e) => updateField("reservePrice", parseInt(e.target.value) || 0)}
                      className="h-14 pl-10 text-xl font-black rounded-xl border-2 border-primary/20"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase px-1">
                    The minimum price you are willing to accept.
                  </p>
                </div>

                <div className="space-y-2 pt-4">
                  <label className="text-xs font-black uppercase text-muted-foreground ml-1">Auction Duration</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[3, 7, 14].map((days) => (
                      <Button
                        key={days}
                        variant={formData.durationDays === days ? "default" : "outline"}
                        onClick={() => updateField("durationDays", days)}
                        className="h-12 font-black rounded-xl border-2"
                      >
                        {days} DAYS
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-primary/5 border-2 border-primary/10 rounded-3xl p-6 space-y-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h3 className="font-black uppercase tracking-tight">Pricing Strategy</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground font-bold uppercase text-[10px]">Market Confidence (Illustrative)</span>
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
      case 5:
        return renderReviewStep();
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
            disabled={isSubmitting || !!getStepError(currentStep)}
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
