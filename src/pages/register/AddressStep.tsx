import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Navigate, useNavigate } from "react-router-dom";

import { LoadingPage } from "@/components/LoadingIndicator";
import { useRegisterParams } from "@/hooks/useRegisterParams";

import { DocumentStep } from "./DocumentStep";

/**
 * Step 3: proof of address. "Next: deposit" (or "Send documents" when the
 * deposit is off) submits the registration for review. Redirects to the
 * earlier steps until they are done.
 *
 * @returns The proof-of-address step
 */
export default function AddressStep() {
  const registration = useQuery(api.registration.getMyRegistration);
  const submit = useMutation(api.registration.submitMyDocuments);
  const navigate = useNavigate();
  const { replace, path } = useRegisterParams();

  if (!registration) return <LoadingPage message="Loading registration..." />;
  const { eligibility, depositSettings } = registration;
  if (!replace && eligibility.kind !== "incomplete") {
    // Already submitted (or verified): never submit twice.
    return <Navigate to={path("status")} replace />;
  }
  if (!replace && eligibility.kind === "incomplete" && eligibility.step < 3) {
    return (
      <Navigate to={path(eligibility.step === 1 ? "details" : "id")} replace />
    );
  }

  return (
    <DocumentStep
      registration={registration}
      step="address"
      title="Proof of address"
      intro="A utility bill, bank statement or lease, not older than 3 months. Photo or PDF."
      kinds={["proof_of_address"]}
      checklist={[
        "Your name and address are visible",
        "All 4 corners visible",
        "Issued in the last 3 months",
      ]}
      nextLabel={depositSettings.enabled ? "Next: deposit" : "Send documents"}
      onNext={async () => {
        await submit({});
        await navigate(path(depositSettings.enabled ? "deposit" : "status"));
      }}
    />
  );
}
