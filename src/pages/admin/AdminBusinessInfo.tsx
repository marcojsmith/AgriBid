import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Building2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { getErrorMessage } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Admin page for managing business/organization information used for SEO structured data.
 * @returns The AdminBusinessInfo page component
 */
export default function AdminBusinessInfo() {
  const businessInfo = useQuery(api.admin.getBusinessInfo);
  const updateBusinessInfo = useMutation(api.admin.updateBusinessInfo);

  const [businessName, setBusinessName] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [addressLocality, setAddressLocality] = useState("");
  const [addressCountry, setAddressCountry] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [sameAs, setSameAs] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (businessInfo !== undefined && !initializedRef.current) {
      setBusinessName(businessInfo.businessName ?? "");
      setBusinessDescription(businessInfo.businessDescription ?? "");
      setStreetAddress(businessInfo.streetAddress ?? "");
      setAddressLocality(businessInfo.addressLocality ?? "");
      setAddressCountry(businessInfo.addressCountry ?? "");
      setPostalCode(businessInfo.postalCode ?? "");
      setTelephone(businessInfo.telephone ?? "");
      setEmail(businessInfo.email ?? "");
      setWebsite(businessInfo.website ?? "");
      setLogoUrl(businessInfo.logoUrl ?? "");
      setSameAs(businessInfo.sameAs?.join("\n") ?? "");
      initializedRef.current = true;
    }
  }, [businessInfo]);

  if (businessInfo === undefined) {
    return (
      <AdminLayout
        title="Business Info"
        subtitle="Organization Details for SEO"
      >
        <div className="h-64 flex items-center justify-center">
          <LoadingIndicator />
        </div>
      </AdminLayout>
    );
  }

  const validateUrl = (url: string): boolean => {
    if (!url) return true;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const validatePhone = (phone: string): boolean => {
    if (!phone) return true;
    const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;
    return phoneRegex.test(phone);
  };

  const validateEmail = (mail: string): boolean => {
    if (!mail) return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(mail);
  };

  const handleSave = async () => {
    const trimmedWebsite = website.trim();
    const trimmedLogoUrl = logoUrl.trim();
    const trimmedTelephone = telephone.trim();
    const trimmedEmail = email.trim();
    const trimmedSameAs = sameAs.trim();

    if (trimmedWebsite && !validateUrl(trimmedWebsite)) {
      toast.error("Website must be a valid URL");
      return;
    }
    if (trimmedLogoUrl && !validateUrl(trimmedLogoUrl)) {
      toast.error("Logo URL must be a valid URL");
      return;
    }
    if (trimmedTelephone && !validatePhone(trimmedTelephone)) {
      toast.error("Telephone must be a valid phone number (7-20 characters)");
      return;
    }
    if (trimmedEmail && !validateEmail(trimmedEmail)) {
      toast.error("Email must be a valid email address");
      return;
    }

    const sameAsUrls = trimmedSameAs
      ? trimmedSameAs
          .split("\n")
          .map((url) => url.trim())
          .filter((url) => url !== "")
      : [];
    for (const url of sameAsUrls) {
      if (!validateUrl(url)) {
        toast.error(`Invalid URL in social links: ${url}`);
        return;
      }
    }

    setIsSaving(true);
    try {
      await updateBusinessInfo({
        businessName: businessName.trim(),
        businessDescription: businessDescription.trim(),
        streetAddress: streetAddress.trim(),
        addressLocality: addressLocality.trim(),
        addressCountry: addressCountry.trim(),
        postalCode: postalCode.trim(),
        telephone: trimmedTelephone,
        email: trimmedEmail,
        website: trimmedWebsite,
        logoUrl: trimmedLogoUrl,
        sameAs: sameAsUrls,
      });
      toast.success("Business info saved");
      initializedRef.current = false;
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save settings"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout title="Business Info" subtitle="Organization Details for SEO">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Building2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle>Organization Details</CardTitle>
                <CardDescription>
                  Business information used for SEO structured data (JSON-LD).
                  Changes take effect immediately.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="business-name">Organization Name</Label>
              <Input
                id="business-name"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="AgriBid"
              />
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="business-description">Description</Label>
              <Textarea
                id="business-description"
                value={businessDescription}
                onChange={(e) => setBusinessDescription(e.target.value)}
                placeholder="South Africa's agricultural equipment auction platform"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor="street-address">Street Address</Label>
                <Input
                  id="street-address"
                  type="text"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="123 Harvest Road"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address-locality">City / Locality</Label>
                <Input
                  id="address-locality"
                  type="text"
                  value={addressLocality}
                  onChange={(e) => setAddressLocality(e.target.value)}
                  placeholder="Agricultural Hub"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address-country">Country Code</Label>
                <Input
                  id="address-country"
                  type="text"
                  value={addressCountry}
                  onChange={(e) => setAddressCountry(e.target.value)}
                  placeholder="ZA"
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postal-code">Postal Code</Label>
                <Input
                  id="postal-code"
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="4500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor="telephone">Telephone</Label>
                <Input
                  id="telephone"
                  type="tel"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  placeholder="+27-11-555-0123"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="info@agribid.co.za"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://agribid.co.za"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo-url">Logo URL</Label>
                <Input
                  id="logo-url"
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://agribid.co.za/logo.png"
                />
              </div>
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="same-as">Social Media Links</Label>
              <Textarea
                id="same-as"
                value={sameAs}
                onChange={(e) => setSameAs(e.target.value)}
                placeholder="https://facebook.com/agribid&#10;https://twitter.com/agribid&#10;https://instagram.com/agribid"
                rows={4}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Enter one URL per line. These will be added to the "sameAs"
                field in the Organization schema.
              </p>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button type="button" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle>How it works</CardTitle>
                <CardDescription>
                  SEO structured data for search engines
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>
              This information is used to generate Organization structured data
              (JSON-LD) that search engines can read.
            </p>
            <p>
              The data appears in Google&apos;s knowledge graph and can improve
              your search visibility.
            </p>
            <p>
              Only the Organization Name is required. Other fields are optional
              but recommended for complete information.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
