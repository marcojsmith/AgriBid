// app/src/pages/kyc/sections/PersonalInfoSection.tsx
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { User, Fingerprint, Phone, Mail } from "lucide-react";
import type { KYCFormData } from "../hooks/useKYCForm";

interface PersonalInfoSectionProps {
  formData: KYCFormData;
  updateField: (field: keyof KYCFormData, value: string) => void;
}

/**
 * Render the "Personal Information" form section with controlled inputs for name, ID, phone, and email.
 *
 * The inputs are bound to `formData` and invoke `updateField` with the corresponding field key and the new string value when changed.
 *
 * @param formData - Current KYC form values for the fields displayed in this section
 * @param updateField - Callback to update a specific `KYCFormData` field: called with the field key and the new string value
 * @returns The JSX element for the personal information form section
 */
export function PersonalInfoSection({
  formData,
  updateField,
}: PersonalInfoSectionProps) {
  return (
    <Card className="p-6 border-2 space-y-6">
      <div className="flex items-center gap-2 pb-2 border-b">
        <User className="h-5 w-5 text-primary" />
        <h2 className="font-black uppercase text-sm tracking-widest">
          Personal Information
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label 
            htmlFor="firstName"
            className="text-[10px] font-black uppercase tracking-widest text-muted-foreground"
          >
            First Names
          </Label>
          <Input
            id="firstName"
            placeholder="Enter all names as per ID"
            className="h-12 border-2 rounded-xl"
            value={formData.firstName}
            onChange={(e) => updateField("firstName", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label 
            htmlFor="lastName"
            className="text-[10px] font-black uppercase tracking-widest text-muted-foreground"
          >
            Last Name
          </Label>
          <Input
            id="lastName"
            placeholder="Surname"
            className="h-12 border-2 rounded-xl"
            value={formData.lastName}
            onChange={(e) => updateField("lastName", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label 
            htmlFor="idNumber"
            className="text-[10px] font-black uppercase tracking-widest text-muted-foreground"
          >
            ID / Passport Number
          </Label>
          <div className="relative">
            <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="idNumber"
              placeholder="National ID Number"
              className="h-12 pl-10 border-2 rounded-xl"
              value={formData.idNumber}
              onChange={(e) => updateField("idNumber", e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label 
            htmlFor="phoneNumber"
            className="text-[10px] font-black uppercase tracking-widest text-muted-foreground"
          >
            Cell Phone Number
          </Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="phoneNumber"
              type="tel"
              placeholder="+27..."
              className="h-12 pl-10 border-2 rounded-xl"
              value={formData.phoneNumber}
              onChange={(e) => updateField("phoneNumber", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label 
            htmlFor="email"
            className="text-[10px] font-black uppercase tracking-widest text-muted-foreground"
          >
            Email Address
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="verify@example.com"
              className="h-12 pl-10 border-2 rounded-xl"
              value={formData.email}
              onChange={(e) => updateField("email", e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label 
            htmlFor="confirmEmail"
            className="text-[10px] font-black uppercase tracking-widest text-muted-foreground"
          >
            Confirm Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="confirmEmail"
              type="email"
              placeholder="Repeat email address"
              className="h-12 pl-10 border-2 rounded-xl"
              value={formData.confirmEmail}
              onChange={(e) => updateField("confirmEmail", e.target.value)}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}