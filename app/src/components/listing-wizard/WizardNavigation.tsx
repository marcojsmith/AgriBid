import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Check, Save } from "lucide-react";
import { useListingWizard } from "./hooks/useListingWizard";
import { useListingForm } from "./hooks/useListingForm";
import { STEPS } from "./constants";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-client";
import { getErrorMessage } from "@/lib/utils";
import type { Id } from "convex/_generated/dataModel";

interface WizardNavigationProps {
  onFinalSubmit: () => void;
}

export const WizardNavigation = ({ onFinalSubmit }: WizardNavigationProps) => {
  const { currentStep, isSubmitting, formData, setFormData } =
    useListingWizard();
  const { prev, next, getStepError } = useListingForm();

  const { data: session } = useSession();
  const createAuction = useMutation(api.auctions.createAuction);
  const updateAuction = useMutation(api.auctions.updateAuction);

  const handleSaveDraft = async () => {
    if (!session?.user) {
      toast.info("Please sign in to save drafts to your account.");
      return;
    }

    try {
      const images = {
        ...formData.images,
        additional: Array.isArray(formData.images.additional)
          ? formData.images.additional
          : [],
      };

      const auctionData = {
        title: formData.title || "Untitled Draft",
        make: formData.make || "Unknown",
        model: formData.model || "Unknown",
        year: formData.year,
        operatingHours: formData.operatingHours,
        location: formData.location || "Unknown",
        description: formData.description,
        startingPrice: formData.startingPrice,
        reservePrice: formData.reservePrice,
        durationDays: formData.durationDays,
        images,
        conditionChecklist: {
          engine: formData.conditionChecklist.engine ?? false,
          hydraulics: formData.conditionChecklist.hydraulics ?? false,
          tires: formData.conditionChecklist.tires ?? false,
          serviceHistory: formData.conditionChecklist.serviceHistory ?? false,
          notes: formData.conditionChecklist.notes,
        },
      };

      if (!formData.auctionId) {
        const id = await createAuction({
          ...auctionData,
          isDraft: true,
        });
        setFormData((prev) => ({ ...prev, auctionId: id }));
      } else {
        await updateAuction({
          auctionId: formData.auctionId as Id<"auctions">,
          updates: auctionData,
        });
      }
      toast.success("Draft saved successfully");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save draft"));
    }
  };

  return (
    <div className="flex justify-between items-center pt-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={prev}
          disabled={currentStep === 0 || isSubmitting}
          className="h-12 px-6 rounded-xl font-bold border-2 gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        {session?.user && (
          <Button
            variant="ghost"
            onClick={handleSaveDraft}
            disabled={isSubmitting}
            className="h-12 px-4 rounded-xl text-muted-foreground hover:text-foreground gap-2"
            title="Save progress"
          >
            <Save className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only sm:inline">Save Draft</span>
          </Button>
        )}
      </div>

      {currentStep === STEPS.length - 1 ? (
        <Button
          onClick={onFinalSubmit}
          disabled={isSubmitting || !!getStepError(currentStep)}
          className="h-14 px-12 rounded-xl font-black text-xl gap-2 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 transition-all scale-105"
        >
          {isSubmitting ? "Submitting..." : "Submit Listing"}
          {!isSubmitting && <Check className="h-6 w-6" />}
        </Button>
      ) : (
        <Button
          onClick={next}
          disabled={!!getStepError(currentStep)}
          className="h-12 px-8 rounded-xl font-black text-lg gap-2 shadow-lg shadow-primary/20"
        >
          Next Step
          <ChevronRight className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
};
