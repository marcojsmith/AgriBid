import { useState, type SyntheticEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Navigate, useNavigate } from "react-router-dom";

import { Banner } from "@/components/ds/Banner";
import { IdTypeToggle, type IdType } from "@/components/ds/IdTypeToggle";
import { TextField } from "@/components/ds/TextField";
import { LoadingPage } from "@/components/LoadingIndicator";
import { Button } from "@/components/ui/button";
import { useRegisterParams } from "@/hooks/useRegisterParams";
import {
  phoneToField,
  switchPhoneMode,
  toSaveArgs,
  validateDetails,
  type DetailsErrors,
  type DetailsValues,
} from "@/lib/registrationForm";
import { stepProgress, type Registration } from "@/lib/registrationCopy";
import { getErrorMessage } from "@/lib/utils";

import { RegisterLayout } from "./RegisterLayout";

/**
 * Builds the starting form values from what is already saved.
 *
 * @param registration - The buyer's registration
 * @returns The values
 */
function initialValues(registration: Registration): DetailsValues {
  const { details } = registration;
  const idType = details.idType ?? "sa_id";
  return {
    idType,
    fullName: details.fullName ?? "",
    phone: phoneToField(idType, details.phoneNumber),
    idNumber: details.idNumber ?? "",
    passportNumber: details.passportNumber ?? "",
    countryOfIssue: details.countryOfIssue ?? "",
    streetAddress: details.streetAddress ?? "",
    town: details.town ?? "",
    postalCode: details.postalCode ?? "",
  };
}

/**
 * Step 1: personal and address details, as they appear on the ID or passport.
 * Errors show on submit, not while typing.
 *
 * @returns The details step
 */
export default function DetailsStep() {
  const registration = useQuery(api.registration.getMyRegistration);
  const { path } = useRegisterParams();
  if (!registration) return <LoadingPage message="Loading registration..." />;
  if (registration.eligibility.kind !== "incomplete") {
    // Submitted: the reviewer is looking at these details.
    return <Navigate to={path("status")} replace />;
  }
  return <DetailsForm registration={registration} />;
}

/**
 * The details form, mounted once the saved values are known.
 *
 * @param props - Component props
 * @param props.registration - The buyer's registration
 * @returns The form inside the registration layout
 */
function DetailsForm({ registration }: { registration: Registration }) {
  const saveDetails = useMutation(api.registration.saveMyDetails);
  const navigate = useNavigate();
  const { callbackUrl, path } = useRegisterParams();
  const [values, setValues] = useState<DetailsValues>(() =>
    initialValues(registration)
  );
  const [errors, setErrors] = useState<DetailsErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isPassport = values.idType === "passport";
  const set = <K extends keyof DetailsValues>(
    key: K,
    value: DetailsValues[K]
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };
  const chooseType = (idType: IdType) => {
    setValues((prev) => ({
      ...prev,
      idType,
      phone: switchPhoneMode(idType, prev.phone),
    }));
    setErrors({});
  };

  const onSubmit = async (event: SyntheticEvent) => {
    event.preventDefault();
    setServerError(null);
    const found = validateDetails(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      await saveDetails(toSaveArgs(values));
      await navigate(path("id"));
    } catch (err) {
      setServerError(getErrorMessage(err, "Couldn't save your details."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <RegisterLayout
      callbackUrl={callbackUrl}
      title="Your details"
      intro={
        isPassport
          ? "As they appear on your passport."
          : "As they appear on your ID."
      }
      progress={stepProgress("details", registration)}
      deposit={
        registration.depositSettings.enabled
          ? registration.depositSettings
          : undefined
      }
    >
      <form
        noValidate
        onSubmit={(event) => {
          void onSubmit(event);
        }}
      >
        <IdTypeToggle value={values.idType} onChange={chooseType} />
        {serverError ? (
          <Banner kind="warn" className="mb-3.5">
            {serverError}
          </Banner>
        ) : null}
        <TextField
          id="reg-full-name"
          label="Full name"
          value={values.fullName}
          onChange={(value) => {
            set("fullName", value);
          }}
          error={errors.fullName}
          autoComplete="name"
        />
        <TextField
          id="reg-phone"
          label="Mobile number"
          value={values.phone}
          onChange={(value) => {
            set("phone", value);
          }}
          prefix={isPassport ? undefined : "+27"}
          hint="We call you about lots you win."
          error={errors.phone}
          inputMode="tel"
          autoComplete="tel"
        />
        {isPassport ? (
          <>
            <TextField
              id="reg-passport"
              label="Passport number"
              value={values.passportNumber}
              onChange={(value) => {
                set("passportNumber", value);
              }}
              error={errors.passportNumber}
            />
            <TextField
              id="reg-country"
              label="Country of issue"
              value={values.countryOfIssue}
              onChange={(value) => {
                set("countryOfIssue", value);
              }}
              error={errors.countryOfIssue}
              autoComplete="country-name"
            />
          </>
        ) : (
          <TextField
            id="reg-id-number"
            label="ID number"
            value={values.idNumber}
            onChange={(value) => {
              set("idNumber", value);
            }}
            hint="13 digits."
            error={errors.idNumber}
            inputMode="numeric"
          />
        )}
        <TextField
          id="reg-street"
          label="Street address"
          value={values.streetAddress}
          onChange={(value) => {
            set("streetAddress", value);
          }}
          error={errors.streetAddress}
          autoComplete="street-address"
        />
        <div className="flex gap-2.5">
          <TextField
            id="reg-town"
            label="Town"
            value={values.town}
            onChange={(value) => {
              set("town", value);
            }}
            error={errors.town}
            autoComplete="address-level2"
            className="min-w-0 flex-1"
          />
          <TextField
            id="reg-postal"
            label="Postal code"
            value={values.postalCode}
            onChange={(value) => {
              set("postalCode", value);
            }}
            error={errors.postalCode}
            autoComplete="postal-code"
            maxLength={10}
            className="w-[110px] flex-none"
          />
        </div>
        <Button type="submit" className="w-full" disabled={saving}>
          {isPassport ? "Next: upload passport" : "Next: upload ID"}
        </Button>
      </form>
    </RegisterLayout>
  );
}
