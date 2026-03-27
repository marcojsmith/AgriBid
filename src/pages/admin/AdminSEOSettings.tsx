import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { BarChart2, CheckCircle } from "lucide-react";
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

/**
 * Admin page for configuring SEO analytics and search engine verification.
 *
 * Provides inputs for:
 * - Google Analytics 4 Measurement ID (injected as GA4 script in Layout)
 * - Google Search Console verification token (injected as meta tag in Layout)
 * - Bing Webmaster Tools verification token (injected as meta tag in Layout)
 *
 * @returns The AdminSEOSettings page component.
 */
export default function AdminSEOSettings() {
  const seoSettings = useQuery(api.admin.getSeoSettings);
  const updateSeoSettings = useMutation(api.admin.updateSeoSettings);

  const [ga4Id, setGa4Id] = useState("");
  const [gscToken, setGscToken] = useState("");
  const [bingToken, setBingToken] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (seoSettings !== undefined && !initializedRef.current) {
      setGa4Id(seoSettings.ga4MeasurementId ?? "");
      setGscToken(seoSettings.searchConsoleVerification ?? "");
      setBingToken(seoSettings.bingVerification ?? "");
      initializedRef.current = true;
    }
  }, [seoSettings]);

  if (seoSettings === undefined) {
    return (
      <AdminLayout
        title="SEO & Analytics"
        subtitle="Search Engine Optimisation Settings"
      >
        <div className="h-64 flex items-center justify-center">
          <LoadingIndicator />
        </div>
      </AdminLayout>
    );
  }

  const handleSave = async () => {
    const trimmedGa4 = ga4Id.trim();
    if (trimmedGa4 && !/^G-[A-Z0-9]+$/i.test(trimmedGa4)) {
      toast.error("GA4 Measurement ID must be in the format G-XXXXXXXXXX");
      return;
    }

    setIsSaving(true);
    try {
      await updateSeoSettings({
        ga4MeasurementId: trimmedGa4,
        searchConsoleVerification: gscToken.trim(),
        bingVerification: bingToken.trim(),
      });
      toast.success("SEO settings saved");
      initializedRef.current = false;
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save settings"));
    } finally {
      setIsSaving(false);
    }
  };

  const ga4Preview = ga4Id.trim()
    ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${ga4Id.trim()}"></script>`
    : null;

  const gscPreview = gscToken.trim()
    ? `<meta name="google-site-verification" content="${gscToken.trim()}" />`
    : null;

  const bingPreview = bingToken.trim()
    ? `<meta name="msvalidate.01" content="${bingToken.trim()}" />`
    : null;

  return (
    <AdminLayout
      title="SEO & Analytics"
      subtitle="Search Engine Optimisation Settings"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <BarChart2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle>Analytics & Verification</CardTitle>
                <CardDescription>
                  Configure tracking and search engine verification. Changes
                  take effect immediately without redeployment.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="ga4-id">
                Google Analytics 4 — Measurement ID
              </Label>
              <Input
                id="ga4-id"
                type="text"
                value={ga4Id}
                onChange={(e) => {
                  setGa4Id(e.target.value);
                }}
                placeholder="G-XXXXXXXXXX"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Found in GA4 Admin → Data Streams → Measurement ID. Leave empty
                to disable.
              </p>
              {ga4Preview && (
                <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                  {ga4Preview}
                </pre>
              )}
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="gsc-token">
                Google Search Console — Verification Token
              </Label>
              <Input
                id="gsc-token"
                type="text"
                value={gscToken}
                onChange={(e) => {
                  setGscToken(e.target.value);
                }}
                placeholder="abc123XYZ..."
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                From Search Console → Settings → Ownership verification → HTML
                tag (the content="" value only).
              </p>
              {gscPreview && (
                <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                  {gscPreview}
                </pre>
              )}
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="bing-token">
                Bing Webmaster Tools — Verification Token
              </Label>
              <Input
                id="bing-token"
                type="text"
                value={bingToken}
                onChange={(e) => {
                  setBingToken(e.target.value);
                }}
                placeholder="ABC123..."
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                From Bing Webmaster Tools → Verify → Meta Tag (the content=""
                value only).
              </p>
              {bingPreview && (
                <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                  {bingPreview}
                </pre>
              )}
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
                  Stored in the database, injected at runtime
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>
              Settings are stored in Convex and read by the app Layout on every
              page load — no redeployment needed.
            </p>
            <p>
              GA4 scripts are only injected when a valid Measurement ID is
              saved. Verification tags are only added when tokens are non-empty.
            </p>
            <p>
              Clear any field and save to remove the corresponding tag or script
              from the page.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
