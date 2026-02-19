import { Info, Camera, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useListingWizard } from "../context/ListingWizardContext";
import { PHOTO_SLOTS } from "../constants";

export const ReviewSubmitStep = () => {
  const { formData, previews } = useListingWizard();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="bg-primary/5 border-2 border-primary/10 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="h-5 w-5 text-primary">
            <Info className="h-5 w-5" />
          </span>
          <h3 className="font-black uppercase tracking-tight">
            Listing Summary
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">
                Title
              </p>
              <p className="font-bold">{formData.title}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground">
                  Make/Model
                </p>
                <p className="font-bold">
                  {formData.make} {formData.model}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground">
                  Year
                </p>
                <p className="font-bold">{formData.year}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground">
                  Hours
                </p>
                <p className="font-bold">{formData.operatingHours} hrs</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground">
                  Location
                </p>
                <p className="font-bold">{formData.location}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">
                Description
              </p>
              <p className="text-sm line-clamp-3">
                {formData.description || "No description provided."}
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground">
                  Starting Price
                </p>
                <p className="font-bold text-primary">
                  R {formData.startingPrice.toLocaleString("en-ZA")}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground">
                  Reserve Price
                </p>
                <p className="font-bold">
                  R {formData.reservePrice.toLocaleString("en-ZA")}
                </p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">
                Duration
              </p>
              <p className="font-bold">{formData.durationDays} Days</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">
                Condition Checklist
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                {Object.entries(formData.conditionChecklist).map(
                  ([key, value]) => {
                    if (key === "notes" || value === null) return null;
                    return (
                      <Badge
                        key={key}
                        variant={value ? "default" : "destructive"}
                        className="uppercase text-[9px] font-black"
                      >
                        {key}: {value ? "YES" : "NO"}
                      </Badge>
                    );
                  },
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-[10px] font-black uppercase text-muted-foreground ml-1">
          Media Gallery Preview
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {PHOTO_SLOTS.map((slot) => {
            const storageId =
              formData.images[
                slot.id as keyof Omit<typeof formData.images, "additional">
              ];
            const previewUrl =
              previews[slot.id] ||
              (storageId?.startsWith("http") ? storageId : null);

            return (
              <div
                key={slot.id}
                className="aspect-video rounded-xl border-2 overflow-hidden bg-muted relative group shadow-sm"
              >
                {storageId ? (
                  <div className="w-full h-full flex items-center justify-center bg-primary/5">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={slot.label}
                        className="w-full h-full object-cover"
                      />
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
