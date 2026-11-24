import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Navigate } from "react-router-dom";

import { LoadingPage } from "@/components/LoadingIndicator";
import { useRegisterParams } from "@/hooks/useRegisterParams";
import { entryStep } from "@/lib/registrationCopy";

/**
 * `/register`: sends the buyer to the first step they haven't finished, or to
 * the status page once the registration is submitted. Keeps `?callbackUrl=`.
 *
 * @returns A redirect, or a loading state while the registration loads
 */
export default function RegisterIndex() {
  const registration = useQuery(api.registration.getMyRegistration);
  const { path } = useRegisterParams();

  if (!registration) return <LoadingPage message="Loading registration..." />;
  return <Navigate to={path(entryStep(registration))} replace />;
}
