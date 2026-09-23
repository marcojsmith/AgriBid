import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Gauge, Timer } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";

// Bounds mirror PRESENCE_HEARTBEAT_INTERVAL_MS_MIN/MAX in convex/constants.ts
// (15s - 5min), expressed in seconds for the UI input.
const HEARTBEAT_INTERVAL_MIN_S = 15;
const HEARTBEAT_INTERVAL_MAX_S = 300;
const HEARTBEAT_INTERVAL_DEFAULT_S = 60;

/**
 * Admin page for tuning background resource usage during demos and
 * low-traffic periods.
 *
 * Provides runtime-adjustable settings (no redeploy needed):
 * - Demo mode: a flag other features can consult to reduce activity.
 * - Presence heartbeat interval: how often signed-in clients ping the server.
 *
 * Scheduled background jobs (auction settlement, presence cleanup, daily
 * sweeps) run on a fixed schedule set in code and are NOT editable here.
 *
 * @returns The AdminPerformance page component.
 */
export default function AdminPerformance() {
  const config = useQuery(api.admin.settings.getSystemConfig);
  const updatePerformanceConfig = useMutation(
    api.admin.settings.updatePerformanceConfig
  );

  const [demoModeEnabled, setDemoModeEnabled] = useState(false);
  const [heartbeatSeconds, setHeartbeatSeconds] = useState(
    String(HEARTBEAT_INTERVAL_DEFAULT_S)
  );
  const [isSaving, setIsSaving] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (config !== undefined && !initializedRef.current) {
      setDemoModeEnabled(config.performance.demoModeEnabled.current);
      setHeartbeatSeconds(
        String(config.performance.heartbeatIntervalMs.current / 1000)
      );
      initializedRef.current = true;
    }
  }, [config]);

  if (config === undefined) {
    return (
      <AdminLayout
        title="Performance & Demo Mode"
        subtitle="Background Activity & Resource Usage"
      >
        <div className="h-64 flex items-center justify-center">
          <LoadingIndicator />
        </div>
      </AdminLayout>
    );
  }

  const handleSave = async () => {
    const seconds = Number.parseInt(heartbeatSeconds, 10);
    if (
      !Number.isInteger(seconds) ||
      seconds < HEARTBEAT_INTERVAL_MIN_S ||
      seconds > HEARTBEAT_INTERVAL_MAX_S
    ) {
      toast.error(
        `Heartbeat interval must be between ${String(
          HEARTBEAT_INTERVAL_MIN_S
        )} and ${String(HEARTBEAT_INTERVAL_MAX_S)} seconds`
      );
      return;
    }

    setIsSaving(true);
    try {
      // Single atomic mutation: both keys are written in one Convex
      // transaction, so a failed save never leaves partial state.
      await updatePerformanceConfig({
        demoModeEnabled,
        heartbeatIntervalMs: seconds * 1000,
      });
      toast.success("Performance settings saved");
      initializedRef.current = false;
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save settings"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout
      title="Performance & Demo Mode"
      subtitle="Background Activity & Resource Usage"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Gauge className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle>Performance & Demo Mode</CardTitle>
                <CardDescription>
                  Tune background activity for demos and low-traffic periods.
                  Changes take effect immediately without redeployment.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-start justify-between gap-4 pt-4 border-t">
              <div className="space-y-1">
                <Label htmlFor="demo-mode">Demo mode</Label>
                <p className="text-xs text-muted-foreground">
                  Reduce background activity for demos and low-traffic periods.
                </p>
              </div>
              <Switch
                id="demo-mode"
                checked={demoModeEnabled}
                onCheckedChange={setDemoModeEnabled}
              />
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="heartbeat-interval">
                Presence heartbeat interval (seconds)
              </Label>
              <Input
                id="heartbeat-interval"
                type="number"
                min={HEARTBEAT_INTERVAL_MIN_S}
                max={HEARTBEAT_INTERVAL_MAX_S}
                step={1}
                value={heartbeatSeconds}
                onChange={(e) => {
                  setHeartbeatSeconds(e.target.value);
                }}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                How often signed-in clients ping the server to report presence.
                Allowed range: {String(HEARTBEAT_INTERVAL_MIN_S)}-
                {String(HEARTBEAT_INTERVAL_MAX_S)} seconds. Higher values mean
                fewer background writes.
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
              <div className="p-2 bg-muted rounded-lg">
                <Timer className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle>Fixed-schedule jobs</CardTitle>
                <CardDescription>
                  Not configurable from this page
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>
              Some background jobs run on a fixed schedule defined in code
              (convex/crons.ts) and are <strong>not</strong> affected by this
              page:
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Auction lot settlement — every 1 minute</li>
              <li>Presence record cleanup — every 15 minutes</li>
              <li>Daily sweeps (drafts, orphaned uploads, error reports)</li>
            </ul>
            <p>
              Changing their frequency requires a code change and redeployment,
              not a setting here.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
