import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useSession } from "../../lib/auth-client";
import { getErrorMessage, isValidCallbackUrl } from "@/lib/utils";
import { toast } from "sonner";

import { ListingWizardProvider } from "./context/ListingWizardContext";
import { useListingWizard } from "./hooks/useListingWizard";
import { useListingForm } from "./hooks/useListingForm";
import { StepIndicator } from "./StepIndicator";
import { WizardNavigation } from "./WizardNavigation";
import { STEPS } from "./constants";

import { GeneralInfoStep } from "./steps/GeneralInfoStep";
import { TechnicalSpecsStep } from "./steps/TechnicalSpecsStep";
import { ConditionChecklistStep } from "./steps/ConditionChecklistStep";
import { MediaGalleryStep } from "./steps/MediaGalleryStep";
import { PricingDurationStep } from "./steps/PricingDurationStep";
import { ReviewSubmitStep } from "./steps/ReviewSubmitStep";

/**
 * Inner component that renders the listing wizard content and handles form submission.
 * Consumes ListingWizardContext via useListingWizard, session state via useSession,
 * routing via useLocation/useNavigate, validation via useListingForm, and auction
 * creation via useMutation.
 *
 * @returns The wizard step UI based on currentStep or success/error states
 */
const ListingWizardContent = () => {
  const {
    formData,
    currentStep,
    setCurrentStep,
    setIsSubmitting,
    isSubmitting,
    isSuccess,
    setIsSuccess,
  } = useListingWizard();

  const { data: session, isPending } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const { getStepError } = useListingForm();
  const createAuction = useMutation(api.auctions.createAuction);

  /**
   * Handles the final listing submission.
   * - Prevents double-submit via isSubmitting guard
   * - Validates all steps before submission
   * - Calls createAuction mutation
   * - Updates submission state and navigates on success
   * - Shows error toast on failure
   *
   * @returns Promise that resolves when submission completes (success or failure)
   */
  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (isPending) {
      toast.info("Checking your session...");
      return;
    }
    if (!session) {
      toast.info("Please sign in to submit your listing");
      const rawUrl = location.pathname;
      const callbackUrl = isValidCallbackUrl(rawUrl)
        ? encodeURIComponent(rawUrl)
        : "/";
      navigate(`/login?callbackUrl=${callbackUrl}`);
      return;
    }

    for (const [stepIndex] of STEPS.entries()) {
      const error = getStepError(stepIndex);
      if (error) {
        setCurrentStep(stepIndex);
        toast.error(error);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const images = {
        ...formData.images,
        additional: Array.isArray(formData.images.additional)
          ? formData.images.additional
          : [],
      };

      await createAuction({
        title: formData.title,
        make: formData.make,
        model: formData.model,
        year: formData.year,
        operatingHours: formData.operatingHours,
        location: formData.location,
        description: formData.description,
        startingPrice: formData.startingPrice,
        reservePrice: formData.reservePrice,
        images,
        durationDays: formData.durationDays,
        conditionChecklist: {
          engine: formData.conditionChecklist.engine ?? false,
          hydraulics: formData.conditionChecklist.hydraulics ?? false,
          tires: formData.conditionChecklist.tires ?? false,
          serviceHistory: formData.conditionChecklist.serviceHistory ?? false,
          notes: formData.conditionChecklist.notes,
        },
      });

      localStorage.removeItem("agribid_listing_draft");
      localStorage.removeItem("agribid_listing_step");
      setIsSuccess(true);
      toast.success("Listing submitted for review!");
    } catch (error) {
      console.error("Listing submission failed", {
        error,
        step: "listing submission",
        formState: { title: formData.title, make: formData.make },
      });
      toast.error(getErrorMessage(error, "Submission failed"));
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
          <h2 className="text-4xl font-black uppercase tracking-tight">
            Submission Received
          </h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Your machinery listing has been successfully submitted to our
            moderation queue.
          </p>
        </div>
        <div className="bg-muted/30 p-6 rounded-2xl border-2 border-dashed max-w-md mx-auto">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">
            What Happens Next?
          </p>
          <ul className="text-left space-y-4">
            <li className="flex gap-3 text-sm font-bold uppercase tracking-tight">
              <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">
                1
              </span>
              Technical Review (2-4 Hours)
            </li>
            <li className="flex gap-3 text-sm font-bold uppercase tracking-tight">
              <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">
                2
              </span>
              Valuation Confirmation
            </li>
            <li className="flex gap-3 text-sm font-bold uppercase tracking-tight">
              <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">
                3
              </span>
              Auction Goes Live
            </li>
          </ul>
        </div>
        <Button
          size="lg"
          className="h-14 px-12 rounded-2xl font-black text-xl shadow-xl shadow-primary/20"
          asChild
        >
          <Link to="/">Return to Marketplace</Link>
        </Button>
      </div>
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <GeneralInfoStep />;
      case 1:
        return <TechnicalSpecsStep />;
      case 2:
        return <ConditionChecklistStep />;
      case 3:
        return <MediaGalleryStep />;
      case 4:
        return <PricingDurationStep />;
      case 5:
        return <ReviewSubmitStep />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      <StepIndicator />
      <div className="bg-card border-2 rounded-2xl p-8 min-h-[450px]">
        {renderStep()}
      </div>
      <WizardNavigation onFinalSubmit={handleSubmit} />
    </div>
  );
};

/**
 * Public entry point for the listing wizard feature.
 *
 * This component composes {@link ListingWizardProvider} and {@link ListingWizardContent}
 * to provide the complete listing creation flow. It accepts no props and returns a
 * JSX.Element that renders the provider with the wizard content.
 *
 * @returns A JSX.Element rendering the listing wizard provider and content
 */
export const ListingWizard = () => (
  <ListingWizardProvider>
    <ListingWizardContent />
  </ListingWizardProvider>
);
