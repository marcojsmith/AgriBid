import { Button } from "@/components/ui/button";
import { Camera, X, CheckCircle2, Plus, TrendingUp, Info, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useListingWizard } from "../context/ListingWizardContext";
import { useListingMedia } from "../hooks/useListingMedia";
import { PHOTO_SLOTS } from "../constants";

export const MediaGalleryStep = () => {
  const { formData, previews } = useListingWizard();
  const { uploadingSlot, handleImageUpload, removeImage } = useListingMedia();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PHOTO_SLOTS.map((slot) => {
          const storageId = formData.images[slot.id as keyof Omit<typeof formData.images, "additional">];
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
};
