import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Navigate, useNavigate } from "react-router-dom";

import { LoadingPage } from "@/components/LoadingIndicator";
import { useRegisterParams } from "@/hooks/useRegisterParams";

import { DocumentStep } from "./DocumentStep";

/**
 * Step 2: upload the ID (front and back of a smart ID card, or the photo page
 * of an ID book) or the passport photo page. Redirects to step 1 until the
 * details are saved.
 *
 * @returns The ID step
 */
export default function IdStep() {
  const registration = useQuery(api.registration.getMyRegistration);
  const navigate = useNavigate();
  const { replace, path } = useRegisterParams();

  if (!registration) return <LoadingPage message="Loading registration..." />;
  const { eligibility } = registration;
  if (!replace && eligibility.kind !== "incomplete") {
    // Already submitted (or verified): changing documents is replace mode only.
    return <Navigate to={path("status")} replace />;
  }
  if (!replace && eligibility.kind === "incomplete" && eligibility.step === 1) {
    return <Navigate to={path("details")} replace />;
  }

  const passport = registration.details.idType === "passport";
  return (
    <DocumentStep
      registration={registration}
      step="id"
      title={passport ? "Passport photo page" : "Upload your ID"}
      intro={
        passport
          ? "The page with your photo and details."
          : "Smart ID card: front and back. ID book: the photo page."
      }
      kinds={passport ? ["passport_photo"] : ["id_front", "id_back"]}
      checklist={[
        passport ? "Names match your passport" : "Names match your ID",
        "In colour",
        "All 4 corners visible",
        "Not expired",
      ]}
      nextLabel="Next: proof of address"
      onNext={async () => {
        await navigate(path("address"));
      }}
    />
  );
}
