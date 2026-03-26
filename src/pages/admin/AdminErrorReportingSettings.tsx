import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { AlertTriangle, CheckCircle, Eye, EyeOff, Shield } from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingIndicator } from "@/components/LoadingIndicator";

/**
 * Renders the Error Reporting settings page for configuring GitHub issue integration.
 *
 * Allows admins to enable/disable automatic GitHub issue creation for unexpected errors,
 * and configure the GitHub repository details and API token.
 *
 * @returns The AdminErrorReportingSettings page component.
 */
export default function AdminErrorReportingSettings() {
  const settings = useQuery(api.admin.getSystemConfig);
  const updateGitHubConfig = useMutation(
    api.admin.updateGitHubErrorReportingConfig
  );

  const [enabled, setEnabled] = useState(false);
  const [token, setToken] = useState("");
  const [savedTokenMasked, setSavedTokenMasked] = useState("");
  const [repoOwner, setRepoOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  const [labels, setLabels] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasExistingToken, setHasExistingToken] = useState(false);
  const [hasStartedTyping, setHasStartedTyping] = useState(false);

  useEffect(() => {
    if (settings !== undefined) {
      const gc = settings.githubConfig;
      setEnabled(gc.enabled);
      const existing =
        gc.tokenMasked.startsWith("****") && gc.tokenMasked.length > 4;
      setToken(existing ? "" : gc.tokenMasked);
      setSavedTokenMasked(existing ? gc.tokenMasked : "");
      setHasExistingToken(existing);
      setHasStartedTyping(false);
      setRepoOwner(gc.repoOwner ?? "");
      setRepoName(gc.repoName ?? "");
      setLabels(gc.labels ?? "");
    }
  }, [settings]);

  const displayToken =
    hasExistingToken && !showToken && !hasStartedTyping
      ? savedTokenMasked
      : token;

  if (settings === undefined) {
    return (
      <AdminLayout
        title="Error Reporting"
        subtitle="Configure GitHub Issue Integration"
      >
        <div className="h-64 flex items-center justify-center">
          <LoadingIndicator />
        </div>
      </AdminLayout>
    );
  }

  const handleSave = async () => {
    if (enabled && (!repoOwner.trim() || !repoName.trim())) {
      toast.error("Repository owner and name are required when enabled");
      return;
    }

    setIsSaving(true);
    try {
      await updateGitHubConfig({
        enabled,
        token: token && !token.startsWith("****") ? token : undefined,
        repoOwner,
        repoName,
        labels,
      });
      toast.success("Error reporting settings saved");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : String(err) || "Failed to save settings"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout
      title="Error Reporting"
      subtitle="Configure GitHub Issue Integration"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                GitHub Integration
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Automatically create GitHub issues for unexpected errors
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between py-4 border-t border-gray-200 dark:border-gray-800">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                Enable Error Reporting
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Automatically report unexpected errors to GitHub issues
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEnabled(!enabled);
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enabled ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
              }`}
              aria-checked={enabled}
              role="switch"
              aria-label={
                enabled ? "Disable error reporting" : "Enable error reporting"
              }
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {enabled && (
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-800">
              <div>
                <label
                  htmlFor="github-pat"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  GitHub Personal Access Token
                </label>
                <div className="relative">
                  <input
                    id="github-pat"
                    type={showToken ? "text" : "password"}
                    value={displayToken}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setToken(newValue);
                      if (newValue !== savedTokenMasked) {
                        setHasStartedTyping(true);
                      }
                    }}
                    onPaste={() => {
                      setHasStartedTyping(true);
                    }}
                    placeholder="ghp_xxxxxxxxxxxx"
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 pr-10 ${
                      hasExistingToken && !showToken
                        ? "italic text-gray-400"
                        : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowToken(!showToken);
                    }}
                    aria-label={showToken ? "Hide token" : "Show token"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    {showToken ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {hasExistingToken
                    ? "Token is set. Leave empty to keep, or enter new token to replace."
                    : "Requires repo scope. Stored encrypted."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Repository Owner
                  </label>
                  <input
                    type="text"
                    value={repoOwner}
                    onChange={(e) => {
                      setRepoOwner(e.target.value);
                    }}
                    placeholder="username or org"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Repository Name
                  </label>
                  <input
                    type="text"
                    value={repoName}
                    onChange={(e) => {
                      setRepoName(e.target.value);
                    }}
                    placeholder="AgriBid"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Issue Labels
                </label>
                <input
                  type="text"
                  value={labels}
                  onChange={(e) => {
                    setLabels(e.target.value);
                  }}
                  placeholder="bug, auto-reported"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Comma-separated label names to apply to new issues
                </p>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-3 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Security Note
                  </p>
                  <p className="text-amber-700 dark:text-amber-300 mt-0.5">
                    Validation errors are filtered out. Only unexpected errors
                    (runtime failures, network issues, etc.) are reported. Error
                    messages are sanitized to remove PII.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!enabled && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-4 mt-4">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">
                  Error reporting is disabled. Unexpected errors will not be
                  captured.
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-800">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSaving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>

        {enabled && repoOwner && repoName && (
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 h-fit">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  Configuration Status
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  GitHub issues will be created in{" "}
                  <span className="font-mono">
                    {repoOwner}/{repoName}
                  </span>
                </p>
              </div>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
              <p>
                Errors are processed daily at 2 AM UTC via a scheduled cron job.
              </p>
              <p>
                Duplicate errors (same fingerprint within 24 hours) are grouped
                and added as comments to existing issues.
              </p>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}